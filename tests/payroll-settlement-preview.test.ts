import assert from 'node:assert/strict';
import test from 'node:test';
import { findSettlement, verifiedSettlementRemainder } from '../app/(dashboard)/admin/payroll/PayrollSettlementPreview';
import { septemberCalculation } from '../app/(dashboard)/admin/payroll/settlement-preview/september-calculation';

test('September final evidence reconciles without converting calculation differences into debt', () => {
  assert.equal(Math.round(Object.values(septemberCalculation).reduce((sum, row) => sum + row.gross, 0) * 100), 103262191);
  for (const row of Object.values(septemberCalculation)) {
    assert.ok(Math.abs(row.components.reduce((sum, [, amount]) => sum + amount, 0) - row.gross) < 0.011);
  }
  const paid = { name: 'Чеченова Милана', paid: 76500, first: 12500, remaining: 0, calculation: septemberCalculation['Чеченова Милана'] };
  assert.equal(findSettlement([paid], paid.name, '2026-09'), paid);
  assert.equal(verifiedSettlementRemainder(paid, paid.calculation.gross, 0), null);
  assert.equal(paid.remaining, 0);
});

const rows = [
  { name: 'Чеченова Милана', paid: 76500, first: 12500, remaining: 0 },
  { name: 'Кумыков Мухаммед', paid: 7500, accrual: 7500, remaining: 0 },
  { name: 'Стажёр розницы · поклейка', paid: 19500, remaining: 0 },
];
test('verified remainder requires same accrual and preserves unknown and overpayment states', () => {
  assert.equal(verifiedSettlementRemainder(rows[1], 7500, 0), 0);
  assert.equal(verifiedSettlementRemainder(rows[1], 9000, 0), null);
  assert.equal(verifiedSettlementRemainder(rows[1], 7500, 100), null);
  assert.equal(verifiedSettlementRemainder(rows[0], 89000, 0), null);
  assert.equal(verifiedSettlementRemainder({...rows[1], paid: 8000}, 7500, 0), -500);
});
test('settlement preview never carries a payment across payroll months or years', () => {
  assert.equal(findSettlement(rows, 'Чеченова Милана', '2026-09'), rows[0]);
  assert.equal(findSettlement(rows, 'Чеченова Милана', '2026-10'), undefined);
  assert.equal(findSettlement(rows, 'Чеченова Милана', '2025-09'), undefined);
  assert.equal(findSettlement(rows, 'Кумыков Мухаммед', '2026-09'), undefined);
  assert.equal(findSettlement(rows, 'Кумыков Мухаммед', '2026-10'), rows[1]);
});
test('settlement preview preserves existing trainee alias and unknown state', () => {
  assert.equal(findSettlement(rows, 'СтажерРозница · поклейка (09.2026)', '2026-09'), rows[2]);
  assert.equal(findSettlement(rows, null, '2026-09'), undefined);
  assert.equal(findSettlement(undefined, 'Чеченова Милана', '2026-09'), undefined);
});
