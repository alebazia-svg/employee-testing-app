import assert from 'node:assert/strict';
import test from 'node:test';
import {
  kkmShiftCloseOneCPeriod,
  kkmShiftCloseRequiresEmployeeAction,
  readKkmShiftCloseSimulation,
  simulateKkmShiftClose,
  syncKkmShiftCloseIssue,
} from '../lib/kkm-shift-close-control';

test('1C KKM check period uses an exclusive next-day upper bound', () => {
  assert.deepEqual(kkmShiftCloseOneCPeriod('2026-08-26'), {
    fromDate: '2026-08-26',
    toDate: '2026-08-27',
  });
});

const activatedAt = '2026-08-26T10:00:00.000Z';

test('accepts only a known and dated KKM close simulation', () => {
  assert.deepEqual(readKkmShiftCloseSimulation({ scenario: 'ofd_missing', activatedAt }), { scenario: 'ofd_missing', activatedAt });
  assert.equal(readKkmShiftCloseSimulation({ scenario: 'unknown', activatedAt }), null);
  assert.equal(readKkmShiftCloseSimulation({ scenario: 'confirmed', activatedAt: 'bad-date' }), null);
});

test('delayed simulation confirms only after its propagation delay', () => {
  const simulation = { scenario: 'delayed' as const, activatedAt };
  assert.equal(simulateKkmShiftClose(simulation, new Date('2026-08-26T10:00:44.999Z')).status, 'ofd_missing');
  assert.equal(simulateKkmShiftClose(simulation, new Date('2026-08-26T10:00:45.000Z')).status, 'confirmed');
});

test('failure simulations remain fail-closed and visibly simulated', () => {
  const evidence = simulateKkmShiftClose({ scenario: 'ofd_unavailable', activatedAt }, new Date('2026-08-26T10:02:00.000Z'));
  assert.equal(evidence.status, 'unavailable');
  assert.equal(evidence.simulated, true);
  assert.match(evidence.sourceError, /Dev\/Test/);
});

test('only a proven open shift or missing Z-report requires employee action', () => {
  const base = simulateKkmShiftClose({ scenario: 'ofd_unavailable', activatedAt }, new Date('2026-08-26T10:02:00.000Z'));
  assert.equal(kkmShiftCloseRequiresEmployeeAction(base), false);
  assert.equal(kkmShiftCloseRequiresEmployeeAction({ ...base, status: 'one_c_open' }), true);
  assert.equal(kkmShiftCloseRequiresEmployeeAction({ ...base, status: 'ofd_missing' }), true);
  assert.equal(kkmShiftCloseRequiresEmployeeAction({ ...base, status: 'confirmed' }), false);
});

test('technical KKT uncertainty becomes admin-only and keeps the original incident date', async () => {
  const detectedAt = new Date('2026-09-18T17:35:49.539Z');
  const now = new Date('2026-09-30T15:10:01.742Z');
  const evidence = simulateKkmShiftClose({ scenario: 'ofd_unavailable', activatedAt }, now);
  let issueUpdate: any = null;
  let notificationUpdate: any = null;
  let eventUpdate: any = null;
  const db: any = {
    workdayControlIssue: {
      findUnique: async () => ({ id: 8057, status: 'open', detectedAt }),
      upsert: async ({ update }: any) => {
        issueUpdate = update;
        return { id: 8057, detectedAt };
      },
    },
    workdayNotification: {
      updateMany: async (args: any) => {
        notificationUpdate = args;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async () => ({ name: 'Чеченова Милана' }),
      findMany: async () => [{ id: 1 }],
    },
    adminInboxEvent: {
      upsert: async ({ update }: any) => {
        eventUpdate = update;
        return { id: 'event-1' };
      },
    },
    adminInboxReceipt: { createMany: async () => ({ count: 1 }) },
  };

  await syncKkmShiftCloseIssue(db, {
    userId: 3,
    taskId: 439,
    workDayEntryId: 96,
    date: '2026-09-18',
    evidence,
    now,
  });

  assert.equal(issueUpdate.employeeActionRequired, false);
  assert.equal(issueUpdate.severity, 'warning');
  assert.deepEqual(notificationUpdate.where, { issueId: 8057, status: 'pending' });
  assert.equal(notificationUpdate.data.status, 'cancelled');
  assert.equal(eventUpdate.occurredAt.toISOString(), detectedAt.toISOString());
});

test('OFD closes the exact fiscal shift even when 1C still reports it open', async () => {
  const { verifyEmployeeKkmShiftClose } = await import('../lib/kkm-shift-close-control');
  const db: any = { userOneCCashboxMapping: { findUnique: async () => ({ oneCCashierRef: 'cashier' }) } };
  const check = { cashier: { ref: 'cashier' }, cashRegisterRef: 'kkm', kktRegistrationNumber: 'kkt', dateTime: '2026-10-25T14:22:00+03:00' };
  const shift = { cashRegister: { ref: 'kkm', name: 'Касса' }, posted: true, deletionMark: false, number: '75', fiscalShiftNumber: '75', openedAt: '2026-10-25T08:48:00+03:00', closedAt: '', status: 'Открыта', datetime: '2026-10-25T08:48:00+03:00' };
  const report = { kktRegistrationNumber: 'kkt', shiftNumber: '75', openedAt: shift.openedAt, closedAt: '2026-10-25T17:52:00+03:00', documentLink: 'report' };
  let reports: any[] = [report], complete = true;
  const sources: any = {
    loadOneCKkmChecks: async () => ({ complete: true, data: [check] }),
    getCashShifts: async () => ({ ok: true, shifts: [shift] }),
    loadPlatformaOfdZReports: async () => ({ complete, data: reports }),
  };
  const verify = () => verifyEmployeeKkmShiftClose({ db, userId: 5, date: '2026-10-25' }, sources);
  const confirmed = await verify();
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.oneCClosedAt, '');
  assert.equal(confirmed.ofdClosedAt, report.closedAt);
  assert.equal(kkmShiftCloseRequiresEmployeeAction(confirmed), false);
  for (const invalid of [{ ...report, shiftNumber: '74' }, { ...report, kktRegistrationNumber: 'other' }, { ...report, closedAt: '2026-10-25T13:00:00+03:00' }, { ...report, closedAt: 'bad' }]) {
    reports = [invalid];
    assert.equal((await verify()).status, 'one_c_open');
  }
  reports = [report]; complete = false;
  assert.equal((await verify()).status, 'unavailable');
  complete = true; reports = [];
  assert.equal((await verify()).status, 'one_c_open');
  shift.status = 'Закрыта'; shift.closedAt = report.closedAt;
  assert.equal((await verify()).status, 'ofd_missing');
});

