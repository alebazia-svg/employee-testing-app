import test from 'node:test';
import assert from 'node:assert/strict';
import { deliveryCreationRef, deliveryCreationSummary, type DeliveryCreatePlan } from '../lib/procurement-delivery-create-policy';
import { DELIVERY_PERSON } from '../lib/procurement-delivery-policy';
const ref = deliveryCreationRef('request-1'), cashbox = '22222222-2222-4222-a222-222222222222';
const plan: DeliveryCreatePlan = { action: 'create_accountable', request_ref: ref, command_id: ref, cashbox_ref: cashbox, amount: 15000, comment: 'Поставки', actor: 'test-admin', report_date: '2026-10-09' };
function state() { return { funding: { cash_balance: 30000, allocated_pending: 0, unallocated_count: 11, other_review_count: 0 }, document: { ref, number: 'TEST', date: '2026-10-08T12:00:00', amount: 15000, cashbox: { ref: cashbox, name: 'Касса' }, organization: { ref: DELIVERY_PERSON.organizationRef, name: 'Организация' }, currency: { ref: DELIVERY_PERSON.currencyRef }, accountable_person: { ref: DELIVERY_PERSON.ref, name: 'Астемир' }, is_accountable_issue: true, multiple_recipients: false, payment_form: { cash: true, cashless: false, card: false }, advance_report_date: '2026-10-09 00:00:00', posted: true, deletion_mark: false, status: { key: 'payable' } }, execution: { complete: true }, linked_cash_expense_orders: { complete: true } }; }
test('the same portal request keeps native identity across retries and different choices', () => {
  assert.equal(ref, deliveryCreationRef('request-1')); assert.notEqual(ref, deliveryCreationRef('request-2'));
  assert.match(ref, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});
test('readback requires native payable, posting, exact person, organization, currency, cashbox and amount', () => {
  assert.equal(deliveryCreationSummary(state(), plan).status, 'К оплате');
  for (const patch of [{ status: { key: 'approved' } }, { posted: false }, { deletion_mark: true }, { amount: 15001 }, { cashbox: { ref: 'other' } }, { accountable_person: { ref: 'other' } }, { currency: { ref: 'other' } }, { organization: { ref: 'other' } }, { ref: 'other' }]) {
    const s = state(); Object.assign(s.document, patch); assert.throws(() => deliveryCreationSummary(s, plan));
  }
  const s = state(); s.execution.complete = false; assert.throws(() => deliveryCreationSummary(s, plan));
});


test('funding readback preserves warnings but rejects unknown or insufficient selected cashbox amounts', () => {
  assert.equal(deliveryCreationSummary(state(), plan).funding.unallocated_count, 11);
  for (const patch of [{cash_balance: 10000}, {allocated_pending: 16000}, {allocated_pending: -1}, {cash_balance: NaN}, {unallocated_count: -1}]) {
    const s = state(); Object.assign(s.funding, patch); assert.throws(() => deliveryCreationSummary(s, plan), /CREATION_FUNDING_READBACK/);
  }
});
