import assert from 'node:assert/strict';
import test from 'node:test';
import { pushAskAllowed, weekSheetAutoAllowed, weekSheetCanSave, weekSheetChanges, weekSheetDays, weekSheetRequests } from '../lib/schedule-week-sheet';

const today = '2026-11-09'; // Monday

test('week sheet starts from tomorrow and hides a day already marked today', () => {
  const days = weekSheetDays({ today, entries: [{ date: today, status: 'working' }], vacations: [], includeToday: true });
  assert.equal(days[0].date, '2026-11-10');
  assert.ok(days[0].highlight);
  assert.ok(!days.some((d) => d.date === today));
});

test('unmarked today is listed only when asked', () => {
  assert.equal(weekSheetDays({ today, entries: [], vacations: [], includeToday: true })[0].date, today);
  assert.equal(weekSheetDays({ today, entries: [], vacations: [], includeToday: false })[0].date, '2026-11-10');
});

test('vacation days are not editable and tomorrow on vacation is not required', () => {
  const days = weekSheetDays({ today, entries: [], vacations: [{ dateFrom: '2026-11-10', dateTo: '2026-11-12' }], includeToday: false });
  assert.ok(days[0].vacation);
  assert.ok(weekSheetCanSave(days, {}));
  assert.deepEqual(weekSheetChanges(days, { '2026-11-10': 'working' }), []);
});

test('tomorrow must be answered; only real changes are sent, grouped per week', () => {
  const days = weekSheetDays({ today: '2026-11-13', entries: [{ date: '2026-11-15', status: 'off' }], vacations: [], includeToday: false });
  assert.equal(weekSheetCanSave(days, {}), false);
  const draft = { [days[0].date]: 'working' as const, '2026-11-15': 'off' as const, '2026-11-16': 'working' as const };
  const changes = weekSheetChanges(days, draft);
  assert.ok(!changes.some((c) => c.date === '2026-11-15'));
  const requests = weekSheetRequests(changes);
  assert.ok(requests.length >= 1);
  assert.equal(requests.reduce((n, r) => n + r.changes.length, 0), changes.length);
});

test('automatic opening is limited to twice a day; push ask to three different days', () => {
  assert.ok(weekSheetAutoAllowed(0) && weekSheetAutoAllowed(1) && !weekSheetAutoAllowed(2));
  assert.ok(pushAskAllowed([], today));
  assert.ok(!pushAskAllowed([today], today));
  assert.ok(!pushAskAllowed(['2026-11-05', '2026-11-06', '2026-11-07'], today));
});
