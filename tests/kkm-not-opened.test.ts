import assert from 'node:assert/strict';
import test from 'node:test';
import { parseKkmShiftActivity, proveKkmNotOpened, proveKkmNotOpenedInOneC } from '../lib/kkm-not-opened';
import { verifyEmployeeKkmShiftClose, syncKkmShiftCloseIssue, kkmShiftCloseSatisfied, kkmShiftCloseAllowsHandover } from '../lib/kkm-shift-close-control';
import { hasConfirmedKkmCloseEvidence } from '../lib/kkm-close-confirmation';
import { handoverEventTitle, readHandoverContext } from '../lib/employee-handover-audit-policy';

const now = new Date('2026-11-10T18:00:00Z'), fresh = now.toISOString();
const from = '2026-11-10T00:00:00+03:00', through = '2026-11-10T17:00:00Z';
const history = { kktRegistrationNumber: 'kkt', from: '2026-11-04T00:00:00+03:00', to: '2026-11-11T00:00:00+03:00' };
function prior() { return { kktRegistrationNumber: 'kkt', fiscalDriveNumber: 'fn', shiftNumber: '99', openedAt: '2026-11-09T06:00:00Z', closedAt: '2026-11-09T17:00:00Z' }; }
function facts(): any {
  return { cashRegisterRef: 'kkm', kktRegistrationNumber: 'kkt', from, through, now,
    activity: { ...history, complete: true, checkedAt: fresh, data: [prior()] },
    shifts: { ok: true, complete: true, checkedAt: fresh, dateFrom: '2026-11-10', dateTo: '2026-11-10', shifts: [] },
    checks: { complete: true, absenceComplete: true, checkedAt: fresh, data: [] },
    receipts: { complete: true, absenceComplete: true, checkedAt: fresh, data: [] }, existingReports: [] };
}

test('no opening requires a recent prior fiscal closure plus complete empty current sources', () => {
  const f = facts(), before = structuredClone(f);
  const proof = proveKkmNotOpened(f);
  assert.equal(proof?.previousClosedAt, prior().closedAt); assert.equal(proof?.through, through);
  assert.deepEqual(f, before);
});

test('zero receipts cannot excuse an opened, empty, reopened or overnight shift', () => {
  const scenarios: Array<(f: any) => void> = [
    f => f.shifts.shifts.push({ cashRegister: { ref: 'kkm' }, posted: true, deletionMark: false, openedAt: '2026-11-10T08:00:00Z' }),
    f => f.shifts.shifts.push({ cashRegister: { ref: 'kkm' }, posted: false, deletionMark: false }),
    f => f.activity.data.push({ ...prior(), shiftNumber: '100', openedAt: '2026-11-10T06:00:00Z', closedAt: null }),
    f => f.activity.data.push({ ...prior(), shiftNumber: '100', openedAt: '2026-11-10T06:00:00Z', closedAt: '2026-11-10T10:00:00Z' }),
    f => f.activity.data.push({ ...prior(), shiftNumber: '100', openedAt: '2026-11-09T18:00:00Z', closedAt: null }),
    f => f.activity.data.push({ ...prior(), shiftNumber: '100', openedAt: '2026-11-09T18:00:00Z', closedAt: '2026-11-10T06:00:00Z' }),
    f => f.activity.data.push({ ...prior(), shiftNumber: '100', openedAt: '2026-11-09T18:00:00Z', closedAt: '2026-11-10T10:00:00Z' }, { ...prior(), shiftNumber: '101', openedAt: '2026-11-10T10:01:00Z', closedAt: null }),
  ];
  scenarios.forEach((change, i) => { const f = facts(); change(f); assert.equal(proveKkmNotOpened(f), null, `opened scenario ${i}`); });
});

