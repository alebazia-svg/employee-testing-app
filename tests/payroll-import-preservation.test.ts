import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import * as XLSX from 'xlsx';

// Exercise the actual input handler, with isolated state setters and no DB.
function harness(recognized: boolean) {
  const source = readFileSync('app/(dashboard)/admin/payroll/PayrollClient.tsx', 'utf8');
  const start = source.indexOf('  async function handleFileChange(');
  const end = source.indexOf('  async function handlePurchaseFileChange(', start);
  assert.ok(start > 0 && end > start);
  const body = ts.transpileModule(source.slice(start, end) + '\nreturn handleFileChange;', { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
  const state = { workbook: 'current workbook' as unknown, selectedSheet: 'Current', salesSource: 'current source' as unknown, error: '', parsing: false };
  let snapshots = 0;
  const dependencies = {
    require: createRequire(import.meta.url),
    setError: (value: string) => { state.error = value; },
    setIsParsing: (value: boolean) => { state.parsing = value; },
    setWorkbook: (value: unknown) => { state.workbook = value; },
    setSelectedSheet: (value: string) => { state.selectedSheet = value; },
    setSalesSourceFile: (value: unknown) => { state.salesSource = value; },
    sheetToRows: () => [],
    parsePayrollReport: () => ({ headerMap: recognized ? {} : null }),
    buildSourceFileSnapshot: async () => { snapshots++; return 'new source'; },
  };
  const handler = new Function(...Object.keys(dependencies), body)(...Object.values(dependencies));
  return { state, handler, snapshots: () => snapshots };
}
function file(name: string) {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['test']]), 'TDSheet');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' });
  return { name, arrayBuffer: async () => bytes };
}

test('unrecognized and unreadable replacements preserve all current source state', async () => {
  for (const input of [file('wrong.xlsx'), file('wrong.txt'), { name: 'broken.xlsx', arrayBuffer: async () => { throw new Error('read failed'); } }]) {
    const h = harness(false);
    await h.handler({ target: { files: [input] } });
    assert.equal(h.state.workbook, 'current workbook');
    assert.equal(h.state.selectedSheet, 'Current');
    assert.equal(h.state.salesSource, 'current source');
    assert.ok(h.state.error);
    assert.equal(h.state.parsing, false);
    assert.equal(h.snapshots(), 0);
  }
});

test('recognized replacement still activates its workbook and source', async () => {
  const h = harness(true);
  await h.handler({ target: { files: [file('sales.xlsx')] } });
  assert.equal(h.state.error, '');
  assert.equal(h.state.selectedSheet, 'TDSheet');
  assert.equal(h.state.salesSource, 'new source');
  assert.equal(h.snapshots(), 1);
  assert.equal(h.state.parsing, false);
});

test('cancelling the file picker preserves the current calculation', async () => {
  const h = harness(false);
  await h.handler({ target: { files: [] } });
  assert.equal(h.state.workbook, 'current workbook');
  assert.equal(h.state.salesSource, 'current source');
  assert.equal(h.state.error, '');
});
