import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { accountingSnapshot, managementTotals, parseTaxManagementReview, type TaxManagementReview } from '../lib/tax-management-review';
import { loadTaxManagementReview } from '../lib/tax-management-review-source';
import { detectTaxDocumentCoverage } from '../lib/tax-document-upload';
import { TaxAccountingMonths, TaxManagementOverview, TaxManagementIncome, TaxManagementReconciliation, TaxManagementDocuments, TaxManagementAccounting } from '../components/taxes/TaxManagementReview';

const fixture = (): TaxManagementReview => ({ schema: 1, cutoff: '2026-05-31', reviewedAt: '2026-06-02', q1UsnCents: 100_000_000, q1PsnCents: 1_900_000_000,
  months: [{ periodKey: '2026-04', fnsCents: 3_000_000_000, paymentsCents: 4_100_000_000 }, { periodKey: '2026-05', fnsCents: 1_100_000_000, paymentsCents: 100_000_000 }],
  fnsCrossing: '2026-05-12', paymentsCrossing: '2026-04-29',
  bridge: [{ title: 'Разница', cents: 100_000_000, note: 'Не установленная недоимка' }],
  findings: [{ title: 'Проверка', status: 'open', detail: 'Требуется уникальная связь', action: 'Проверить договор', sourceName: 'source.zip' }],
  sources: [{ title: 'Источник', originalName: 'source.zip', purpose: 'Первичные документы' }],
});

test('Q1 includes both regimes once; monthly and bridge totals reconcile', () => {
  const parsed = parseTaxManagementReview(JSON.stringify(fixture()))!;
  assert.ok(parsed);
  assert.deepEqual([managementTotals(parsed).baseline, managementTotals(parsed).fns, managementTotals(parsed).payments], [2_000_000_000, 6_100_000_000, 6_200_000_000]);
  const missingMonth = fixture(); missingMonth.months[1].periodKey = '2026-06';
  assert.equal(parseTaxManagementReview(JSON.stringify(missingMonth)), undefined);
  const wrongBridge = fixture(); wrongBridge.bridge[0].cents++;
  assert.equal(parseTaxManagementReview(JSON.stringify(wrongBridge)), undefined);
  const wrongCrossing = fixture(); wrongCrossing.paymentsCrossing = '2026-05-01';
  assert.equal(parseTaxManagementReview(JSON.stringify(wrongCrossing)), undefined);
});

test('invalid dates, unsafe amounts and supplied download identities are rejected or discarded', () => {
  const invalid = fixture(); invalid.cutoff = '2026-02-30';
  assert.equal(parseTaxManagementReview(JSON.stringify(invalid)), undefined);
  const unsafe = fixture(); unsafe.q1PsnCents = Number.MAX_SAFE_INTEGER;
  assert.equal(parseTaxManagementReview(JSON.stringify(unsafe)), undefined);
  const supplied = fixture(); supplied.sources[0].documentId = '../../secret'; supplied.documentId = 'invented';
  const result = parseTaxManagementReview(JSON.stringify(supplied))!;
  assert.equal(result.documentId, undefined); assert.equal(result.sources[0].documentId, undefined);
});

