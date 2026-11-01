import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaxLimitEvidencePanel } from '../components/taxes/TaxLimitEvidencePanel';
import type { PortalReport } from '../lib/ausn-portal-view';
import type { IncomeEvidenceReview } from '../lib/tax-income-evidence';
Object.assign(globalThis, { React });
const report = { available: true, kind: 'full', year: '2026', usnBaseline: 2_404_309, totalIncome: 53_398_115.20, remaining: 6_601_884.80 } as PortalReport;
const review = { schema: 1, title: 'Проверка', reviewedAt: '2026-11-01T00:00:00Z', cases: [], fnsSnapshot: { year: '2026', from: '2026-04-01', through: '2026-11-01', exportedAt: '2026-11-01T09:51:00Z', incomeCents: 4_523_366_248, sourceDocumentId: 'verified-source' } } as IncomeEvidenceReview;
const render = (r?: PortalReport, v?: IncomeEvidenceReview) => renderToStaticMarkup(<TaxLimitEvidencePanel report={r} review={v} reconciliationHref='/admin/taxes?tab=reconciliation' />);
test('available canonical report cannot become a verified actual or pure-1C balance', () => {
 const html = render(report, review);
 assert.match(html, /Фактические оплаты — основной показатель/);
 assert.match(html, /Отдельный итог 1С не выделен/);
 assert.match(html, /Фактический остаток не подтверждён/);
 assert.doesNotMatch(html, /6.?601.?884|Для планирования/);
 assert.match(html, /12.*362.*028,52/);
 assert.match(html, /Дополнительный сценарий ВТБ, не фактический остаток/);
});
test('missing or partial FNS evidence never becomes zero or a fabricated real balance', () => {
 for (const [r,v] of [[undefined,undefined],[report,undefined],[{...report,kind:'month'},review]] as Array<[PortalReport|undefined,IncomeEvidenceReview|undefined]>) {
  const html=render(r,v);
  assert.match(html,/Нет проверенной выгрузки/);
  assert.match(html,/Не подтверждён/);
  assert.doesNotMatch(html,/12.*362.*028,52|0,00 ₽/);
 }
});
