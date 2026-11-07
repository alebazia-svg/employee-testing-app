import test from 'node:test';
import assert from 'node:assert/strict';
import { WORK_HELP_VERSION, validWorkHelpAcknowledgement, workHelpSnapshot } from '../lib/employee-work-help';
import { scheduleNearReminder } from '../lib/schedule-near-reminder';
const near = (entries: Array<{date:string;status:string}> = []) => scheduleNearReminder({ today: '2026-11-07', entries, vacations: [] });
test('help is due only for missing today/tomorrow and repeats by Moscow calendar day', () => {
  const now = new Date('2026-11-07T08:00:00Z');
  assert.equal(workHelpSnapshot(near(), null, now).due, true);
  assert.equal(workHelpSnapshot(near(), new Date('2026-11-07T00:01:00Z'), now).due, false);
  assert.equal(workHelpSnapshot(near(), new Date('2026-11-06T20:59:00Z'), now).due, true);
  assert.equal(workHelpSnapshot(near(), new Date('2026-11-06T21:01:00Z'), now).due, false);
});
test('one-day fill changes the target; completing both removes help independently of acknowledgement', () => {
  const now = new Date('2026-11-07T08:00:00Z');
  assert.deepEqual(workHelpSnapshot(near([{date:'2026-11-07',status:'off'}]), null, now).missingDates, ['2026-11-08']);
  const complete = near([{date:'2026-11-07',status:'off'},{date:'2026-11-08',status:'working'}]);
  assert.equal(workHelpSnapshot(complete, null, now).due, false);
  assert.deepEqual(workHelpSnapshot(complete, null, now).missingDates, []);
});
test('acknowledgement is exact and cannot accept a client user, date, or version', () => {
  assert.equal(validWorkHelpAcknowledgement({version:WORK_HELP_VERSION}), true);
  for(const input of [null, [], {}, {version:'unknown'}, {version:WORK_HELP_VERSION,userId:1}, {version:WORK_HELP_VERSION,at:'2026-11-08'}]) assert.equal(validWorkHelpAcknowledgement(input), false);
});
