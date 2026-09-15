import test from "node:test";
import assert from "node:assert/strict";
import { buildProcurementCashPreparation } from "../lib/procurement-cash-preparation";

test("keeps salary cash in the safe and prepares the shortage through VTB then T-Bank", () => {
  const result = buildProcurementCashPreparation({
    asOf: "2026-09-15", dueOn: "2026-09-16", requiredMinor: 50_000_000,
    safeMinor: 5_000_000, vtbCardMinor: 10_000_000, vtbAccountMinor: 40_000_000,
    tbankCardMinor: 2_000_000, tbankAccountMinor: 50_000_000,
    tbankTransferStatus: "verified", tbankCurrentRateBps: 100, tbankCurrentTierRemainingMinor: 80_000_000,
  });
  assert.equal(result.safeCoveredMinor, 5_000_000);
  assert.equal(result.prepareMinor, 45_000_000);
  assert.deepEqual(result.steps.map((step) => [step.source, step.amountMinor, step.transferFromAccountMinor]), [
    ["vtb", 35_000_000, 25_000_000],
    ["tbank_card", 2_000_000, 0],
    ["tbank_account", 8_000_000, 8_000_000],
  ]);
  assert.equal(result.tbankEstimatedFeeMinor, 85_900);
  assert.equal(result.unresolvedMinor, 0);
});

test("uses more VTB capacity when there are several days before payment", () => {
  const result = buildProcurementCashPreparation({
    asOf: "2026-09-15", dueOn: "2026-09-17", requiredMinor: 60_000_000,
    safeMinor: 0, vtbCardMinor: 10_000_000, vtbAccountMinor: 50_000_000,
    tbankCardMinor: 0, tbankAccountMinor: 0,
    tbankTransferStatus: "unavailable", tbankCurrentRateBps: null, tbankCurrentTierRemainingMinor: null,
  });
  assert.equal(result.vtbDailyCapacityMinor, 70_000_000);
  assert.equal(result.steps[0]?.amountMinor, 60_000_000);
  assert.equal(result.unresolvedMinor, 0);
});

test("does not invent a T-Bank transfer when its tariff evidence is not verified", () => {
  const result = buildProcurementCashPreparation({
    asOf: "2026-09-15", dueOn: "2026-09-16", requiredMinor: 70_000_000,
    safeMinor: 0, vtbCardMinor: 0, vtbAccountMinor: 35_000_000,
    tbankCardMinor: 0, tbankAccountMinor: 50_000_000,
    tbankTransferStatus: "review", tbankCurrentRateBps: 100, tbankCurrentTierRemainingMinor: 80_000_000,
  });
  assert.equal(result.unresolvedMinor, 35_000_000);
  assert.ok(result.diagnostics.includes("tbank_tariff_needs_review"));
  assert.equal(result.steps.some((step) => step.source === "tbank_account"), false);
});

test("fails closed when a required money position is missing", () => {
  const result = buildProcurementCashPreparation({
    asOf: "2026-09-15", dueOn: "2026-09-16", requiredMinor: 50_000_000,
    safeMinor: null, vtbCardMinor: 0, vtbAccountMinor: 0,
    tbankCardMinor: 0, tbankAccountMinor: 0,
    tbankTransferStatus: "verified", tbankCurrentRateBps: 0, tbankCurrentTierRemainingMinor: 80_000_000,
  });
  assert.equal(result.state, "unavailable");
  assert.equal(result.prepareMinor, null);
});

test("stops at the verified T-Bank tier boundary instead of understating the fee", () => {
  const result = buildProcurementCashPreparation({
    asOf: "2026-09-15", dueOn: "2026-09-16", requiredMinor: 100_000_000,
    safeMinor: 0, vtbCardMinor: 0, vtbAccountMinor: 35_000_000,
    tbankCardMinor: 0, tbankAccountMinor: 100_000_000,
    tbankTransferStatus: "verified", tbankCurrentRateBps: 100, tbankCurrentTierRemainingMinor: 50_000_000,
  });
  assert.equal(result.steps.find((step) => step.source === "tbank_account")?.amountMinor, 50_000_000);
  assert.equal(result.unresolvedMinor, 15_000_000);
  assert.ok(result.diagnostics.includes("tbank_next_tier_needs_review"));
});

test("treats an overdrawn account as zero available money without crashing the page", () => {
  const result = buildProcurementCashPreparation({
    asOf: "2026-09-15", dueOn: "2026-09-16", requiredMinor: 10_000_000,
    safeMinor: 0, vtbCardMinor: 0, vtbAccountMinor: -5_000_000,
    tbankCardMinor: 10_000_000, tbankAccountMinor: 0,
    tbankTransferStatus: "verified", tbankCurrentRateBps: 0, tbankCurrentTierRemainingMinor: 80_000_000,
  });
  assert.equal(result.state, "ready");
  assert.equal(result.steps[0]?.source, "tbank_card");
  assert.equal(result.unresolvedMinor, 0);
});
