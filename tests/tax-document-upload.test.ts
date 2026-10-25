import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { zipSync, strToU8 } from 'fflate';
import { detectTaxDocumentCoverage, validateTaxDocumentInput } from '../lib/tax-document-upload';

test('tax document metadata accepts a governed type and month', () => {
  assert.deepEqual(validateTaxDocumentInput({ documentType: 'ENS_OPERATIONS', periodKey: '2026-10' }), { documentType: 'ENS_OPERATIONS', periodKey: '2026-10' });
});

test('income workbook covers only fully completed months', () => {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Дата'], ['01.04.2026'], ['15.10.2026']]), 'Отчет');
  const bytes = new Uint8Array(XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }));
  assert.deepEqual(detectTaxDocumentCoverage({ documentType: 'AUSN_INCOME', periodKey: '2026-10', originalName: 'report.xlsx', bytes, extension: 'xlsx' }), {
    coverageFrom: '2026-04', coverageTo: '2026-09', detected: true, note: 'Определено по датам операций; незавершённый месяц не засчитан.',
  });
});

test('ENS archive uses actual AUSN reporting months and ignores USN rows', () => {
  const csv = ['Наименование обязательства;Отчетный год;Отчетный период', 'Налоги УСН;2026;год', 'Налоги АУСН;2026;апрель', 'Налоги АУСН;2026;июль'].join('\n');
  const bytes = zipSync({ 'ens.csv': strToU8(csv) });
  assert.deepEqual(detectTaxDocumentCoverage({ documentType: 'ENS_OPERATIONS', periodKey: '2026-09', originalName: 'ens.zip', bytes, extension: 'zip' }), {
    coverageFrom: '2026-04', coverageTo: '2026-07', detected: true, note: 'Определено по фактическим периодам начислений АУСН внутри архива ЕНС.',
  });
});

test('tax document metadata rejects unknown types and periods', () => {
  assert.throws(() => validateTaxDocumentInput({ documentType: 'OTHER', periodKey: '2026-10' }));
  assert.throws(() => validateTaxDocumentInput({ documentType: 'ENS_OPERATIONS', periodKey: '10.2026' }));
});
