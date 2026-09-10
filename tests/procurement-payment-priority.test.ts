import assert from "node:assert/strict";
import test from "node:test";
import { buildProcurementReviewQueue } from "../lib/procurement-payment-priority";

const order = (patch: Partial<{
  ref: string;
  date: string;
  receiptAmount: number;
  paymentAmount: number;
  unplannedAmount: number;
  currentState: string;
  controlGroup: string;
}> = {}) => ({
  ref: "order",
  date: "01.09.2026",
  receiptAmount: 0,
  paymentAmount: 0,
  unplannedAmount: 100_000,
  currentState: "Ожидается поступление",
  controlGroup: "active_goods_order",
  ...patch,
});

test("raises received and partially paid orders above merely old orders", () => {
  const queue = buildProcurementReviewQueue([
    order({ ref: "old", date: "01.08.2026" }),
    order({ ref: "partial", paymentAmount: 20_000 }),
    order({ ref: "received", receiptAmount: 50_000 }),
  ], "2026-09-10");

  assert.deepEqual(queue.map((item) => item.ref), ["received", "partial", "old"]);
  assert.equal(queue[0].reviewReason, "Есть поступление — оплата не закрыта");
});

test("does not fill the queue with recent orders that have no risk signal", () => {
  const queue = buildProcurementReviewQueue([
    order({ date: "09.09.2026" }),
  ], "2026-09-10");

  assert.deepEqual(queue, []);
});

test("uses amount only as a tie breaker", () => {
  const queue = buildProcurementReviewQueue([
    order({ ref: "small", receiptAmount: 1, unplannedAmount: 10_000 }),
    order({ ref: "large", receiptAmount: 1, unplannedAmount: 500_000 }),
  ], "2026-09-10");

  assert.deepEqual(queue.map((item) => item.ref), ["large", "small"]);
});

test("uses explicit 1C payment states as risk signals", () => {
  const queue = buildProcurementReviewQueue([
    order({ ref: "prepayment", date: "10.09.2026", currentState: "Ожидается предоплата (до приобретения)" }),
    order({ ref: "received", date: "10.09.2026", currentState: "Ожидается оплата (после поступления)", controlGroup: "fulfilled_goods_order" }),
  ], "2026-09-10");

  assert.deepEqual(queue.map((item) => item.ref), ["received", "prepayment"]);
  assert.equal(queue[1].reviewReason, "Нужна предоплата — уточните дату");
});
