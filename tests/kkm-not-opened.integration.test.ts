import assert from 'node:assert/strict';
import test from 'node:test';

test('no-opening evidence updates only KKM audit, keeps cash/history and preserves unrelated credit tasks', { skip: process.env.KKM_NOT_OPENED_INTEGRATION !== '1' }, async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://postgres@127.0.0.1:55541/kkm_not_opened_demo');
  const { prisma: db } = await import('../lib/prisma');
  const { syncKkmShiftCloseIssue: sync } = await import('../lib/kkm-shift-close-control');
  const { findOpenRequiredWorkdayIssues } = await import('../lib/workday-required-issues');
  const now = new Date(), key = String(+now);
  const user = await db.user.create({ data: { login: 'not-opened-test-' + key, name: 'Учебный сотрудник', passwordHash: 'disabled', role: 'EMPLOYEE', department: 'retail' } });
  const day = await db.workDayEntry.create({ data: { userId: user.id, date: '2026-11-10', department: 'retail', shiftCode: '11_20', shiftLabel: '11–20', status: 'active', startedAt: new Date('2026-11-10T07:55:00Z') } });
  const run = await db.shiftControlRun.create({ data: { userId: user.id, workDayEntryId: day.id, date: day.date, department: 'retail' } });
  const original = { personalCash: { cashBalance: 12000 }, reserveCash: { cashBalance: 500 }, photos: { zReport: null }, cashRecountInputHistory: [{ value: 12000, enteredAt: now.toISOString() }] };
  const task = await db.shiftControlTask.create({ data: { runId: run.id, title: 'Сдать смену', category: 'handover', sortOrder: 1, handoverData: original } });
  const evidence: any = { status: 'unavailable', checkedAt: now.toISOString(), cashierRef: 'cashier', cashRegisterRef: 'kkm', cashRegisterName: 'Учебная ККМ', kktRegistrationNumber: 'kkt', oneCShiftNumber: '', fiscalShiftNumber: '', oneCOpenedAt: '', oneCClosedAt: '', ofdOpenedAt: '', ofdClosedAt: '', ofdDocumentLink: '', sourceError: 'Техническая проверка' };
  const input = { userId: user.id, taskId: task.id, workDayEntryId: day.id, date: day.date, now, evidence };
  try {
    await db.shiftControlTask.update({ where: { id: task.id }, data: { handoverData: { ...original, kkmCloseCheck: { status: 'unavailable', evidence } } } });
    const first = await sync(db, input);
    const credit = await db.workdayControlIssue.create({ data: { userId: user.id, fingerprint: 'credit-test-' + key, ruleKey: 'credit_realization_mismatch', severity: 'warning', status: 'open', title: 'Кредитный чек', detail: 'Отдельная проверка', employeeActionRequired: true, originDate: day.date } });
    await db.workdayNotification.create({ data: { userId: user.id, issueId: first!.id, fingerprint: 'kkm-not-opened-test-' + key, kind: 'issue_reminder', title: 'Подтвердите кассу', body: 'Тест', scheduledAt: now } });
    await sync(db, { ...input, evidence: { ...evidence, status: 'one_c_not_opened', sourceError: 'ОФД недоступен' } });
    let saved = await db.workdayControlIssue.findUniqueOrThrow({ where: { id: first!.id } });
    assert.equal(saved.status, 'open'); assert.equal(saved.employeeActionRequired, false);
    let data: any = (await db.shiftControlTask.findUniqueOrThrow({ where: { id: task.id } })).handoverData;
    assert.equal(data.kkmCloseCheck.status, 'one_c_not_opened');
    await sync(db, { ...input, evidence: { ...evidence, status: 'not_opened', sourceError: '' } });
    saved = await db.workdayControlIssue.findUniqueOrThrow({ where: { id: first!.id } });
    assert.equal(saved.status, 'resolved'); assert.equal((saved.sourceData as any).status, 'not_opened');
    data = (await db.shiftControlTask.findUniqueOrThrow({ where: { id: task.id } })).handoverData;
    assert.equal(data.kkmCloseCheck.status, 'not_opened'); assert.equal(data.kkmCloseCheck.firstEvidence.status, 'unavailable');
    for (const field of Object.keys(original)) assert.deepEqual(data[field], original[field as keyof typeof original]);
    assert.deepEqual((await findOpenRequiredWorkdayIssues(db, user.id)).map(i => i.id), [credit.id]);
    assert.equal((await db.workDayEntry.findUniqueOrThrow({ where: { id: day.id } })).endedAt, null);
    assert.equal(await db.workdayNotification.count({ where: { issueId: first!.id, status: 'pending' } }), 0);
  } finally {
    const issues = await db.workdayControlIssue.findMany({ where: { userId: user.id }, select: { id: true } });
    await db.adminInboxEvent.deleteMany({ where: { sourceType: 'workday_control_issue', sourceId: { in: issues.map(i => String(i.id)) } } });
    await db.user.delete({ where: { id: user.id } }); await db.$disconnect();
  }
});
