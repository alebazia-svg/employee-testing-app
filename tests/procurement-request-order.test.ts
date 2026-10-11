import test from 'node:test';
import assert from 'node:assert/strict';
import type { ExpenseRequestSourceRow } from '../lib/expense-request-source';
import { requestSettlementOrderRef } from '../lib/procurement-request-order';
import { attachRequestOrderLinks } from '../lib/procurement-request-payment-link';
import { matchProcurementPaymentEvidence, type EvidencePlan } from '../lib/procurement-currency-payment-evidence';
import type { SupplierCurrencyPaymentRow } from '../lib/procurement-currency-payment-source';

// Synthetic UUIDs and amounts; no copied business records.
const order = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const line = (amount = 100, ref = order, type = 'Заказ поставщику', line_number = 1) => ({ line_number, fields: {
  Заказ: { type, filled: true, ref, name: 'Заказ поставщику 000001' },
  Сумма: { type: 'Число', filled: true, value: amount },
} });
const request: ExpenseRequestSourceRow = {
  ref: 'request', date: '01.10.2026 10:00:00', amount: 100, posted: true, deletion_mark: false,
  source_document: { ref: '', name: '' }, partner: { ref: 'partner', name: 'Supplier' }, currency: { name: 'руб' },
  completeness: { request: true, linked_cash_expense_orders: true },
  payment_breakdown: { contract: 'expense-request-breakdown-v1', complete: true, truncated: false, errors: [], missing_fields: [], rows: [line()] },
  linked_cash_expense_orders: { complete: true, truncated: false, errors: [], missing_fields: [], rows: [{
    ref: 'rko', date: '02.10.2026 10:00:00', posted: true, deletion_mark: false,
    amount: 100, request_amount: 100, executed_amount: 100, request_amount_conflict: false,
  }] },
};
const withRows = (rows: NonNullable<ExpenseRequestSourceRow['payment_breakdown']>['rows']) => ({ ...request, payment_breakdown: { ...request.payment_breakdown!, rows } });