test('missing, stale, conflicting, malformed or wrong-period evidence never proves absence', () => {
  const changes: Array<(f: any) => void> = [
    f => f.cashRegisterRef = '', f => f.kktRegistrationNumber = '',
    f => f.activity.data = [], f => f.activity.complete = false,
    f => f.receipts.complete = false, f => f.receipts.absenceComplete = undefined,
    f => f.checks.complete = false, f => f.checks.absenceComplete = undefined,
    f => f.shifts.complete = undefined, f => f.shifts.dateFrom = '2026-11-09',
    f => f.activity.checkedAt = '2026-11-10T17:00:00Z', f => f.shifts.checkedAt = '2026-11-10T17:00:00Z',
    f => f.activity.from = from, f => f.activity.to = '2026-11-09T17:00:00Z',
    f => f.activity.data[0].kktRegistrationNumber = 'foreign',
    f => f.activity.data.push({ ...prior(), fiscalDriveNumber: 'foreign-fn', shiftNumber: '98' }),
    f => f.activity.data.push(prior()), f => f.activity.data[0].openedAt = 'invalid',
    f => f.receipts.data.push({ kktRegistrationNumber: 'kkt' }),
    f => f.checks.data.push({ cashRegisterRef: 'kkm', kktRegistrationNumber: '' }),
    f => f.checks.data.push({ cashRegisterRef: '', kktRegistrationNumber: 'kkt' }),
    f => f.checks.data.push({ cashRegisterRef: '', kktRegistrationNumber: '' }),
    f => f.existingReports.push({ ...prior(), openedAt: '2026-11-10T06:00:00Z', closedAt: '2026-11-10T07:00:00Z' }),
  ];
  changes.forEach((change, i) => { const f = facts(); change(f); assert.equal(proveKkmNotOpened(f), null, `unknown scenario ${i}`); });
});

function body() {
  return { data: { zReports: [{ kkt: { registrationNumber: 'kkt', fiscalDriveNumber: 'fn' }, shiftNumber: 99, openedAt: prior().openedAt, closedAt: prior().closedAt }] },
    meta: { complete: true, warnings: [], fetchedAt: fresh, period: { fromUtc: history.from, toUtc: history.to, semantics: '[from,to)' } } };
}
test('opening-source parser retains an explicitly open shift instead of interpreting it as no shift', () => {
  const b = body(); b.data.zReports[0].closedAt = null as any;
  const parsed = parseKkmShiftActivity(b, history, now);
  assert.equal(parsed.complete, true); assert.equal(parsed.data[0].closedAt, null);
  const malformed: any[] = [null, { meta: { complete: true } }, { ...body(), data: {} }];
  for (const change of [ (b: any) => delete b.data.zReports[0].closedAt,
    (b: any) => b.meta.period.fromUtc = from, (b: any) => b.meta.complete = false,
    (b: any) => b.meta.warnings = ['partial'], (b: any) => b.meta.fetchedAt = '2026-11-10T17:00:00Z',
    (b: any) => b.data.zReports[0].kkt.registrationNumber = 'foreign',
    (b: any) => b.data.zReports.push(b.data.zReports[0]) ]) { const value = body(); change(value); malformed.push(value); }
  malformed.forEach(value => assert.equal(parseKkmShiftActivity(value, history, now).complete, false));
});

