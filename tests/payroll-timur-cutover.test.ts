import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FILM_TRAINEE_NAME as employee, FILM_PERSONAL_NAME as personal } from '../lib/payroll-trainee';
import { getPayrollSalesManagerNameForPeriod as seller, buildPayrollSalesCompactSnapshot, type PayrollSalesSourceRow } from '../lib/payroll-sales-classification';
import { mapLegacyRetailTraineeRowsForPeriod } from '../lib/payroll-calculation-engine';
import { applyPayrollOneCAdvances, type PayrollAdvanceRead } from '../lib/payroll-one-c-advances';
import { resolvePayrollSettlementIdentities, type PayrollCashRead } from '../lib/payroll-one-c-payments';
import { type PayrollBalanceRead } from '../lib/payroll-one-c-balances';
import { type PayrollLedgerRead } from '../lib/payroll-one-c-ledger';
import { paymentCardSummary } from '../lib/payroll-payment-summary';
import PayrollPaymentEvidence from '../app/(dashboard)/admin/payroll/PayrollPaymentEvidence';
import { currentPayrollSettlement } from '../lib/payroll-current-export';

const oldRef = 'f393105e-c21e-11f0-a343-002590803daf';
// Synthetic personal physical-person ref; NOT the catalog Users ref.
const newRef = '11111111-1111-4111-8111-111111111111';
const names = [employee, 'Костеренко Магомед'];
function sale(manager: string, revenue: number, category = 'Услуги оказываемые'): PayrollSalesSourceRow {
  return { manager, revenue, category, item: 'Услуга без слова поклейка', client: 'Розничный покупатель',
    registrar: 'Реализация', registrars: ['Реализация'], cost: 0, grossProfit: revenue, profitability: 100 };
}
const sales = [sale('СтажерРозница', 100), sale(personal, 200), sale(personal, -50),
  sale(personal, 500, 'Защитные стёкла'), sale('Костеренко Магомед', 100)];

test('month boundary preserves old assignment; combines only November and cuts old seller in December', () => {
  assert.equal(seller('СтажерРозница', '2026-06'), 'Костеренко Магомед');
  assert.equal(seller('СтажерРозница', '2026-08'), null);
  for (const period of ['2026-09', '2026-10', '2026-11']) assert.equal(seller('СтажёрРозница', period), employee);
  for (const period of ['2026-12', '2027-01']) {
    assert.equal(seller('СтажерРозница', period), null);
    assert.equal(seller(personal, period), employee);
  }
  assert.equal(seller(personal, '2026-10'), personal, 'no rewriting past assignments');
  assert.equal(seller('  Назранов   Тимур  ', '2026-11'), employee);
  for (const name of ['Тимур', 'ТимурПоклейкаТест', 'Назранов Тимур Другой', 'Назаранов Тимур']) assert.equal(seller(name, '2026-11'), name);
});

test('November has one 70% summary; materials zero, returns subtract, other managers unchanged', () => {
  const before = JSON.stringify(sales);
  const nov = buildPayrollSalesCompactSnapshot(sales, [], '2026-11');
  assert.equal(nov.managerSummaries.filter(r => r.manager === employee).length, 1);
  assert.equal(nov.managerSummaries.find(r => r.manager === employee)?.totalBonus, 175);
  assert.equal(nov.managerSummaries.some(r => r.manager === personal), false);
  assert.equal(nov.managerSummaries.find(r => r.manager === names[1])?.totalBonus, 50);
  const dec = buildPayrollSalesCompactSnapshot(sales, [], '2026-12');
  assert.equal(dec.managerSummaries.find(r => r.manager === employee)?.totalBonus, 105);
  assert.equal(dec.managerSummaries.find(r => r.manager === names[1])?.totalBonus, 50);
  assert.equal(JSON.stringify(sales), before);
  assert.deepEqual(buildPayrollSalesCompactSnapshot(sales, [], '2026-11'), nov, 'repeat does not accumulate');
  assert.equal(buildPayrollSalesCompactSnapshot(sales.slice(1), [], '2026-11').managerSummaries.find(r => r.manager === employee)?.totalBonus, 105, 'removed sale no longer counted');
});

test('full Excel/UI rows and compact/current calculation use the same period mapping', () => {
  for (const [month, period] of [['10','2026-11'],['11','2026-12']]) {
    const full = mapLegacyRetailTraineeRowsForPeriod(sales, month, '2026');
    assert.deepEqual(buildPayrollSalesCompactSnapshot(full), buildPayrollSalesCompactSnapshot(sales, [], period));
  }
});