test('settlement object supplies the exact order even when header basis is empty', () => {
  assert.equal(requestSettlementOrderRef(request), order);
  assert.equal(requestSettlementOrderRef({ ...request, source_document: { ref: order } }), order);
  assert.equal(requestSettlementOrderRef({ ...request, source_document: { ref: other } }), undefined);
});
test('same-order allocations can sum to the whole request; different orders cannot', () => {
  assert.equal(requestSettlementOrderRef(withRows([line(30), line(70, order, 'Заказ поставщику', 2)])), order);
  assert.equal(requestSettlementOrderRef(withRows([line(30), line(70, other, 'Заказ поставщику', 2)])), undefined);
});
test('do not interpret contract, acquisition, presentation or zero UUID as supplier order', () => {
  for (const type of ['Договор с контрагентом', 'Приобретение товаров и услуг', 'Заказ клиента', '']) {
    assert.equal(requestSettlementOrderRef(withRows([line(100, order, type)])), undefined);
  }
  for (const ref of ['', '425', '00000000-0000-0000-0000-000000000000']) {
    assert.equal(requestSettlementOrderRef(withRows([line(100, ref)])), undefined);
  }
});
test('invalid allocation amounts and duplicate lines stay unlinked', () => {
  for (const amount of [0, -100, 99.99, 100.01, NaN, Infinity]) assert.equal(requestSettlementOrderRef(withRows([line(amount)])), undefined);
  assert.equal(requestSettlementOrderRef(withRows([line(50), line(50)])), undefined);
  assert.equal(requestSettlementOrderRef(withRows([line(100, order, 'Заказ поставщику', 0)])), undefined);
});
test('incomplete new evidence cannot fall back to a seemingly valid header', () => {
  for (const patch of [{ complete: false }, { truncated: true }, { errors: ['failed'] }, { errors: undefined },
    { missing_fields: ['Заказ'] }, { rows: undefined }, { contract: undefined }]) {
    assert.equal(requestSettlementOrderRef({ ...request, source_document: { ref: order }, payment_breakdown: { ...request.payment_breakdown!, ...patch } }), undefined);
  }
});
test('line partner mismatch or missing supplier identity prevents auto assignment', () => {
  const row = { ...line(), fields: { ...line().fields, Партнер: { filled: true, ref: 'other-partner' } } };
  assert.equal(requestSettlementOrderRef(withRows([row])), undefined);
  row.fields.Партнер.ref = 'partner';
  assert.equal(requestSettlementOrderRef(withRows([row])), order);
  assert.equal(requestSettlementOrderRef({ ...withRows([row]), partner: { name: 'Supplier' } }), undefined);
});
test('legacy server keeps old explicit header behavior, no fabricated link on empty source', () => {
  assert.equal(requestSettlementOrderRef({ ...request, payment_breakdown: undefined, source_document: { ref: order } }), order);
  assert.equal(requestSettlementOrderRef({ ...request, payment_breakdown: undefined }), undefined);
});
const contractRequest = (): ExpenseRequestSourceRow => ({ ...request,
  source_document: { ref: order, name: 'Заказ поставщику 000412 от 26.09.2026' },
  payment_breakdown: { ...request.payment_breakdown!, rows: [{ ...line(100, other, 'Договор с контрагентом'),
    fields: { ...line(100, other, 'Договор с контрагентом').fields,
      Партнер: { filled: true, ref: 'partner' } } }] },
});
test('contract settlement preserves a verified explicit source order, not the contract UUID', () => {
  assert.equal(requestSettlementOrderRef(contractRequest()), order);
  for (const source_document of [undefined, {ref:''}, {ref:order}, {ref:order,name:'Приобретение товаров и услуг 412'},
    {ref:other,name:'Заказ поставщику 412'}, {ref:'00000000-0000-0000-0000-000000000000',name:'Заказ поставщику 412'}]) {
    assert.equal(requestSettlementOrderRef({...contractRequest(),source_document}),undefined);
  }
});
test('contract header fallback rejects incomplete, mixed, partial or conflicting lines', () => {
  const r=contractRequest(), row=r.payment_breakdown!.rows![0];
  for (const patch of [{complete:false},{truncated:true},{errors:['failed']},{missing_fields:['Сумма']}])
    assert.equal(requestSettlementOrderRef({...r,payment_breakdown:{...r.payment_breakdown!,...patch}}),undefined);
  for (const rows of [[{...row,fields:{...row.fields,Партнер:{filled:false}}}],
    [{...row,fields:{...row.fields,Партнер:{filled:true,ref:'wrong'}}}],
    [{...row,fields:{...row.fields,Сумма:{type:'Число',value:99}}}],
    [row,row], [row,line(1,order,'Заказ поставщику',2)]])
    assert.equal(requestSettlementOrderRef({...r,payment_breakdown:{...r.payment_breakdown!,rows}}),undefined);
});
test('source order → contract-settled request → posted RKO closes exactly once, cancellation reopens', () => {
  const r=contractRequest();
  const p: SupplierCurrencyPaymentRow={ref:'rko',number:'synthetic',date:'02.10.2026 10:00:00',posted:true,deleted:false,
    documentAmount:100,documentCurrency:'РУБ',baseDocumentRef:'',supplier:'Supplier',contract:'Supplier contract'};
  const plan: EvidencePlan={id:'plan',planCode:'PAY-TEST',supplierPartner:'Supplier',supplierCounterparty:'',orderRefs:[order],
    plannedAmount:100,paymentMethod:'CASH',status:'APPROVED',createdAt:'2026-09-30T00:00:00Z'};
  const match=(payments:SupplierCurrencyPaymentRow[], requests=[r], plans=[plan])=>matchProcurementPaymentEvidence(plans,requests,payments,[]).get(plan.id)!;
  assert.equal(attachRequestOrderLinks([p],[r])[0].requestOrderRef,order);
  assert.equal(match([p,p]).state,'ISSUED_BY_ONE_C');
  assert.equal(match([p,p]).issuedAmount,100);
  for(const rows of [[],[{...p,posted:false}],[{...p,deleted:true}],[{...p,documentAmount:99}],[{...p,supplier:'Other'}]])
    assert.equal(match(rows).issuedAmount,0);
  assert.equal(match([p],[{...r,posted:false}]).issuedAmount,0);
  assert.equal(match([p],[r,{...r,ref:'second-request'}]).issuedAmount,0);
  assert.equal(match([p],[r],[plan,{...plan,id:'second-plan'}]).issuedAmount,0);
});
test('object → request → RKO closes once; the request alone never counts as paid', () => {
  const payment: SupplierCurrencyPaymentRow = { ref: 'rko', number: 'synthetic', date: '02.10.2026 10:00:00',
    posted: true, deleted: false, documentAmount: 100, documentCurrency: 'РУБ', baseDocumentRef: 'request', supplier: 'Supplier' };
  const plan: EvidencePlan = { id: 'plan', planCode: 'PAY-TEST', supplierPartner: 'Supplier', supplierCounterparty: '',
    orderRefs: [order], plannedAmount: 100, paymentMethod: 'CASH', status: 'APPROVED', createdAt: '2026-09-30T00:00:00Z' };
  assert.equal(attachRequestOrderLinks([payment], [request])[0].requestOrderRef, order);
  const match = (payments: SupplierCurrencyPaymentRow[]) => matchProcurementPaymentEvidence([plan], [request], payments, []).get('plan')!;
  assert.equal(match([]).issuedAmount, 0);
  assert.equal(match([payment, payment]).issuedAmount, 100);
  assert.equal(match([payment]).remainingAmount, 0);
  assert.equal(match([{ ...payment, posted: false }]).issuedAmount, 0);
  assert.equal(match([{ ...payment, deleted: true }]).issuedAmount, 0);
});