function scenario() {
  const date = '2026-11-10', checkedAt = new Date().toISOString();
  const day = { id: 1, userId: 4, date, startedAt: new Date(`${date}T07:55:00Z`), endedAt: new Date(`${date}T11:00:00Z`), user: { name: 'Абшаева Зухра', department: 'retail' } };
  let assignments: any[] = [];
  const db: any = { userOneCCashboxMapping: { findUnique: async () => ({ isActive: true, oneCCashierRef: 'cashier', oneCCashRegisterRef: 'kkm' }) },
    workDayEntry: { findUnique: async () => day }, workdayKkmAssignment: { findMany: async () => assignments },
    terminalFiscalMapping: { findMany: async () => [{ id: 'mapping', oneCCashRegisterRef: 'kkm', kktRegistrationNumber: 'kkt' }] } };
  const sources: any = { loadOneCKkmChecks: async () => ({ complete: true, absenceComplete: true, checkedAt, data: [] }),
    getCashShifts: async () => ({ ok: true, complete: true, checkedAt, dateFrom: date, dateTo: date, shifts: [] }),
    loadPlatformaOfdZReports: async () => ({ complete: true, checkedAt, data: [] }),
    loadPlatformaOfdReceipts: async () => ({ complete: true, absenceComplete: true, checkedAt, data: [] }),
    loadKkmShiftActivity: async (arg: any) => ({ ...arg, complete: true, checkedAt, data: [prior()] }) };
  return { db, day, sources, setAssignments: (value: any[]) => assignments = value, verify: () => verifyEmployeeKkmShiftClose({ db, userId: 4, date }, sources) };
}
test('verifier returns a distinct not_opened result, scoped to recorded workday and exact workplace', async () => {
  const s = scenario(); const result = await s.verify();
  assert.equal(result.status, 'not_opened'); assert.equal(result.notOpenedProof?.through, s.day.endedAt.toISOString());
  assert.equal(result.ofdClosedAt, ''); assert.equal(kkmShiftCloseSatisfied(result), true);
  assert.equal(hasConfirmedKkmCloseEvidence({ kkmCloseCheck: { status: result.status } }, [], { taskId: 1, userId: 4, date: '2026-11-10' }), false, 'not a fabricated fiscal closure');
  const changed = scenario(); changed.setAssignments([{ oneCCashRegisterRef: 'kkm', effectiveFrom: new Date() }, { oneCCashRegisterRef: 'another-kkm', effectiveFrom: new Date() }]);
  assert.notEqual((await changed.verify()).status, 'not_opened');
});
test('no mapped workplace or missing source keeps the existing technical state', async () => {
  const s = scenario(); s.db.terminalFiscalMapping.findMany = async () => [];
  assert.equal((await s.verify()).status, 'unavailable');
  const failed = scenario(); failed.sources.loadKkmShiftActivity = async () => { throw new Error('offline'); };
  assert.equal((await failed.verify()).status, 'unavailable');
});
test('not_opened resolves only the KKM issue and creates no new owner/employee event', async () => {
  let saved: any, obsolete = 0;
  const db: any = { workdayControlIssue: { findUnique: async () => ({ id: 10, status: 'open' }), update: async (arg: any) => saved = arg },
    workdayNotification: { updateMany: async () => ({ count: 1 }) },
    workdayCloseExceptionRequest: { findMany: async () => { obsolete++; return []; } } };
  const evidence = await scenario().verify();
  await syncKkmShiftCloseIssue(db, { userId: 4, taskId: 1, workDayEntryId: 2, date: '2026-11-10', evidence, now: new Date() });
  assert.equal(saved.data.status, 'resolved'); assert.equal(saved.data.sourceData.status, 'not_opened'); assert.equal(obsolete, 1);
  const none: any = { workdayControlIssue: { findUnique: async () => null } };
  assert.equal(await syncKkmShiftCloseIssue(none, { userId: 4, taskId: 1, workDayEntryId: 2, date: '2026-11-10', evidence, now: new Date() }), null);
});
test('activity log keeps not-opened distinct from a confirmed closing', () => {
  assert.match(handoverEventTitle('check_not_opened'), /не открывалась/);
  const context = { taskId: 1, attemptId: 'test-absence', stage: 'check_not_opened' };
  assert.ok(readHandoverContext(context, true)); assert.equal(readHandoverContext(context), null);
});

