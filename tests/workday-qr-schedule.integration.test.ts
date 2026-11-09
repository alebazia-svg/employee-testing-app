import test from 'node:test';
import assert from 'node:assert/strict';

// Runs only against a throwaway database (same guard idea as the other schedule integration tests).
test('QR start marks an unmarked today, never overrides a saved day or a vacation, never creates notices',
  { skip: process.env.QR_SCHEDULE_TEST !== '1' }, async () => {
    const { markTodayWorkingAfterQrStart } = await import('../lib/workday-qr-schedule');
    const { prisma: db } = await import('../lib/prisma');
    const date = '2099-11-09', prefix = `qr-proof-${Date.now()}`, ids: number[] = [];
    try {
      const mk = async (suffix: string) => { const u = await db.user.create({ data: { login: prefix + suffix, name: 'Пример ' + suffix, passwordHash: 'disabled', role: 'EMPLOYEE', department: 'procurement' } }); ids.push(u.id); return u; };
      const fresh = await mk('a'), off = await mk('b'), vac = await mk('c');
      await db.workScheduleEntry.create({ data: { userId: off.id, date, status: 'off', department: 'procurement' } });
      await db.employeeVacation.create({ data: { userId: vac.id, department: 'procurement', dateFrom: date, dateTo: date, status: 'active', createdById: vac.id, updatedById: vac.id } });
      const noticesBefore = await db.workdayNotification.count({ where: { userId: { in: ids } } });
      assert.equal(await markTodayWorkingAfterQrStart(fresh, date), true);
      assert.equal(await markTodayWorkingAfterQrStart(fresh, date), false, 'second start does not write again');
      assert.equal(await markTodayWorkingAfterQrStart(off, date), false, 'a saved day off is never overridden');
      assert.equal(await markTodayWorkingAfterQrStart(vac, date), false, 'vacation is never overridden');
      assert.equal((await db.workScheduleEntry.findUnique({ where: { userId_date: { userId: fresh.id, date } } }))?.status, 'working');
      assert.equal((await db.workScheduleEntry.findUnique({ where: { userId_date: { userId: off.id, date } } }))?.status, 'off');
      assert.equal(await db.workScheduleEntry.count({ where: { userId: vac.id } }), 0);
      assert.equal((await db.workScheduleChange.findFirst({ where: { userId: fresh.id, date } }))?.source, 'qr_start');
      assert.equal(await db.workdayNotification.count({ where: { userId: { in: ids } } }), noticesBefore, 'no notices created');
    } finally {
      await db.workdayNotification.deleteMany({ where: { userId: { in: ids } } });
      await db.workScheduleChange.deleteMany({ where: { userId: { in: ids } } });
      await db.workScheduleEntry.deleteMany({ where: { userId: { in: ids } } });
      await db.employeeVacation.deleteMany({ where: { userId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
  });
