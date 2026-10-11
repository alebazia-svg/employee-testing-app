import { createHash } from 'node:crypto';
import { DELIVERY_PERSON } from './procurement-delivery-policy';
export const DELIVERY_CREATE_CONTRACT = 'accountable-create-v1';
export const DELIVERY_CREATE_TEST_CONTRACT = 'accountable-create-test-v1';
export function deliveryCreateMode(env: Record<string, string | undefined> = process.env): 'test' | 'production' | null {
  const test = env.PORTAL_TEST_ACCOUNTABLE_CREATE === '1';
  const production = env.PORTAL_ACCOUNTABLE_CREATE === '1';
  const isolated = env.PORTAL_ISOLATED_DEMO === '1';
  if (test && isolated && !production) return 'test';
  if (production && !test && !isolated) return 'production';
  return null;
}
export function deliveryCreationRef(reminderId: string, mode: 'test' | 'production' = 'test') {
  const h = createHash('sha256').update(`offonika:accountable-create:${mode}:v1:${reminderId}`).digest('hex');
  return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
export type DeliveryCreatePlan = { action: 'create_accountable'; request_ref: string; command_id: string; cashbox_ref: string; amount: number; comment: string; actor: string; report_date: string };
export type DeliveryCreateFunding = { cash_balance: number; allocated_pending: number; unallocated_count: number; other_review_count: number };
export type DeliveryCreateSummary = { ref: string; number: string; date: string; amount: number; cashbox: string; cashboxRef: string; organization: string; recipient: string; status: string; reportDate: string; funding: DeliveryCreateFunding };
export function deliveryCreationSummary(value: unknown, plan: DeliveryCreatePlan): DeliveryCreateSummary {
  const state = value as any, d = state?.document;
  if (!d || d.ref !== plan.request_ref || d.amount !== plan.amount || d.cashbox?.ref !== plan.cashbox_ref
    || d.organization?.ref !== DELIVERY_PERSON.organizationRef || d.currency?.ref !== DELIVERY_PERSON.currencyRef
    || d.is_accountable_issue !== true || d.multiple_recipients !== false
    || d.accountable_person?.ref !== DELIVERY_PERSON.ref || d.posted !== true || d.deletion_mark !== false
    || d.advance_report_date?.slice(0,10) !== plan.report_date || d.payment_form?.cash !== true || d.payment_form?.cashless !== false || d.payment_form?.card !== false
    || d.status?.key !== 'payable' || state.execution?.complete !== true || state.linked_cash_expense_orders?.complete !== true) throw Error('CREATION_READBACK');
  const f = state.funding as DeliveryCreateFunding | undefined;
  if (!f || ![f.cash_balance, f.allocated_pending].every(n => typeof n === 'number' && Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < .0001)
    || f.allocated_pending < 0 || f.cash_balance - f.allocated_pending + .00001 < plan.amount
    || ![f.unallocated_count, f.other_review_count].every(n => Number.isSafeInteger(n) && n >= 0)) throw Error('CREATION_FUNDING_READBACK');
  return { funding: f, ref: d.ref, number: d.number, date: d.date, amount: d.amount, cashbox: d.cashbox.name, cashboxRef: d.cashbox.ref, organization: d.organization.name, recipient: d.accountable_person.name, status: 'К оплате', reportDate: plan.report_date };
}
