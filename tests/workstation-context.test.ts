import assert from 'node:assert/strict';
import test from 'node:test';
import { attributeTerminalFiscalEmployee, suggestTerminalFiscalCashierMappings } from '../lib/terminal-fiscal-attribution';
import { terminalFiscalMappingConflictFields } from '../lib/terminal-fiscal-mapping-validation';
import {
  claimWorkstationDevice,
  createWorkstationProvisioningCode,
  hashWorkstationToken,
  isWorkstationAssignmentRace,
  normalizeWorkstationProvisioningCode,
  openWorkstationAssignment,
  planWorkstationAssignment,
  resolveWorkstationContext,
} from '../lib/workstation-context';

const from = new Date('2026-08-17T06:00:00.000Z');

test('shared 1C acquiring terminal is allowed for independent physical chains', () => {
  const first = {
    terminalKey: 'terminal-1', oneCAcquiringTerminalRef: 'shared-acquiring', oneCCashRegisterRef: 'kkm-1',
    kktRegistrationNumber: 'kkt-1', effectiveFrom: from, effectiveTo: null,
  };
  const second = {
    terminalKey: 'terminal-2', oneCAcquiringTerminalRef: 'shared-acquiring', oneCCashRegisterRef: 'kkm-2',
    kktRegistrationNumber: 'kkt-2', effectiveFrom: from, effectiveTo: null,
  };
  assert.deepEqual(terminalFiscalMappingConflictFields(second, first), []);
});

test('mapping rejects only overlapping physical identifiers and permits historical reuse', () => {
  const existing = {
    terminalKey: 'terminal-1', oneCAcquiringTerminalRef: 'shared', oneCCashRegisterRef: 'kkm-1',
    kktRegistrationNumber: 'kkt-1', effectiveFrom: from, effectiveTo: new Date('2026-08-18T00:00:00.000Z'),
  };
  const overlapping = { ...existing, oneCAcquiringTerminalRef: 'other', effectiveFrom: new Date('2026-08-17T12:00:00.000Z'), effectiveTo: null };
  assert.deepEqual(terminalFiscalMappingConflictFields(overlapping, existing), ['terminalKey', 'oneCCashRegisterRef', 'kktRegistrationNumber']);
  const later = { ...overlapping, effectiveFrom: new Date('2026-08-18T00:00:00.000Z') };
  assert.deepEqual(terminalFiscalMappingConflictFields(later, existing), []);
});

test('workstation token is stored as a deterministic hash, not as raw credential', () => {
  const token = 'local-device-secret';
  const digest = hashWorkstationToken(token);
  assert.match(digest, /^[a-f0-9]{64}$/);
  assert.notEqual(digest, token);
});

test('workstation provisioning code is human-readable, normalized and sufficiently random in shape', () => {
  const code = createWorkstationProvisioningCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(normalizeWorkstationProvisioningCode(code.toLowerCase()), code.replaceAll('-', ''));
});

test('single-use workstation provisioning atomically rotates to a persistent device credential', async () => {
  const code = 'ABCD-EFGH-JKLM';
  const now = new Date('2026-08-17T18:00:00.000Z');
  const updates: any[] = [];
  const db: any = {
    workstationDeviceBinding: {
      findUnique: async ({ where }: any) => where.tokenHash === hashWorkstationToken('ABCDEFGHJKLM') ? {
        id: 'binding-1', isActive: true, revokedAt: null, boundAt: null,
        provisioningExpiresAt: new Date('2026-08-17T18:30:00.000Z'),
        workstation: { id: 'ws-1', code: 'retail-1', label: 'Розница 1', isActive: true },
      } : null,
      updateMany: async (input: any) => { updates.push(input); return { count: 1 }; },
    },
  };
  const result = await claimWorkstationDevice(db, { code, now });
  assert.equal(result.status, 'bound');
  if (result.status !== 'bound') return;
  assert.notEqual(result.deviceToken, code);
  assert.equal(updates[0].data.boundAt, now);
  assert.equal(updates[0].data.tokenHash, hashWorkstationToken(result.deviceToken));
  assert.notEqual(updates[0].data.tokenHash, hashWorkstationToken('ABCDEFGHJKLM'));
});

