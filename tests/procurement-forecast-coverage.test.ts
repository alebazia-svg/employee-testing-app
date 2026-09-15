import test from "node:test";
import assert from "node:assert/strict";
import { forecastCoverageLabel } from "../lib/procurement-forecast-coverage";

const known = { date: "2026-09-16", items: [{ amountMinor: 100 }], safeOutMinor: 100, cardsOutMinor: 0, safeBeforeMinor: 200, cardsBeforeMinor: 200 };
const unknown = { ...known, date: "2026-10-01", items: [{ amountMinor: null }], safeOutMinor: 0 };
test("unknown October payroll does not hide September coverage", () => {
  assert.equal(forecastCoverageLabel([known, unknown], known.date), "Деньги предусмотрены");
  assert.equal(forecastCoverageLabel([known, unknown], unknown.date), "Нужна сумма выплаты");
});
test("missing balances and unassigned money have distinct explanations", () => {
  assert.equal(forecastCoverageLabel([{ ...known, safeBeforeMinor: null }], known.date), "Не получены остатки 1С");
  assert.equal(forecastCoverageLabel([{ ...known, safeOutMinor: 0 }], known.date), "Нужно выбрать источник денег");
});
