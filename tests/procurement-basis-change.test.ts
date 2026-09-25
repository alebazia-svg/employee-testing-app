import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validatePaymentPlan } from '../lib/procurement-payment-control';
import { assertRevisionPaymentSafety, revisionChanges } from '../lib/procurement-plan-revision';
import { paymentBasisChanged } from '../lib/procurement-debt-request';

const debt = validatePaymentPlan({supplierPartner:'Supplier',orderRefs:[],plannedDate:'2026-09-25',plannedAmount:12345,paymentMethod:'CASH',condition:'Не менять'},true).data;
const order = {...debt,orderRefs:['order'],orderNumbers:['334']};
const unpaid = {state:'NO_EVIDENCE',issuedAmount:0,paidAmount:0,paidForeignAmount:0};
test('basis changes are explicit and the history names the previous and next basis', () => {
  assert.equal(paymentBasisChanged(debt,order),true);
  assert.equal(paymentBasisChanged(order,{...order,orderRefs:['other']}),false);
  assert.deepEqual(revisionChanges(debt,order),[{key:'orderRefs',label:'Основание оплаты',before:'В счёт долга поставщику',after:'334'}]);
  assert.equal(revisionChanges(order,debt)[0].after,'В счёт долга поставщику');
  assert.equal(revisionChanges({...order,orderNumbers:[]},debt)[0].before,'По заказу');
  assert.doesNotThrow(()=>assertRevisionPaymentSafety(debt,order,unpaid));
  assert.doesNotThrow(()=>assertRevisionPaymentSafety(order,debt,unpaid));
});
test('paid, uncertain and manually linked payments cannot acquire another basis', () => {
  for (const paid of [
    {...unpaid,state:'ISSUED_BY_ONE_C'}, {...unpaid,state:'PAID_BY_ONE_C'}, {...unpaid,state:'NEEDS_REVIEW'}, {...unpaid,state:'MISMATCH'},
    {...unpaid,state:'PARTIALLY_ISSUED',issuedAmount:1}, {...unpaid,state:'PARTIALLY_PAID_BY_ONE_C',paidForeignAmount:1}, {...unpaid,paidAmount:1},
  ]) {
    assert.throws(()=>assertRevisionPaymentSafety(debt,order,paid));
    assert.throws(()=>assertRevisionPaymentSafety(order,debt,paid));
  }
  assert.throws(()=>assertRevisionPaymentSafety(debt,{...order,supplierPartner:'Other'},unpaid),/того же поставщика/);
  assert.throws(()=>assertRevisionPaymentSafety({...debt,oneCCashEvidence:{manualRubleLinks:[{ref:'rko',fingerprint:'proof'}]}},order,unpaid),/связь с расходником/);
});
test('UI switches only refs, preserves financial fields, sends explicit basis and guards incomplete order choice', () => {
  const source=readFileSync('app/(dashboard)/procurement/ProcurementPaymentCalendarClient.tsx','utf8');
  const change=source.slice(source.indexOf('function chooseEditBasis('),source.indexOf('function toggleOrder('));
  assert.match(change,/setDraft\(current => \(\{\.\.\.current, orderRefs:/);
  assert.doesNotMatch(change,/plannedAmount:|plannedDate:|condition:|paymentMethod:/);
  assert.match(source,/basis: editBasis/);
  assert.match(source,/editBasis === 'ORDER' && !draft.orderRefs.length/);
  assert.match(source,/aria-label="Основание оплаты"/);
  assert.match(source,/aria-label="Найти заказ"/);
  assert.match(source,/Передать изменения/);
});
