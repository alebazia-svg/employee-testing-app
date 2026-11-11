import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../app/(dashboard)/admin/company-details/page.tsx', import.meta.url), 'utf8');
const actions = readFileSync(new URL('../app/(dashboard)/admin/company-details/CompanyCardActions.tsx', import.meta.url), 'utf8');

test('company details keeps the existing T-Bank card and adds an independent Alfa-Bank card', () => {
  assert.match(page, /name: 'Т-Банк'/);
  assert.match(page, /name: 'Альфа-Банк'/);
  assert.match(page, /40802810200006310115/);
  assert.match(page, /40802810181210006676/);
  assert.match(page, /company-card-ip-keshtova\.pdf/);
  assert.match(page, /company-card-ip-keshtova-alfa-bank\.pdf/);
  assert.match(page, /bankCards\.map/);
});

test('company details shows the current tax regime without an unverified VAT claim', () => {
  assert.match(page, /\['Налоговый режим', 'УСН «Доходы»'\]/);
  assert.doesNotMatch(page, /Без НДС|АУСН/);
});

test('each bank card receives its own open, share and Word paths', () => {
  assert.match(actions, /bankName: string/);
  assert.match(actions, /pdfPath: string/);
  assert.match(actions, /docxPath: string/);
  assert.match(actions, /downloadName: string/);
  assert.match(actions, /new URL\(pdfPath, window\.location\.origin\)/);
});

test('both bank-specific downloadable files exist', () => {
  for (const path of [
    '../public/documents/company-card-ip-keshtova.pdf',
    '../public/documents/company-card-ip-keshtova.docx',
    '../public/documents/company-card-ip-keshtova-alfa-bank.pdf',
    '../public/documents/company-card-ip-keshtova-alfa-bank.docx',
  ]) {
    assert.equal(existsSync(new URL(path, import.meta.url)), true, `${path} should exist`);
  }
});
