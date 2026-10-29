import assert from 'node:assert/strict';
import test from 'node:test';
import { actualColleagueWorkday, colleaguePresence } from '../lib/workday-presence';

test('actual workday state takes priority over the planned schedule', () => {
  assert.equal(colleaguePresence('off', { status: 'active', endedAt: null }), 'active');
  assert.equal(colleaguePresence('working', { status: 'completed', endedAt: '2026-08-21T17:00:00.000Z' }), 'completed');
});

test('planned schedule is used only when there is no factual workday', () => {
  assert.equal(colleaguePresence('working', null), 'scheduled');
  assert.equal(colleaguePresence('off', null), 'off');
  assert.equal(colleaguePresence(undefined, null), 'missing');
});

test('an unfinished missing-checkout workday remains active for its date', () => {
  assert.equal(colleaguePresence('working', { status: 'missing_checkout', endedAt: null }), 'active');
});

test('attendance colleagues show actual Moscow start/end instead of an other shift label', () => {
  const startedAt = '2026-10-29T05:43:00Z';
  assert.equal(actualColleagueWorkday({ status: 'completed', startedAt, endedAt: '2026-10-29T15:12:00Z' }), '08:43–18:12');
  assert.equal(actualColleagueWorkday({ status: 'active', startedAt, endedAt: null }), 'С 08:43 · день не завершён');
  assert.equal(actualColleagueWorkday({ status: 'missing_checkout', startedAt, endedAt: null }), 'С 08:43 · день не завершён');
  assert.equal(actualColleagueWorkday({ status: 'completed', startedAt, endedAt: null }), 'С 08:43 · окончание не указано');
  assert.equal(actualColleagueWorkday({ status: 'active', startedAt: 'invalid', endedAt: null }), null);
  assert.equal(actualColleagueWorkday(null), null);
});