test('archived review requires checksum and every authorized source; invalid latest never falls back', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'tax-manager-'));
  try {
    const zip = new JSZip(); zip.file('tax-management-review.json', JSON.stringify(fixture()));
    const bytes = await zip.generateAsync({ type: 'nodebuffer' }); await writeFile(path.join(root, 'review.zip'), bytes);
    const doc = { id: 'review', documentType: 'CORRECTION_EVIDENCE', status: 'UPLOADED', originalName: 'AUSN_management_review_test.zip', storageKey: 'review.zip', sha256: createHash('sha256').update(bytes).digest('hex'), createdAt: new Date('2026-06-03') };
    const source = { ...doc, id: 'source', originalName: 'source.zip' };
    assert.equal((await loadTaxManagementReview([doc, source], root))?.sources[0].documentId, 'source');
    assert.equal(await loadTaxManagementReview([doc], root), undefined);
    assert.equal(await loadTaxManagementReview([{ ...doc, sha256: '0'.repeat(64) }, source], root), undefined);
    assert.equal(await loadTaxManagementReview([{ ...doc, storageKey: '../review.zip' }, source], root), undefined);
    assert.equal(await loadTaxManagementReview([doc, source, { ...doc, status: 'PROCESSING_FAILED', createdAt: new Date('2026-06-04') }], root), undefined);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('archive coverage follows the reviewed January-to-cutoff period, not the upload default month', async () => {
  const zip = new JSZip(); zip.file('tax-management-review.json', JSON.stringify(fixture()));
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const coverage = await detectTaxDocumentCoverage({ documentType: 'CORRECTION_EVIDENCE', periodKey: '2026-04', originalName: 'AUSN_management_review_test.zip', extension: 'zip', bytes });
  assert.equal(coverage.coverageFrom, '2026-01');
  assert.equal(coverage.coverageTo, '2026-05');
});

test('all four views preserve uncertainty, source cutoff and separate tax versus accounting facts', () => {
  const review = fixture();
  const overview = renderToStaticMarkup(<TaxManagementOverview review={review} base='/admin/taxes' />);
  assert.match(overview, /Не окончательная налоговая база/);
  assert.match(overview, /ПСН/);
  assert.match(overview, /Это разные источники, а не две даты на выбор/);
  assert.match(renderToStaticMarkup(<TaxManagementIncome review={review} />), /Первое пересечение в предварительной модели/);
  assert.match(renderToStaticMarkup(<TaxManagementReconciliation review={review} />), /не установленная недоимка/);
  assert.match(renderToStaticMarkup(<TaxManagementDocuments review={review} />), /Не найден в архиве/);
});

test('accountant confirmation closes the date task without certifying the preliminary payments model', () => {
  const review = fixture();
  review.accountantConfirmation = { exceededOn: review.fnsCrossing, confirmedOn: '2026-06-03', source: 'Владелец подтвердил согласование с бухгалтером.' };
  const valid = parseTaxManagementReview(JSON.stringify(review)); assert.ok(valid);
  const html = renderToStaticMarkup(<TaxManagementOverview review={valid} base='/admin/taxes' />);
  assert.match(html, /Дата согласована с бухгалтером/);
  assert.match(html, /Проверить с бухгалтером отправку и принятие уведомлений/);
  assert.doesNotMatch(html, /С бухгалтером подтвердить месяц/);
  assert.match(html, /Не окончательная налоговая база/);
  review.accountantConfirmation.exceededOn = review.paymentsCrossing;
  assert.equal(parseTaxManagementReview(JSON.stringify(review)), undefined);
});

test('posted accounting documents remain visible with concrete gaps, not a blanket rejection of 1C', () => {
  const review = fixture();
  review.accounting = { checkedAt: '2026-06-02', sourceName: 'source.zip', rows: [{ posted: true, saleNumber: 'TEST-1', saleCents: 12000000, bankCents: 10000000, cashCents: 2000000, finding: 'ПКО связан, фискальная связь не найдена.', action: 'Проверить несвязанный чек до повторного оформления.' }] };
  assert.ok(parseTaxManagementReview(JSON.stringify(review)));
  const html = renderToStaticMarkup(<TaxManagementAccounting review={review} />);
  assert.match(html, /TEST-1/); assert.match(html, /Проведена/); assert.match(html, /фискальная связь не найдена/);
  assert.match(html, /не доказывает отсутствие чека в ОФД/);
  review.accounting.rows.push(review.accounting.rows[0]);
  assert.equal(parseTaxManagementReview(JSON.stringify(review)), undefined);
});

test('accounting income uses the same Q1 baseline once and stays independent of FNS and payment totals', () => {
  const review = fixture();
  review.accountingIncome = { from: '2026-04-01', through: review.cutoff, incomeCents: 4_300_000_000, sourceName: 'source.zip' };
  const result = parseTaxManagementReview(JSON.stringify(review)); assert.ok(result);
  const totals = managementTotals(result);
  assert.equal(totals.accounting, 6_300_000_000);
  assert.equal(totals.fns, 6_100_000_000);
  assert.equal(totals.payments, 6_200_000_000);
  const html = renderToStaticMarkup(<TaxManagementOverview review={result} base='/admin/taxes' />);
  assert.match(html, /учётный доход 1С \+ ККТ/);
  assert.doesNotMatch(html, /Отдельный итог не подтверждён/);
  review.accountingIncome.from = '2026-01-01';
  assert.equal(parseTaxManagementReview(JSON.stringify(review)), undefined);
});


test('fresh accounting report updates only its own dated comparison and counts Q1 once', () => {
  const review = fixture();
  const before = managementTotals(review);
  const report = { available: true, kind: 'full', ausnIncome: 45_000_000, dataCutoff: '2026-06-04', runTimeUtc: '2026-06-05T00:00:00Z', sourceFile: 'fresh.md' };
  const snapshot = accountingSnapshot(review, report)!;
  assert.equal(snapshot.cents, 6_500_000_000);
  assert.equal(snapshot.through, '2026-06-04');
  assert.deepEqual(managementTotals(review), before);
  assert.equal(accountingSnapshot(review, { ...report, available: false }), undefined);
  assert.equal(accountingSnapshot(review, { ...report, kind: 'month' }), undefined);
  assert.equal(accountingSnapshot(review, { ...report, dataCutoff: '2026-04-30' }), undefined);
});


test('fresh month without documentary FNS evidence stays visible and is never a zero FNS amount', () => {
  const report = { available: true, kind: 'full', ausnIncome: 45000000, dataCutoff: '2026-06-04', runTimeUtc: '2026-06-05T00:00:00Z', sourceFile: 'fresh.md', monthlyIncome: [{ periodKey: '2026-06', amount: 4000000, partial: true }] } as never;
  const html = renderToStaticMarkup(<TaxAccountingMonths review={fixture()} report={report} />);
  assert.match(html, /июнь/); assert.match(html, /неполный месяц/);
  assert.match(html, /Ещё нет выгрузки в этой сверке/);
  assert.match(html, /65 000 000,00/);
  const unavailable = renderToStaticMarkup(<TaxAccountingMonths review={fixture()} />);
  assert.match(unavailable, /недоступна/); assert.doesNotMatch(unavailable, /0,00 ₽/);
});

test('FNS termination proof does not certify USN acceptance; status requires an archived source', () => {
  const review = fixture();
  review.regimeStatus = { checkedAt: '2026-06-03', ausnEndedOn: '2026-05-01', certificateNumber: '101551', sourceName: 'source.zip', usnStatus: 'not_confirmed' };
  const parsed = parseTaxManagementReview(JSON.stringify(review)); assert.ok(parsed);
  for (const html of [renderToStaticMarkup(<TaxManagementOverview review={parsed} base='/admin/taxes' />), renderToStaticMarkup(<TaxManagementDocuments review={parsed} />)]) {
    assert.match(html, /Снятие с АУСН подтверждено ФНС/);
    assert.match(html, /ожидает отдельного подтверждения/);
    assert.doesNotMatch(html, /Проверить с бухгалтером отправку и принятие уведомлений/);
  }
  review.regimeStatus.sourceName = 'missing.pdf';
  assert.equal(parseTaxManagementReview(JSON.stringify(review)), undefined);
});