test('reopened shift closes by fiscal check time even when the 1C document clock is ahead', async () => {
  const { verifyEmployeeKkmShiftClose } = await import('../lib/kkm-shift-close-control');
  const db: any = { userOneCCashboxMapping: { findUnique: async () => ({ oneCCashierRef: 'cashier' }) } };
  const check = {
    cashier: { ref: 'cashier' }, cashRegisterRef: 'kkm', kktRegistrationNumber: 'kkt',
    dateTime: '2026-10-26T18:33:43+03:00', fiscalDateTime: '2026-10-26T18:26:00+03:00',
  };
  const shift = {
    cashRegister: { ref: 'kkm', name: 'Касса' }, posted: true, deletionMark: false,
    number: '1081', fiscalShiftNumber: '341', status: 'Закрыта',
    datetime: '2026-10-26T18:33:23+03:00', openedAt: '2026-10-26T18:33:23+03:00', closedAt: '2026-10-26T18:34:13+03:00',
  };
  const report = { kktRegistrationNumber: 'kkt', shiftNumber: '341', openedAt: '2026-10-26T18:25:00+03:00', closedAt: '2026-10-26T18:26:00+03:00', documentLink: 'report-341' };
  const previous = { ...report, shiftNumber: '340', openedAt: '2026-10-26T09:02:00+03:00', closedAt: '2026-10-26T18:02:00+03:00', documentLink: 'report-340' };
  let reports = [previous, report];
  const sources: any = {
    loadOneCKkmChecks: async () => ({ complete: true, data: [check] }),
    getCashShifts: async () => ({ ok: true, shifts: [shift, { ...shift, fiscalShiftNumber: '340', closedAt: '2026-10-26T18:09:56+03:00' }] }),
    loadPlatformaOfdZReports: async () => ({ complete: true, data: reports }),
  };
  const verify = () => verifyEmployeeKkmShiftClose({ db, userId: 4, date: '2026-10-26' }, sources);
  const evidence = await verify();
  assert.equal(evidence.status, 'confirmed');
  assert.equal(evidence.fiscalShiftNumber, '341');
  assert.equal(evidence.ofdDocumentLink, 'report-341');
  // First closure, another KKT, and closure before the fiscal check remain insufficient.
  for (const invalid of [previous, { ...report, kktRegistrationNumber: 'other' }, { ...report, closedAt: '2026-10-26T18:25:00+03:00' }]) {
    reports = [invalid];
    assert.equal((await verify()).status, 'ofd_missing');
  }
  reports = [report];
  // Without a fiscal timestamp retain the conservative document-time check.
  check.fiscalDateTime = '';
  assert.equal((await verify()).status, 'ofd_missing');
});