test('expired or concurrently consumed workstation provisioning code fails closed', async () => {
  const code = 'ABCD-EFGH-JKLM';
  const base = {
    id: 'binding-1', isActive: true, revokedAt: null, boundAt: null,
    workstation: { id: 'ws-1', code: 'retail-1', label: 'Розница 1', isActive: true },
  };
  const expired: any = {
    workstationDeviceBinding: {
      findUnique: async () => ({ ...base, provisioningExpiresAt: new Date('2026-08-17T17:59:59.000Z') }),
      updateMany: async () => ({ count: 1 }),
    },
  };
  assert.deepEqual(await claimWorkstationDevice(expired, { code, now: new Date('2026-08-17T18:00:00.000Z') }), { status: 'invalid' });
  const raced: any = {
    workstationDeviceBinding: {
      findUnique: async () => ({ ...base, provisioningExpiresAt: new Date('2026-08-17T18:30:00.000Z') }),
      updateMany: async () => ({ count: 0 }),
    },
  };
  assert.deepEqual(await claimWorkstationDevice(raced, { code, now: new Date('2026-08-17T18:00:00.000Z') }), { status: 'invalid' });
});

test('only a database uniqueness race is eligible for safe assignment retry', () => {
  assert.equal(isWorkstationAssignmentRace({ code: 'P2002' }), true);
  assert.equal(isWorkstationAssignmentRace({ code: 'P2025' }), false);
  assert.equal(isWorkstationAssignmentRace(new Error('conflict')), false);
});

test('assignment planner reuses the same shift and rejects a concurrently occupied workstation', () => {
  assert.deepEqual(planWorkstationAssignment({
    userId: 5, workDayEntryId: 20, workstationId: 'retail-1',
    activeAssignments: [{ id: 1, userId: 5, workstationId: 'retail-1', workDayEntryId: 20, workDayEndedAt: null }],
  }), { action: 'reuse', assignmentId: 1 });
  assert.deepEqual(planWorkstationAssignment({
    userId: 5, workDayEntryId: 20, workstationId: 'retail-1',
    activeAssignments: [{ id: 1, userId: 3, workstationId: 'retail-1', workDayEntryId: 19, workDayEndedAt: null }],
  }), { action: 'conflict', reason: 'workstation_occupied', employeeId: 3 });
});

test('assignment planner closes an old employee workstation on an explicit switch and ignores completed shifts', () => {
  assert.deepEqual(planWorkstationAssignment({
    userId: 5, workDayEntryId: 20, workstationId: 'retail-2',
    activeAssignments: [
      { id: 1, userId: 5, workstationId: 'retail-1', workDayEntryId: 20, workDayEndedAt: null },
      { id: 2, userId: 3, workstationId: 'retail-2', workDayEntryId: 18, workDayEndedAt: new Date('2026-08-16T18:00:00.000Z') },
    ],
  }), { action: 'create', closeAssignmentIds: [1] });
});

test('1C cashier remains primary and conflicting workstation context is not personalized', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'mismatch', reasonCode: 'OFD_TOTAL_AMOUNT_MISMATCH', bankOperationAt: new Date('2026-08-17T09:00:00.000Z'),
    oneCCashRegisterRef: 'kkm-1', workstationId: 'retail-1', oneCCashierRef: 'cashier-magomed',
  }, [{ userId: 5, oneCCashierRef: 'cashier-magomed' }], [{
    userId: 3, oneCCashRegisterRef: 'kkm-1', workstationId: 'retail-1', source: 'device_login', effectiveFrom: from, effectiveTo: null,
  }]);
  assert.deepEqual(result, { employeeId: null, effectiveStatus: 'needs_review', source: 'conflict', adminProblem: true });
});

test('bank operation without a 1C check uses only proven workstation context and stays admin needs_review', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND', bankOperationAt: new Date('2026-08-17T09:00:00.000Z'),
    oneCCashRegisterRef: 'kkm-1', workstationId: 'retail-1', oneCCashierRef: null,
  }, [], [{
    userId: 5, oneCCashRegisterRef: 'kkm-1', workstationId: 'retail-1', source: 'device_login', effectiveFrom: from, effectiveTo: null,
  }]);
  assert.deepEqual(result, { employeeId: 5, effectiveStatus: 'needs_review', source: 'workstation_context', adminProblem: true });
});

