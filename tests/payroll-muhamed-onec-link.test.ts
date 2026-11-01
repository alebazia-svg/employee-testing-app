import test from 'node:test';
import assert from 'node:assert/strict';
import {MUHAMED_ONE_C_REF as ref,MUHAMED_PAYROLL_NAME as employee,PROCUREMENT_TRAINEE_REF} from '../lib/payroll-payment-breakdown';
import {resolvePayrollSettlementIdentity,type PayrollCashRead} from '../lib/payroll-one-c-payments';
import {employeeSalaryBalance,type PayrollBalanceRead} from '../lib/payroll-one-c-balances';
import {matchPayrollAdvanceEmployee,applyPayrollOneCAdvances} from '../lib/payroll-one-c-advances';
import {payrollLedgerAccrualPeriod,payrollPostedAccrual,type PayrollLedgerRead} from '../lib/payroll-one-c-ledger';
import {payrollPaymentMonth} from '../lib/payroll-settlement-month';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import PayrollPaymentEvidence, {paymentCardSummary} from '../app/(dashboard)/admin/payroll/PayrollPaymentEvidence';
import {currentPayrollSettlement} from '../lib/payroll-current-export';
const names=[employee,'Тохов Астемир','Костеренко Магомед'];
const cash:PayrollCashRead={dateFrom:'2026-10-01',dateTo:'2026-11-01',checkedAt:'2026-11-01T15:46:28.927Z',documents:[
 {key:'a1969ac8-c965-11f1-8f13-002590803daf:6',documentNumber:'00OF-001901',documentDate:'2026-10-16',amount:7500,comment:'аванс 10.2026',advancePeriod:'2026-10',employeeName:'Кумыков Мухамед',employeeRef:ref,identityConfirmed:true},
 {key:'1a0d2b56-d604-11f1-95c1-002590803daf:2',documentNumber:'00OF-002011',documentDate:'2026-11-01',amount:16500,comment:'',advancePeriod:null,employeeName:'Кумыков Мухамед',employeeRef:ref,identityConfirmed:true},
]};
const balance:PayrollBalanceRead={version:1,asOf:'2026-11-01',checkedAt:'2026-11-01T15:46:28.776Z',rows:[]};
const accrual={employeeRef:ref,organizationRef:'1c2d6c5c-251f-11ec-ac9f-0025901e48ee',key:'6e7f552b-c949-11f1-8f13-002590803daf:2',date:'2026-10-16',sign:-1,amountMinor:2400000,kind:'asset_liability_movement',comment:'Выход за окт закупки(1500*5)\n'};
const ledger:PayrollLedgerRead={dateFrom:cash.dateFrom,dateTo:cash.dateTo,checkedAt:'2026-11-01T15:46:29.188Z',employees:[{employeeName:'Кумыков Мухамед',employeeRef:ref}],movementCount:69,allocationEvidence:{opening:[],movements:[accrual,
 {...accrual,key:'a1969ac8-c965-11f1-8f13-002590803daf:5',sign:1,amountMinor:750000,kind:'cash_expense',comment:''},
 {...accrual,key:'1a0d2b56-d604-11f1-95c1-002590803daf:3',date:'2026-11-01',sign:1,amountMinor:1650000,kind:'cash_expense',comment:''},
]}};
test('confirmed one-m spelling binds the exact recipient and complete zero register; snapshots remain untouched',()=>{
 const before=JSON.stringify({cash,balance,ledger});
 assert.equal(resolvePayrollSettlementIdentity(employee,names,'2026-10',cash,balance,ledger.employees),ref);
 assert.equal(resolvePayrollSettlementIdentity(employee,names,'2026-09',cash,balance,ledger.employees),null);
 assert.equal(employeeSalaryBalance(balance,ref)?.remainingMinor,0);
 assert.equal(employeeSalaryBalance(balance,null),null);
 const summary=paymentCardSummary({periodKey:'2026-10',cash,balance,ledger},employee,names)!;
 assert.ok(summary);assert.equal(summary.accruedInOneC,24000);assert.equal(summary.periodPaid,24000);assert.equal(summary.advances,7500);assert.equal(summary.unassigned,0);assert.equal(summary.balance.remainingMinor,0);
 const exported=currentPayrollSettlement(employee,summary);assert.equal(exported.remaining,0);assert.equal(exported.paid,24000);assert.equal(exported.advance,7500);
 assert.equal(JSON.stringify({cash,balance,ledger}),before,'no rewriting documents, comments or source amounts');
});
test('wrong recipient or a competing portal identity does not inherit this mapping',()=>{
 const doc={...cash.documents[0],periodKey:'2026-10'};
 assert.equal(matchPayrollAdvanceEmployee(doc,names),employee);
 assert.equal(matchPayrollAdvanceEmployee({...doc,employeeRef:PROCUREMENT_TRAINEE_REF},names),null);
 assert.notEqual(matchPayrollAdvanceEmployee(doc,[...names,'Кумыков Мухамед']),employee);
 const conflicting={...cash,documents:[...cash.documents,{...cash.documents[0],employeeName:employee,employeeRef:PROCUREMENT_TRAINEE_REF}]};
 assert.equal(resolvePayrollSettlementIdentity(employee,names,'2026-10',conflicting,balance,ledger.employees),null,'two actual refs are never silently combined');
 assert.equal(matchPayrollAdvanceEmployee({...doc,employeeName:'СтажерЗакупка',employeeRef:PROCUREMENT_TRAINEE_REF},names),employee,'legacy approved advance still maps');
});
test('advance is deducted exactly once and the exact November cash document belongs to October',()=>{
 const advance=cash.documents[0];
 const read={version:1 as const,periodKey:'2026-10',dateFrom:cash.dateFrom,dateTo:cash.dateTo,checkedAt:cash.checkedAt,documents:[{...advance,periodKey:'2026-10'}],issues:[]};
 const result=applyPayrollOneCAdvances([{manager:employee,advance:0,netPay:24000}],read);
 assert.equal(result.rows[0].advance,7500);assert.equal(result.rows[0].netPay,16500);
 assert.equal(payrollPaymentMonth(employee,advance)?.period,'2026-10');
 assert.equal(payrollPaymentMonth(employee,cash.documents[1])?.period,'2026-10');
 for(const change of [{amount:16501},{employeeRef:PROCUREMENT_TRAINEE_REF},{documentNumber:'other'},{documentDate:'2026-11-02'},{key:'other:2'},{comment:'Другая выплата'}])assert.equal(payrollPaymentMonth(employee,{...cash.documents[1],...change}),null);
 assert.equal(payrollPaymentMonth('Тохов Астемир',cash.documents[1])?.basis,'schedule','other established calendar policy remains unchanged');
});
test('only the exact confirmed accrual is October; changed facts remain unassigned',()=>{
 assert.equal(payrollPostedAccrual(ledger,ref,'2026-10'),24000);
 assert.equal(payrollPostedAccrual(ledger,ref,'2026-11'),null);
 for(const change of [{amountMinor:2400001},{employeeRef:PROCUREMENT_TRAINEE_REF},{organizationRef:'other'},{key:'other:2'},{date:'2026-10-17'},{comment:'Выход за окт закупки(1500*6)'},{sign:1},{kind:'cash_expense'}])assert.equal(payrollLedgerAccrualPeriod({...accrual,...change}),null);
});


test('the real payment component shows both October documents without an unassigned warning',()=>{
 Object.assign(globalThis,{React});
 const html=renderToStaticMarkup(React.createElement(PayrollPaymentEvidence,{periodKey:'2026-10',employee,names,read:{data:{periodKey:'2026-10',cash,balance,ledger},error:'',retry:()=>{}}}));
 assert.match(html,/00OF-001901/);assert.match(html,/00OF-002011/);
 assert.match(html,/7\s500/);assert.match(html,/16\s500/);
 assert.doesNotMatch(html,/Уточнить месяц выплаты|Не удалось однозначно сопоставить|пока не подтверждены документами/);
});
