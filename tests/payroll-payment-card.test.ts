import test from 'node:test';
import assert from 'node:assert/strict';
import { paymentCardSummary, type Evidence } from '../app/(dashboard)/admin/payroll/PayrollPaymentEvidence';
const ref = '13300392-e2e6-11e1-a47e-0025901e48ef';
const data: Evidence = { periodKey: '2026-09', balance: { version: 1, asOf:'2026-10-18',checkedAt:'2026-10-18T10:00:00Z', rows:[] },
  cash:{ dateFrom:'2026-09-01',dateTo:'2026-10-18',checkedAt:'2026-10-18T10:00:00Z',documents:[
    {key:'doc:1',employeeRef:ref,employeeName:'Чеченова Милана',documentNumber:'1',documentDate:'2026-10-01',amount:12500,comment:'',advancePeriod:null,identityConfirmed:true},
    {key:'doc:2',employeeRef:ref,employeeName:'Чеченова Милана',documentNumber:'2',documentDate:'2026-10-16',amount:76500,comment:'',advancePeriod:null,identityConfirmed:true},
  ]} };
test('card headline and detail share cash sum and authoritative zero without portal rounding debt',()=>{
  const result=paymentCardSummary(data,'Чеченова Милана',['Чеченова Милана']);
  assert.equal(result?.paid,89000);assert.equal(result?.balance.remainingMinor,0);assert.equal(result?.documents.length,2);
  assert.equal(result?.periodPaid,89000);
  assert.equal(paymentCardSummary({...data,periodKey:'2026-10'},'Чеченова Милана',['Чеченова Милана'])?.periodPaid,0);
});
test('missing evidence and unmatched identity remain unknown',()=>{
  assert.equal(paymentCardSummary(null,'Чеченова Милана',['Чеченова Милана']),null);
  assert.equal(paymentCardSummary(data,'Другой сотрудник',['Другой сотрудник']),null);
});
test('confirmed mixed advance updates the card without changing total paid or another month',()=>{
  const evidence: Evidence = {...data,cash:{...data.cash,documents:[{...data.cash.documents[0],employeeName:'Ахобекова Залина',documentNumber:'00OF-001802',amount:23000,comment:'13000 аванс 09.2026'}]}};
  const result=paymentCardSummary(evidence,'Ахобекова Залина',['Ахобекова Залина']);
  assert.equal(result?.advances,13000);assert.equal(result?.paid,23000);
  assert.equal(paymentCardSummary({...evidence,periodKey:'2026-10'},'Ахобекова Залина',['Ахобекова Залина'])?.advances,0);
});
