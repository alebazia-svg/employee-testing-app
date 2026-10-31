import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require.extensions['.css'] = () => {};
// The product editor is closed in these cases; omit its unrelated navigation shell.
const shellPath = require.resolve('../components/AdminShell');
require.cache[shellPath] = { id: shellPath, filename: shellPath, loaded: true, exports: { AdminShell: () => null } } as NodeModule;
const { default: PayrollOverviewPreview } = require('../app/(dashboard)/admin/payroll/PayrollOverviewPreview');
import PayrollFinalOverview from '../app/(dashboard)/admin/payroll/PayrollFinalOverview';
import { requestPayrollControl } from '../lib/payroll-control-request';
import { payrollReviewPresentation, payrollEmployeeReviewPresentation } from '../lib/payroll-review-presentation';

Object.assign(globalThis, { React });
const noop = () => {};
test('blocked automatic overview explains why and retains a safe review download', () => {
  const html = renderToStaticMarkup(<PayrollOverviewPreview period='Октябрь 2026' date='31.10.2026' updatedAt='31.10.2026, 18:30:00' costVerified preliminary stale
    columns={[]} issues={[]} employeeIssues={[]} advancesValid={false} saveDisabled exportDisabled
    saveReasons={['Расходник 123: получатель не сопоставлен.']} exportReasons={['Аванс не подтверждён.']}
    onEmployee={noop} onSource={noop} onExport={noop} onSave={noop} onReviewExport={noop} onProducts={async () => []} onSaveProducts={async () => []} />);
  assert.match(html, /Рассчитано по 31.10.2026 включительно/);
  assert.match(html, /Себестоимость рассчитана в 1С/);
  assert.doesNotMatch(html, /Время указано по Москве|Продажи за более поздние|Замечания по себестоимости/);
  assert.match(html, /Не удалось обновить/);
  assert.match(html, /Расходник 123: получатель не сопоставлен/);
  assert.match(html, /Аванс не подтверждён/);
  assert.match(html, /Скачать для проверки/);
  assert.doesNotMatch(html, /Открытие источника не исправляет/);
});
test('final overview distinguishes source date from save date and handles legacy provenance', () => {
  const props = { employees: [], periodPicker: null, runNumber: 1, onEmployee: noop, onExport: noop, exporting: false, onCompare: noop, comparing: false };
  const saved = renderToStaticMarkup(<PayrollFinalOverview {...props} verifiedThrough='30.09.2026' savedAt='2026-10-01T21:30:00Z' />);
  assert.match(saved, /30.09.2026 включительно/);
  assert.match(saved, /02.10.2026, 00:30:00 МСК/);
  const legacy = renderToStaticMarkup(<PayrollFinalOverview {...props} />);
  assert.match(legacy, /Дата расчёта не указана/);
  assert.doesNotMatch(legacy, /Invalid Date/);
});
test('unmapped advance provides an actionable instruction without assigning it or bypassing payroll gates', () => {
  const info = payrollReviewPresentation('Расходник 00OF-001901: сотрудник «СтажерЗакупка» не сопоставлен.');
  assert.equal(info.title, 'Кому выдан аванс');
  assert.equal(info.target, 'advances');
  assert.match(info.reason, /00OF-001901/);
  assert.match(info.hint, /получателя.*в 1С/);
});

test('source lock conflict retries until success, with a bounded delay', async () => {
  const statuses = [409, 409, 200]; const delays: number[] = []; let calls = 0;
  const response = await requestPayrollControl(async () => new Response('', { status: statuses[calls++] }), () => true, async ms => { delays.push(ms); });
  assert.equal(response?.status, 200); assert.equal(calls, 3); assert.deepEqual(delays, [2000, 4000]);
});
test('persistent lock has a bound and source failures are not retried', async () => {
  let calls = 0;
  assert.equal((await requestPayrollControl(async () => { calls++; return new Response('', { status: 409 }); }, () => true, async () => {}))?.status, 409);
  assert.equal(calls, 4);
  calls = 0;
  assert.equal((await requestPayrollControl(async () => { calls++; return new Response('', { status: 503 }); }, () => true, async () => {}))?.status, 503);
  assert.equal(calls, 1);
});
test('switching the period cancels source retries and discards obsolete results', async () => {
  let current = true, calls = 0;
  const response = await requestPayrollControl(async () => { calls++; return new Response('', { status: 409 }); }, () => current, async () => { current = false; });
  assert.equal(response, null); assert.equal(calls, 1);
});

test('unknown cost state cannot be presented as calculated', () => {
  const html = renderToStaticMarkup(<PayrollOverviewPreview period='Октябрь' date='26.10.2026' preliminary stale columns={[]} issues={[]} employeeIssues={[]} advancesValid={false} exportDisabled onEmployee={noop} onSource={noop} onExport={noop} onProducts={async () => []} onSaveProducts={async () => []} />);
  assert.match(html, /Себестоимость требует проверки/);
  assert.doesNotMatch(html, /Себестоимость рассчитана в 1С/);
});
test('employee remarks explain the specific missing input', () => {
  assert.match(payrollEmployeeReviewPresentation('Не указаны опоздания').hint, /премия за дисциплину/);
  assert.match(payrollEmployeeReviewPresentation('Не заполнены дни').hint, /табелем/);
  assert.match(payrollEmployeeReviewPresentation('Агентские Finbox пока не внесены').hint, /Finbox/);
});
