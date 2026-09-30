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
