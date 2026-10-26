import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { createSessionToken, sessionCookieName } from '../lib/session';
import { getMoscowDateKey } from '../lib/workday';
import { requiredScheduleWeekDates, schedulePlanningWeek, shiftScheduleDate } from '../lib/schedule-week-reminder';

test('isolated live weekly bulk API: authentication, bounded atomic writes, stale conflict, vacation and ordinary month scope', {
  skip: process.env.SCHEDULE_REMINDER_TEST !== '1',
}, async () => {
  const dbUrl = new URL(process.env.DATABASE_URL!);
  assert.equal(dbUrl.hostname, '127.0.0.1');
  assert.equal(dbUrl.port, '55471');
  assert.equal(dbUrl.pathname, '/schedule_preview_20261026');
  assert.equal(process.env.PORTAL_SESSION_SECRET, 'schedule-preview-session-secret-local-only');
  const db = new PrismaClient();
  const url = 'http://127.0.0.1:3212/api/employee/workday/schedule/bulk';
  const today = getMoscowDateKey(), dates = requiredScheduleWeekDates(today), weekStart = schedulePlanningWeek(today);
  const prefix = `schedule-api-proof-${Date.now()}`;
  const ids: number[] = [];
  try {
    const own = await db.user.create({ data: { login: `${prefix}-own`, name: 'Учебный API', passwordHash: 'disabled', role: 'EMPLOYEE', department: 'retail' } });
    ids.push(own.id);
    const other = await db.user.create({ data: { login: `${prefix}-other`, name: 'Учебный коллега', passwordHash: 'disabled', role: 'EMPLOYEE', department: 'retail' } });
    ids.push(other.id);
    const cookie = `${sessionCookieName}=${createSessionToken(own.id)}`;
    const post = (body: unknown, authenticated = true) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authenticated ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
    const change = (date: string, status = 'off', previousStatus: string | null = null) => ({ date, status, previousStatus });
    const payload = { monthKey: today.slice(0, 7), mode: 'plan', confirmed: true, weekStart, changes: [change(today)] };
    assert.equal((await post(payload, false)).status, 401);
    for (const invalid of [
      { ...payload, confirmed: false },
      { ...payload, mode: 'fill' },
      { ...payload, weekStart: shiftScheduleDate(weekStart, 7) },
      { ...payload, changes: [change(shiftScheduleDate(today, -1))] },
      { ...payload, changes: [change(shiftScheduleDate(dates.at(-1)!, 1))] },
      { ...payload, changes: [change(today), change(today)] },
      { ...payload, changes: [{ date: today, status: 'working' }] },
    ]) assert.equal((await post(invalid)).status, 400);
    assert.equal(await db.workScheduleEntry.count({ where: { userId: own.id } }), 0);

    const saved = await post({ ...payload, userId: other.id, changes: [change(today, 'working'), change(dates.at(-1)!)] });
    assert.equal(saved.status, 200);
    assert.equal((await saved.json()).changedCount, 2);
    assert.equal(await db.workScheduleEntry.count({ where: { userId: other.id } }), 0, 'payload cannot address another employee');
    assert.deepEqual((await db.workScheduleEntry.findMany({ where: { userId: own.id }, orderBy: { date: 'asc' }, select: { date: true, status: true } })), [
      { date: today, status: 'working' }, { date: dates.at(-1)!, status: 'off' },
    ], 'only explicit dates change, including across a month boundary');

    const weeklySnapshot = await fetch(`http://127.0.0.1:3212/api/employee/workday/schedule?week=${weekStart}`, { headers: { Cookie: cookie } });
    assert.equal(weeklySnapshot.status, 200);
    const weeklyData = await weeklySnapshot.json();
    assert.equal(weeklyData.range.to, dates.at(-1));
    assert.equal(weeklyData.ownSchedule.length, 2);
    assert.equal((await fetch(`http://127.0.0.1:3212/api/employee/workday/schedule?week=${shiftScheduleDate(weekStart, 14)}`, { headers: { Cookie: cookie } })).status, 400);

    assert.ok(dates.length >= 3, 'fixture has a middle date for atomic conflict checks');
    const middle = dates[1];
    const auditCount = await db.workScheduleChange.count({ where: { userId: own.id } });
    const stale = await post({ ...payload, changes: [change(today, 'off', null), change(middle)] });
    assert.equal(stale.status, 409);
    assert.equal((await stale.json()).code, 'SCHEDULE_BULK_STALE');
    assert.equal(await db.workScheduleEntry.count({ where: { userId: own.id } }), 2, 'conflict rejects the whole batch');
    assert.equal(await db.workScheduleChange.count({ where: { userId: own.id } }), auditCount);

    await db.employeeVacation.create({ data: { userId: own.id, department: 'retail', dateFrom: middle, dateTo: middle, status: 'active', createdById: other.id, updatedById: other.id } });
    assert.equal((await post({ ...payload, changes: [change(middle)] })).status, 409, 'vacation cannot be overwritten by weekly selection');
    assert.equal(await db.workScheduleEntry.count({ where: { userId: own.id } }), 2);

    const outside = shiftScheduleDate(dates.at(-1)!, 1);
    const ordinary = await post({ monthKey: outside.slice(0, 7), mode: 'plan', confirmed: true, changes: [change(outside)] });
    assert.equal(ordinary.status, 200, 'ordinary month planning beyond the required week stays available');
    assert.equal((await post({ monthKey: outside.slice(0, 7), mode: 'plan', confirmed: true, changes: [change(shiftScheduleDate(outside, 32))] })).status, 400, 'ordinary saves still respect their month');
  } finally {
    await db.employeeVacation.deleteMany({ where: { userId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  }
});
