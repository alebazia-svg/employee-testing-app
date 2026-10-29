import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import * as XLSX from 'xlsx';
import { attachFnsBankCandidates, loadLatestFnsBankReview, parseFnsBankReview } from '../lib/ausn-fns-bank-review';
import type { FnsGaps } from '../lib/ausn-fns-gaps';
const fixture = (rows: unknown[][]) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Дата','Источник','Сумма, ₽','Разметка операции, ₽','Налоговая база'], ...rows]), 'Отчет');
  const bytes = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
  return { bytes, source: { documentId: 'doc-1', sourceName: 'full.xlsx', sha256: createHash('sha256').update(bytes).digest('hex') } };
};
const gaps = (operations = [{date:'2026-07-31',amount:100}]) : FnsGaps => ({sourceFile:'ausn-fns-gaps-20261030T010000.json',months:{'2026-07':{missingInFns:operations,missingInOurs:[],cashDays:[],missingInFnsTotal:operations.reduce((s,o)=>s+o.amount,0),missingInOursTotal:0,cashDifference:0}}});
test('full non-tax markup proves bank-row zero, but never proves missing income or identity', () => {
  const {bytes,source}=fixture([['01.08.2026','Банковская операция',100,'Неналоговая база = 100,00','']]);
  const original=gaps(), review=parseFnsBankReview(bytes,source)!;
  const result=attachFnsBankCandidates(original,review);
  assert.equal(result.months['2026-07'].missingInFns[0].bankCandidate?.taxBase,0);
  assert.equal(result.months['2026-07'].missingInFns[0].bankCandidate?.row,2);
  assert.equal(original.months['2026-07'].missingInFns[0].bankCandidate,undefined);
  assert.equal(result.months['2026-07'].missingInFnsTotal,100); // annotation cannot rewrite runner totals
});
test('blank or partial markup never becomes a zero and KKT rows cannot match a bank payout', () => {
  const {bytes,source}=fixture([['31.07.2026','Банковская операция',100,'Неналоговая база = 90,00',''],['31.07.2026','ККТ',100,'Приход = 100,00',100]]);
  const review=parseFnsBankReview(bytes,source)!;
  assert.equal(review.rows.length,1);
  assert.equal(review.rows[0].taxBase,undefined);
  assert.equal(parseFnsBankReview(bytes,{...source,sha256:'0'.repeat(64)}),undefined);
});
test('ambiguous same-date/next-day bank rows and reused rows are never assigned', () => {
  const {bytes,source}=fixture([['31.07.2026','Банковская операция',100,'Неналоговая база = 100,00',''],['01.08.2026','Банковская операция',100,'Неналоговая база = 100,00','']]);
  assert.equal(attachFnsBankCandidates(gaps(),parseFnsBankReview(bytes,source)!).months['2026-07'].missingInFns[0].bankCandidate,undefined);
  const one=fixture([['31.07.2026','Банковская операция',100,'Неналоговая база = 100,00','']]);
  const result=attachFnsBankCandidates(gaps([{date:'2026-07-31',amount:100},{date:'2026-07-31',amount:100}]),parseFnsBankReview(one.bytes,one.source)!);
  assert.ok(result.months['2026-07'].missingInFns.every((o)=>!o.bankCandidate));
});
test('a pending or failed newest document cannot silently reuse a processed old document', async () => {
  const base={id:'1',documentType:'AUSN_INCOME',status:'PROCESSED',originalName:'old.xlsx',storageKey:'x.xlsx',sha256:'0'.repeat(64),createdAt:new Date('2026-10-29')};
  for(const status of ['UPLOADED','PROCESSING_FAILED']) assert.equal(await loadLatestFnsBankReview([base,{...base,id:'2',status,createdAt:new Date('2026-10-30')}]),undefined);
  assert.equal(await loadLatestFnsBankReview([{...base,storageKey:'../outside.xlsx'}]),undefined);
});

test('an archive-only full export can be reviewed without invoking the shared report processor', async () => {
  const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const root = await mkdtemp(join(tmpdir(),'fns-review-'));
  try {
    const {bytes,source}=fixture([['31.07.2026','Банковская операция',100,'Неналоговая база = 100,00','']]);
    await writeFile(join(root,'evidence.xlsx'),bytes);
    const doc={id:'evidence',documentType:'CORRECTION_EVIDENCE',status:'UPLOADED',originalName:'Отчет по операциям от 30.10.2026 01_04.xlsx',storageKey:'evidence.xlsx',sha256:source.sha256,createdAt:new Date('2026-10-30')};
    assert.equal((await loadLatestFnsBankReview([doc],root))?.rows[0].taxBase,0);
    assert.equal(await loadLatestFnsBankReview([{...doc,sha256:'0'.repeat(64)}],root),undefined);
  } finally { await rm(root,{recursive:true,force:true}); }
});