const cash: PayrollCashRead = {dateFrom:'2026-11-01',dateTo:'2026-12-01',checkedAt:'2026-12-01T12:00:00Z',documents:[
  {key:'old:1',employeeRef:oldRef,employeeName:'СтажерРозница',documentNumber:'OLD',documentDate:'2026-11-16',amount:40,advancePeriod:'2026-11',comment:'аванс 11.2026',identityConfirmed:true},
  {key:'new:1',employeeRef:newRef,employeeName:personal,documentNumber:'NEW',documentDate:'2026-11-18',amount:60,advancePeriod:'2026-11',comment:'аванс 11.2026',identityConfirmed:true},
  {key:'later:1',employeeRef:oldRef,employeeName:'СтажерРозница',documentNumber:'LATER',documentDate:'2026-12-01',amount:100,advancePeriod:null,comment:'',identityConfirmed:true},
]};
const balance: PayrollBalanceRead = {version:1,asOf:'2026-12-01',checkedAt:cash.checkedAt,rows:[
  {organizationRef:'org',employeeRef:oldRef,employeeName:'СтажерРозница',signedMinor:-10000},
  {organizationRef:'org',employeeRef:newRef,employeeName:personal,signedMinor:2000},
]};
const ledger: PayrollLedgerRead = {dateFrom:cash.dateFrom,dateTo:cash.dateTo,checkedAt:cash.checkedAt,
  employees:balance.rows,movementCount:2,allocationEvidence:{opening:[],movements:[
    {key:'accrual-old',employeeRef:oldRef,organizationRef:'org',date:'2026-11-30',sign:-1,amountMinor:10000,kind:'asset_liability_movement',comment:'Проценты за ноябрь'},
    {key:'accrual-new',employeeRef:newRef,organizationRef:'org',date:'2026-11-30',sign:-1,amountMinor:20000,kind:'asset_liability_movement',comment:'Проценты за ноябрь'},
  ]}};
function read(): PayrollAdvanceRead {return {version:1,periodKey:'2026-11',dateFrom:cash.dateFrom,dateTo:cash.dateTo,checkedAt:cash.checkedAt,issues:[],documents:cash.documents.slice(0,2).map(d=>({...d,periodKey:'2026-11'}))};}

test('both recipient advances deducted once; repeat/manual entries not double deducted', () => {
  const base = [{manager:employee,advance:0,netPay:300}];
  const result = applyPayrollOneCAdvances(base, read());
  assert.equal(result.rows[0].advance,100);assert.equal(result.rows[0].netPay,200);assert.deepEqual(result.issues,[]);
  assert.equal(applyPayrollOneCAdvances(result.rows,read()).rows[0].netPay,200);
  assert.equal(applyPayrollOneCAdvances([{...base[0],advance:20,netPay:280}],read()).rows[0].netPay,280);
  assert.equal(applyPayrollOneCAdvances(base,{...read(),documents:read().documents.slice(0,1)}).rows[0].advance,40);
});

test('payment card and export combine approved identities, preserve actual docs and late payment month', () => {
  const before=JSON.stringify({cash,balance,ledger});
  const summary=paymentCardSummary({periodKey:'2026-11',cash,balance,ledger},employee,names)!;
  assert.ok(summary);assert.equal(summary.documents.length,3);assert.equal(summary.advances,100);
  assert.equal(summary.periodPaid,200);assert.equal(summary.accruedInOneC,300);
  assert.equal(summary.balance.remainingMinor,10000);assert.equal(summary.balance.creditMinor,2000,'do not silently net credits against another source debt');
  assert.equal(summary.unassigned,0);
  const exported=currentPayrollSettlement(employee,summary);
  assert.equal(exported.paid,200);assert.equal(exported.advance,100);
  assert.deepEqual(resolvePayrollSettlementIdentities(employee,names,'2026-12',cash,balance),[oldRef,newRef],'old payment history is not a new sale');
  assert.equal(JSON.stringify({cash,balance,ledger}),before);
});

test('duplicate recipient, unrelated owner, zero refs and uncertain payments stay blocked', () => {
  const duplicate={...cash.documents[1],key:'duplicate:1',employeeRef:'22222222-2222-4222-8222-222222222222'};
  assert.equal(resolvePayrollSettlementIdentities(employee,names,'2026-11',{...cash,documents:[...cash.documents,duplicate]},balance),null);
  const ambiguous=applyPayrollOneCAdvances([{manager:employee,advance:0,netPay:300}],{...read(),documents:[...read().documents,{...duplicate,periodKey:'2026-11'}]});
  assert.equal(ambiguous.rows[0].advance,0);assert.equal(ambiguous.issues.length,1);
  assert.equal(resolvePayrollSettlementIdentities(employee,names,'2026-11',cash,{...balance,rows:[...balance.rows,{...balance.rows[1],employeeName:names[1]}]}),null);
  const unknown={...cash,documents:[{...cash.documents[1],identityConfirmed:false}]};
  assert.equal(paymentCardSummary({periodKey:'2026-11',cash:unknown,balance:{...balance,rows:[]}},employee,names),null);
  const invalid={...cash,documents:cash.documents.map(d=>d.employeeRef===newRef?{...d,employeeRef:'00000000-0000-0000-0000-000000000000'}:d)};
  assert.equal(resolvePayrollSettlementIdentities(employee,names,'2026-11',invalid,{...balance,rows:[]}),null);
});

test('rendered payment component shows both names source payments in one card', () => {
  Object.assign(globalThis,{React});
  const html=renderToStaticMarkup(React.createElement(PayrollPaymentEvidence,{periodKey:'2026-11',employee,names,read:{data:{periodKey:'2026-11',cash,balance,ledger},error:'',retry:()=>{}}}));
  for(const number of ['OLD','NEW','LATER']) assert.match(html,new RegExp(`№ ${number}`));
  assert.doesNotMatch(html,/Не удалось однозначно/);
});