function oneCHistory(): any {
  return { ok: true, complete: true, checkedAt: fresh, dateFrom: '2026-11-04', dateTo: '2026-11-10', shifts: [
    { cashRegister: { ref: 'kkm' }, posted: true, deletionMark: false, status: 'Закрыта', openedAt: prior().openedAt, closedAt: prior().closedAt, fiscalShiftNumber: '99' },
  ] };
}
test('1C fallback proves only a provisional no-opening and requires closed previous shifts', () => {
  const f = facts(); f.shifts = oneCHistory();
  assert.ok(proveKkmNotOpenedInOneC(f));
  for (const change of [ (f: any) => f.shifts.complete = false, (f: any) => f.shifts.shifts = [],
    (f: any) => f.shifts.shifts[0].closedAt = '', (f: any) => f.shifts.shifts[0].posted = false,
    (f: any) => f.shifts.shifts.push({ ...f.shifts.shifts[0], openedAt: '2026-11-10T08:00:00Z', closedAt: '2026-11-10T09:00:00Z' }),
    (f: any) => f.checks.data.push({ sourceType: 'sale_check', cashRegisterRef: '', kktRegistrationNumber: '' }) ]) {
    const invalid = facts(); invalid.shifts = oneCHistory(); change(invalid); assert.equal(proveKkmNotOpenedInOneC(invalid), null);
  }
  assert.equal(kkmShiftCloseSatisfied({ status: 'one_c_not_opened' }), false);
  assert.equal(kkmShiftCloseAllowsHandover({ status: 'one_c_not_opened' }), true);
});
test('an unfiscalized credit document is distinct from a KKT operation, preserving its separate control', () => {
  const f = facts(); f.checks.data = [{ sourceType: 'credit_realization', cashRegisterRef: '', kktRegistrationNumber: '', fiscalState: 'unconfirmed', fiscalConflict: false }];
  const before = structuredClone(f.checks.data);
  assert.ok(proveKkmNotOpened(f)); f.shifts = oneCHistory(); assert.ok(proveKkmNotOpenedInOneC(f));
  assert.deepEqual(f.checks.data, before);
  f.checks.data[0].fiscalDocumentNumber = '123'; assert.equal(proveKkmNotOpenedInOneC(f), null);
});
test('unavailable OFD can use 1C, but a returned contradictory/open OFD result cannot', async () => {
  const s = scenario();
  s.sources.loadPlatformaOfdZReports = async () => ({ complete: false, data: [], errorCode: 'OFD_REQUEST_FAILED' });
  s.sources.getCashShifts = async (start: string) => ({ ...oneCHistory(), checkedAt: new Date().toISOString(), dateFrom: start, shifts: start === s.day.date ? [] : oneCHistory().shifts });
  const result = await s.verify(); assert.equal(result.status, 'one_c_not_opened'); assert.ok(result.oneCNotOpenedProof);
  s.sources.loadPlatformaOfdZReports = async () => ({ complete: false, data: [], errorCode: 'OFD_NORMALIZATION_FAILED' });
  assert.equal((await s.verify()).status, 'unavailable');
  s.sources.loadPlatformaOfdZReports = async () => ({ complete: true, data: [{ kktRegistrationNumber: 'kkt', fiscalDriveNumber: 'fn', shiftNumber: '100', openedAt: '2026-11-10T08:00:00Z', closedAt: '2026-11-10T09:00:00Z' }] });
  assert.notEqual((await s.verify()).status, 'one_c_not_opened', 'positive fiscal evidence takes precedence over empty 1C');
});
test('1C fallback remains an open ADMIN-only verification, never a fiscal resolution', async () => {
  let saved: any, event: any;
  const db: any = { workdayControlIssue: { findUnique: async () => null, upsert: async (arg: any) => { saved = arg.create; return { id: 10 }; } },
    workdayNotification: { updateMany: async () => ({ count: 0 }) }, user: { findUnique: async () => ({ name: 'Учебный сотрудник' }), findMany: async () => [{ id: 1 }] },
    adminInboxEvent: { upsert: async (arg: any) => { event = arg.create; return { id: 'inbox' }; } }, adminInboxReceipt: { createMany: async () => ({ count: 1 }) } };
  const base = await scenario().verify();
  await syncKkmShiftCloseIssue(db, { userId: 4, taskId: 1, workDayEntryId: 2, date: '2026-11-10', evidence: { ...base, status: 'one_c_not_opened' }, now: new Date() });
  assert.equal(saved.status, 'open'); assert.equal(saved.employeeActionRequired, false); assert.equal(saved.sourceData.ownerVerificationRequired, true);
  assert.match(event.title, /По 1С.*ОФД/);
});
