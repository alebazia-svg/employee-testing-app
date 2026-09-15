import test from "node:test";
import assert from "node:assert/strict";
import { buildProcurementDebtAllocation } from "../lib/procurement-debt-allocation";

test("shows how much remains for supplier debt after mandatory reserves", () => {
  const result = buildProcurementDebtAllocation({
    resourcesMinor: 300_000_000,
    mandatoryReserveMinor: 68_015_000,
    resourcesComplete: true,
    debtsComplete: true,
    debts: [
      { supplier: "95-RU", debtMinor: 200_000_000, priority: 0, verified: true },
      { supplier: "Турал", debtMinor: 150_000_000, priority: 1, verified: true },
    ],
  });
  assert.equal(result.state, "ready");
  assert.equal(result.availableForDebtMinor, 231_985_000);
  assert.equal(result.uncoveredDebtMinor, 118_015_000);
  assert.deepEqual(result.recommendations.map((item) => [item.supplier, item.recommendedMinor, item.result]), [
    ["95-RU", 200_000_000, "full"],
    ["Турал", 31_985_000, "partial"],
  ]);
});

test("does not recommend payments when money, reserve, or debt evidence is incomplete", () => {
  const result = buildProcurementDebtAllocation({
    resourcesMinor: 300_000_000,
    mandatoryReserveMinor: null,
    resourcesComplete: true,
    debtsComplete: true,
    debts: [{ supplier: "95-RU", debtMinor: 200_000_000, priority: 0, verified: true }],
  });
  assert.equal(result.state, "unavailable");
  assert.equal(result.availableForDebtMinor, null);
  assert.deepEqual(result.recommendations, []);
});

test("deduplicates one supplier and preserves the strongest priority", () => {
  const result = buildProcurementDebtAllocation({
    resourcesMinor: 100_000_000,
    mandatoryReserveMinor: 10_000_000,
    resourcesComplete: true,
    debtsComplete: true,
    debts: [
      { supplier: "95‑RU", debtMinor: 40_000_000, priority: 2, verified: true },
      { supplier: "95-RU", debtMinor: 30_000_000, priority: 0, verified: true },
    ],
  });
  assert.equal(result.recommendations.length, 1);
  assert.equal(result.recommendations[0]?.debtMinor, 70_000_000);
  assert.equal(result.recommendations[0]?.priority, 0);
});
