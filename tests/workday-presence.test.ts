import assert from 'node:assert/strict';
import test from 'node:test';
import { colleaguePresence } from '../lib/workday-presence';

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
