import assert from "node:assert/strict";
import test from "node:test";
import { procurementOrderCommentText } from "../lib/procurement-order-comment";

test("keeps every non-empty 1C comment without classifying its meaning", () => {
  assert.equal(
    procurementOrderCommentText("Мегапрайс — помощник закупок"),
    "Мегапрайс — помощник закупок",
  );
  assert.equal(procurementOrderCommentText("  "), "");
});

test("does not maintain a hard-coded list of cities", () => {
  assert.equal(procurementOrderCommentText("Москва"), "Москва");
  assert.equal(procurementOrderCommentText("Краснодар"), "Краснодар");
});

test("keeps meaningful comments and normalizes whitespace", () => {
  assert.equal(
    procurementOrderCommentText("Китай   Keephone\nполная оплата"),
    "Китай Keephone полная оплата",
  );
});
