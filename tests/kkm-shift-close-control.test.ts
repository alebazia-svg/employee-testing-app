import assert from 'node:assert/strict';
import test from 'node:test';
import { kkmShiftCloseOneCPeriod, readKkmShiftCloseSimulation, simulateKkmShiftClose, simulatedKkmShiftCloseAutoCheck } from '../lib/kkm-shift-close-control';

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

test('admin QA check uses the exact stored simulated KKM result', () => {
  const confirmed = simulateKkmShiftClose({ scenario: 'confirmed', activatedAt });
  assert.deepEqual(simulatedKkmShiftCloseAutoCheck({ evidence: confirmed }), {
    status: 'matched',
    summary: 'Dev/Test: закрытие ККМ подтверждено.',
    evidence: 'Dev/Test: результат проверки кассы сохранён.',
  });
  const open = simulateKkmShiftClose({ scenario: 'one_c_open', activatedAt });
  assert.equal(simulatedKkmShiftCloseAutoCheck({ evidence: open })?.status, 'mismatch');
  assert.equal(simulatedKkmShiftCloseAutoCheck({ evidence: { ...confirmed, simulated: false } }), null);
});
