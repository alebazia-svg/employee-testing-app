import { test } from 'node:test';
import assert from 'node:assert/strict';
import { adminPaymentComment } from '../lib/procurement-admin-comment';
import { PAYMENT_REVIEW_PREFIX } from '../lib/procurement-buyer-comment';
test('free text and payment details remain verbatim',()=>{
 const text='Альфа +79060000000\nСумма 23 500 юаней по 13,6. Нужна сверка перед оплатой.';
 assert.deepEqual(adminPaymentComment(text),{warning:'',comment:text});
});
test('known envelope separated from complete buyer comment',()=>{
 const comment='  23500юаней по 13,6\nВторая строка без сокращения  ';
 const value=PAYMENT_REVIEW_PREFIX+'Заказ 123: Есть авансы поставщику — проверьте их зачёт перед новой предоплатой\nОснование закупщика: '+comment;
 const current=adminPaymentComment(value);assert.equal(current.comment,comment);assert.match(current.warning,/Проверьте/);assert.match(current.warning,/не подтверждена/);
 const historical=adminPaymentComment(value,true);assert.equal(historical.comment,comment);assert.doesNotMatch(historical.warning,/Проверьте/);
});
test('unknown system reasons retained, not guessed away',()=>{
 const value=PAYMENT_REVIEW_PREFIX+'Заказ 55: Новый вид расхождения\nОснование закупщика: текст';
 assert.match(adminPaymentComment(value).warning,/Новый вид расхождения/);assert.equal(adminPaymentComment(value).comment,'текст');
});
test('malformed envelope is not stripped',()=>{
 const text=PAYMENT_REVIEW_PREFIX+'Без разделителя';assert.equal(adminPaymentComment(text).comment,text);
});
test('a known reason never swallows another unknown reason',()=>{
 const value=PAYMENT_REVIEW_PREFIX+'Заказ 1: Есть авансы поставщику — проверьте их зачёт перед новой предоплатой; Заказ 2: Новый вид расхождения\nОснование закупщика: Реквизиты';
 const result=adminPaymentComment(value);
 assert.match(result.warning,/Заказ 2: Новый вид расхождения/);
 assert.equal(result.comment,'Реквизиты');
});
