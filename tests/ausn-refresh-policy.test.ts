import test from 'node:test';
import assert from 'node:assert/strict';
import { ausnRefreshState } from '../lib/ausn-refresh-policy';
import { parsePortalReport } from '../lib/ausn-portal-view';
import { portalFixture } from './ausn-portal-fixture';
const now = new Date('2026-10-26T12:00:00Z');
const full = parsePortalReport(portalFixture({ run: '2026-10-26T10:00:00Z' }));
const current = { ...full, kind: 'month' as const, periodKey: '2026-10' };
test('freshness requires both latest scopes; failure and stale year cannot hide behind current', () => {
  assert.equal(ausnRefreshState([full,current],now).fresh,true);
  assert.equal(ausnRefreshState([current],now).fresh,false);
  assert.equal(ausnRefreshState([{...full,available:false},full,current],now).fresh,false);
  assert.equal(ausnRefreshState([{...full,runTimeUtc:'2026-10-24T10:00:00Z'},current],now).fresh,false);
});
test('background source dates survive parsing without changing canonical totals', () => {
 const appended = portalFixture()+'\n## Фоновое обновление источников\n\n| Источник | Период | Проверен UTC | Чтение | Изменение |\n| --- | --- | --- | --- | --- |\n| bank | 2026-04-01–2026-04-30 | 2026-10-20T10:00:00+00:00 | saved | нет |\n';
 const result = parsePortalReport(appended);
 assert.equal(result.available,true,result.reason);
 assert.equal(result.totalIncome,parsePortalReport(portalFixture()).totalIncome);
 assert.equal(result.sourceChecks?.[0].mode,'saved');
 assert.equal(parsePortalReport(appended.replace('2026-10-20T10:00:00+00:00','bad')).available,false);
});
