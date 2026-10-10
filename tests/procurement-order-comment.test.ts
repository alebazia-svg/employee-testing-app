import assert from "node:assert/strict";
import test from "node:test";
import { procurementOrderCommentText, procurementPaymentCommentText } from "../lib/procurement-order-comment";

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

test('payment form hides only the known standalone service signature',()=>{
  for(const dash of ['-', '–', '—']){
    const signature=`Мегапрайс ${dash} помощник закупок.`;
    assert.equal(procurementPaymentCommentText(signature),'');
    assert.equal(procurementOrderCommentText(signature),signature);
    assert.equal(procurementPaymentCommentText(signature+'\nОтгрузка после оплаты. Курс 13,6'),'Отгрузка после оплаты. Курс 13,6');
  }
  for(const useful of ['Москва','Предоплата 50%','Позвонить в Мегапрайс','Мегапрайс — помощник закупок. Отгрузка завтра'])assert.equal(procurementPaymentCommentText(useful),useful);
});