test('legacy KKM-only assignment never personalizes a missing 1C check', () => {
  const result = attributeTerminalFiscalEmployee({
    status: 'needs_review', reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND', bankOperationAt: new Date('2026-08-17T09:00:00.000Z'),
    oneCCashRegisterRef: 'kkm-1', oneCCashierRef: null,
  }, [], [{ userId: 5, oneCCashRegisterRef: 'kkm-1', source: 'manual', effectiveFrom: from, effectiveTo: null }]);
  assert.equal(result.employeeId, null);
});

test('Magomed cashier ref preview is unambiguous only for Employee 5 and still requires confirmation', () => {
  assert.deepEqual(suggestTerminalFiscalCashierMappings([
    { ref: '0ae3-confirmed-3daf', name: 'Костеренко Магомед' },
  ], [
    { userId: 3, name: 'Чеченова Милана' },
    { userId: 4, name: 'Абшаева Зухра' },
    { userId: 5, name: 'Костеренко Магомед' },
  ]), [{
    cashierRef: '0ae3-confirmed-3daf', cashierName: 'Костеренко Магомед', employeeId: 5,
    candidateCount: 1, confirmationRequired: true,
  }]);
});

test('runtime context resolves only an active hashed device binding', async () => {
  const token = 'bound-device';
  const db: any = {
    workstationDeviceBinding: {
      findUnique: async ({ where }: any) => where.tokenHash === hashWorkstationToken(token)
        ? { id: 'binding-1', isActive: true, boundAt: new Date(), revokedAt: null, workstation: { id: 'ws-1', code: 'retail-1', isActive: true } }
        : null,
    },
    retailWorkstation: { findUnique: async () => null },
  };
  const context = await resolveWorkstationContext(db, { token });
  assert.equal(context.status, 'resolved');
  assert.equal(context.source, 'device_login');
  assert.equal(context.workstation?.code, 'retail-1');
});

test('runtime assignment closes completed and switched intervals before creating one idempotent row', async () => {
  const updates: any[] = [];
  const updateMany: any[] = [];
  const creates: any[] = [];
  const tx: any = {
    workdayKkmAssignment: {
      findMany: async () => [
        { id: 1, userId: 3, workstationId: 'ws-2', workDayEntryId: 18, workDayEntry: { endedAt: new Date('2026-08-16T18:00:00.000Z') } },
        { id: 2, userId: 5, workstationId: 'ws-1', workDayEntryId: 20, workDayEntry: { endedAt: null } },
      ],
      update: async (input: any) => { updates.push(input); return input; },
      updateMany: async (input: any) => { updateMany.push(input); return { count: 1 }; },
      create: async (input: any) => { creates.push(input); return { id: 3 }; },
    },
  };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const result = await openWorkstationAssignment(db, {
    userId: 5, date: '2026-08-17', workDayEntryId: 20, shiftCode: 'first',
    workstation: { id: 'ws-2' },
    equipment: { oneCCashRegisterRef: 'kkm-2', oneCCashRegisterName: 'ККМ 2' },
    deviceBindingId: 'binding-2', source: 'device_login', now: new Date('2026-08-17T06:00:00.000Z'),
  });
  assert.deepEqual(result, { action: 'created', assignmentId: 3 });
  assert.equal(updates[0].data.changeReason, 'workday_completed');
  assert.deepEqual(updateMany[0].where.id.in, [2]);
  assert.equal(creates[0].data.assignedById, null);
  assert.equal(creates[0].data.workstationId, 'ws-2');
});

test('a workstation assignment remains valid while no KKM is attached', async () => {
  const creates: any[] = [];
  const tx: any = {
    workdayKkmAssignment: {
      findMany: async () => [],
      update: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: async (input: any) => { creates.push(input); return { id: 4 }; },
    },
  };
  const db: any = { $transaction: async (callback: any) => callback(tx) };
  const result = await openWorkstationAssignment(db, {
    userId: 5, date: '2026-08-17', workDayEntryId: 21, shiftCode: 'first',
    workstation: { id: 'ws-2' }, deviceBindingId: 'binding-2', source: 'device_login', now: from,
  });
  assert.deepEqual(result, { action: 'created', assignmentId: 4 });
  assert.equal(creates[0].data.oneCCashRegisterRef, null);
  assert.equal(creates[0].data.oneCCashRegisterName, null);
});
