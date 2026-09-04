import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import React, { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseFinboxReport } from '../lib/payroll-finbox';
import { PayrollFinboxImport } from '../app/(dashboard)/admin/payroll/PayrollFinboxImport';

const sample = `| **Начальный остаток на 2026-08-01 (включая резерв)** | **&#x20;20 602.54&#x20;** | |
|---:|---:|---|
|01.08.2026|Начисление агентского вознаграждения (подробнее)|11 114.56|
|05.08.2026|Начисление агентского вознаграждения (подробнее)|9 408.72|
|07.08.2026|Начисление агентского вознаграждения (подробнее)|8 960.00|
|08.08.2026|Начисление агентского вознаграждения (подробнее)|5 468.72|
|11.08.2026|Начисление агентского вознаграждения за Июль 2026 (подробнее)|0|
|13.08.2026|Начисление агентского вознаграждения (подробнее)|8 163.68|
|13.08.2026|Перечисление на карту (Детали)|-55 554.00|
|14.08.2026|Начисление агентского вознаграждения (подробнее)|2 808.43|
|17.08.2026|Начисление агентского вознаграждения (подробнее)|4 885.60|
|18.08.2026|Начисление агентского вознаграждения (подробнее)|5 232.32|
|19.08.2026|Начисление агентского вознаграждения (подробнее)|9 614.74|
|20.08.2026|Начисление агентского вознаграждения (подробнее)|3 183.52|
|21.08.2026|Начисление агентского вознаграждения (подробнее)|3 432.53|
|23.08.2026|Перечисление на карту (Детали)|-37 321.00|
|24.08.2026|Начисление агентского вознаграждения (подробнее)|2 780.00|
|26.08.2026|Начисление агентского вознаграждения (подробнее)|5 040.00|
|27.08.2026|Начисление агентского вознаграждения (подробнее)|5 280.24|
||**Конечный остаток на 2026-08-31 (включая резерв):**|**13 100.60**|`;

describe('Finbox paste-only payroll preview', () => {
  it('reconciles the August example in kopecks without treating transfers as advances', () => {
    const result = parseFinboxReport(sample, '2026-08');
    assert.deepEqual(result.errors, []);
    assert.equal(result.amount, '85373.06');
    assert.equal(result.accrualCount, 14);
    assert.equal(result.transfers, -92875);
    assert.equal(result.opening, 20602.54);
    assert.equal(result.closing, 13100.60);
    assert.equal(result.difference, 0);
    assert.equal(result.notes.length, 1);
  });
  it('accepts browser TSV, decimal commas and narrow spaces', () => {
    const tsv = sample.split('\n').filter(line => !line.includes('---')).map(line => line.replace(/^\||\|$/g, '').replaceAll('|', '\t')).join('\r\n').replaceAll('.', ',').replace(/(\d{2}),(\d{2}),(\d{4})/g, '$1.$2.$3').replaceAll(' ', ' ');
    assert.equal(parseFinboxReport(tsv, '2026-08').amount, '85373.06');
    assert.deepEqual(parseFinboxReport(tsv, '2026-08').errors, []);
  });
  for (const [name, input, period] of [
    ['wrong period', sample, '2026-09'],
    ['missing opening', sample.split('\n').slice(1).join('\n'), '2026-08'],
    ['missing closing', sample.split('\n').slice(0, -1).join('\n'), '2026-08'],
    ['missing movement', sample.replace(/\|05\.08\.2026[^\n]+\n/, ''), '2026-08'],
    ['unknown movement', sample.replace('Перечисление на карту', 'Неизвестная операция'), '2026-08'],
    ['prior month nonzero', sample.replace('(подробнее)|0|', '(подробнее)|10|'), '2026-08'],
    ['positive transfer', sample.replace('-55 554.00', '55 554.00'), '2026-08'],
    ['bad money', sample.replace('9 408.72', '9 408.721'), '2026-08'],
    ['invalid date', sample.replace('27.08.2026', '32.08.2026'), '2026-08'],
    ['after closing', sample.replace('2026-08-31', '2026-08-25'), '2026-08'],
    ['double paste', sample + '\n' + sample, '2026-08'],
    ['duplicate operation', sample + '\n|01.08.2026|Начисление агентского вознаграждения (подробнее)|11 114.56|', '2026-08'],
    ['empty', '', '2026-08'],
    ['oversize', 'x'.repeat(100001), '2026-08'],
    ['invalid period', sample, '2026-13'],
  ]) {
    it(`blocks ${name}`, () => assert.ok(parseFinboxReport(input, period).errors.length > 0));
  }
  it('does not change the input or accumulate repeated previews', () => {
    assert.deepEqual(parseFinboxReport(sample, '2026-08'), parseFinboxReport(sample, '2026-08'));
  });
  it('renders a compact disabled entry without applying or exposing an import form', () => {
    let calls = 0;
    const html = renderToStaticMarkup(createElement(PayrollFinboxImport, { periodKey: '2026-08', currentAmount: '85373', disabled: true, onApply: () => { calls++; } }));
    assert.match(html, /Вставить отчёт Finbox/);
    assert.match(html.replace(/<[^>]*>/g, ''), /Начисления за август 2026 г\. Перечисления/);
    assert.match(html, /disabled/);
    assert.doesNotMatch(html, /<textarea/);
    assert.equal(calls, 0);
  });
});
