import assert from "node:assert/strict";
import test from "node:test";
import { buildProcurementFinancialAssistant } from "../lib/procurement-financial-assistant";
import type { ProcurementCashPreparation } from "../lib/procurement-cash-preparation";
import type { ProcurementDebtAllocation } from "../lib/procurement-debt-allocation";

const cash = (overrides: Partial<ProcurementCashPreparation> = {}): ProcurementCashPreparation => ({
  state: "ready", dueOn: "2026-09-16", requiredMinor: 50_000_000,
  safeCoveredMinor: 50_000_000, prepareMinor: 0, unresolvedMinor: 0,
  vtbDailyCapacityMinor: 35_000_000, tbankEstimatedFeeMinor: 0, steps: [], diagnostics: [],
  ...overrides,
});
const debt = (overrides: Partial<ProcurementDebtAllocation> = {}): ProcurementDebtAllocation => ({
  state: "ready", resourcesMinor: 200_000_000, mandatoryReserveMinor: 50_000_000,
  availableForDebtMinor: 150_000_000, totalDebtMinor: 200_000_000,
  uncoveredDebtMinor: 50_000_000, diagnostics: [], debts: [
    { supplier: "95-RU", debtMinor: 200_000_000, priority: 0, verified: true },
  ], recommendations: [
    { supplier: "95-RU", debtMinor: 200_000_000, recommendedMinor: 150_000_000, result: "partial", priority: 0 },
  ], ...overrides,
});

test("unresolved mandatory payment wins over supplier debt", () => {
  const result = buildProcurementFinancialAssistant({
    cashPreparation: cash({ prepareMinor: 80_000_000, unresolvedMinor: 20_000_000 }),
    debtAllocation: debt(), dataWarnings: [],
  });
  assert.equal(result.title, "Найти источник для обязательной выплаты");
  assert.equal(result.amountMinor, 20_000_000);
  assert.equal(result.state, "review");
});

test("cash preparation wins before supplier recommendation", () => {
  const result = buildProcurementFinancialAssistant({
    cashPreparation: cash({ safeCoveredMinor: 20_000_000, prepareMinor: 30_000_000,
      steps: [{ source: "vtb", amountMinor: 30_000_000, transferFromAccountMinor: 0, note: "" }] }),
    debtAllocation: debt(), dataWarnings: [],
  });
  assert.equal(result.title, "Подготовить наличные на обязательную выплату");
  assert.equal(result.amountMinor, 30_000_000);
});

test("recommends the first verified allocation after reserve", () => {
  const result = buildProcurementFinancialAssistant({ cashPreparation: cash(), debtAllocation: debt(), dataWarnings: [] });
  assert.equal(result.title, "Направить поставщику 95-RU");
  assert.equal(result.amountMinor, 150_000_000);
  assert.match(result.findings[0].text, /частичная оплата/);
});

test("unknown supplier is not silently classified", () => {
  const result = buildProcurementFinancialAssistant({
    cashPreparation: cash(),
    debtAllocation: debt({ recommendations: [
      { supplier: "Новый поставщик", debtMinor: 50_000_000, recommendedMinor: 50_000_000, result: "full", priority: 4 },
    ], totalDebtMinor: 50_000_000, uncoveredDebtMinor: 0 }),
    dataWarnings: [],
  });
  assert.equal(result.state, "review");
  assert.equal(result.title, "Проверить приоритет поставщика Новый поставщик");
  assert.ok(result.findings.some((item) => item.text.includes("не считается рекомендацией к оплате")));
});

test("keeps a large supplier debt visible when core evidence is incomplete", () => {
  const result = buildProcurementFinancialAssistant({
    cashPreparation: cash({ state: "unavailable", prepareMinor: null, unresolvedMinor: null }),
    debtAllocation: debt(), dataWarnings: ["остатки касс"],
  });
  assert.equal(result.state, "review");
  assert.equal(result.amountMinor, 200_000_000);
  assert.equal(result.title, "На контроле долг 95-RU");
  assert.match(result.explanation, /Точную сумму платежа/);
});

test("returns a calm no-action state when no debt exists", () => {
  const result = buildProcurementFinancialAssistant({
    cashPreparation: cash(),
    debtAllocation: debt({ recommendations: [], debts: [], totalDebtMinor: 0, uncoveredDebtMinor: 0 }),
    dataWarnings: [],
  });
  assert.equal(result.title, "Срочных финансовых действий нет");
  assert.equal(result.state, "ready");
});
