import test from 'node:test';
import assert from 'node:assert/strict';
import { oldestPayrollDebt } from '../lib/payroll-oldest-debt';
import { currentPayrollSettlement } from '../lib/payroll-current-export';
import type { PayrollLedgerRead } from '../lib/payroll-one-c-ledger';
import type { PayrollCashRead } from '../lib/payroll-one-c-payments';
const ref='person';
function fixture(amount=80000, advancePeriod:string|null=null) {
 const base={employeeRef:ref,organizationRef:'org'};
 const ledger:PayrollLedgerRead={dateFrom:'2026-09-01',dateTo:'2026-10-18',checkedAt:'now',employees:[],movementCount:3,allocationEvidence:{
 opening:[{...base,signedMinor:-8680000}],movements:[
 {...base,key:'aug',date:'2026-09-01',sign:-1,amountMinor:10000000,kind:'asset_liability_movement',comment:'Проценты за авг\n'},
 {...base,key:'cash',date:'2026-09-02',sign:1,amountMinor:amount*100,kind:'cash_expense',comment:''},
 {...base,key:'sep',date:'2026-10-01',sign:-1,amountMinor:10150000,kind:'asset_liability_movement',comment:'Проценты за сент\n'},
 ]}};
 const cash:PayrollCashRead={dateFrom:ledger.dateFrom,dateTo:ledger.dateTo,checkedAt:'now',documents:[{key:'cash',employeeRef:ref,employeeName:'Кештова Бэла',documentNumber:'1',documentDate:'2026-09-02',amount,comment:advancePeriod?'аванс за 2026.09':'',advancePeriod,identityConfirmed:true}]};
 return {ledger,cash};
}
test('approved oldest-debt policy separates September and accumulated debt in export',()=>{
 const {ledger,cash}=fixture();
 const result=oldestPayrollDebt('Кештова Бэла',ref,'2026-09',ledger,cash,20830000)!;
 assert.equal(result.remaining,101500);assert.equal(result.olderDebt,106800);assert.equal(result.paid,0);
 assert.equal(currentPayrollSettlement('Кештова Бэла',{periodPaid:result.paid,advances:0,unassigned:0,balance:{remainingMinor:20830000,creditMinor:0},monthly:result}).remaining,101500);
});
test('explicit advance wins over oldest debt',()=>{
 const {ledger,cash}=fixture(80000,'2026-09');
 const result=oldestPayrollDebt('Кештова Бэла',ref,'2026-09',ledger,cash,20830000)!;
 assert.equal(result.remaining,21500);assert.equal(result.paid,80000);assert.equal(result.advances,80000);assert.equal(result.olderDebt,186800);
});
test('ambiguous source, mismatched balance, other employee and incomplete cash fail closed',()=>{
 const {ledger,cash}=fixture();
 assert.equal(oldestPayrollDebt('Другая',ref,'2026-09',ledger,cash,20830000),null);
 assert.equal(oldestPayrollDebt('Кештова Бэла',ref,'2026-09',ledger,cash,1),null);
 assert.equal(oldestPayrollDebt('Кештова Бэла',ref,'2026-09',ledger,{...cash,documents:[]},20830000),null);
 ledger.allocationEvidence!.movements[2].comment='Проценты';
 assert.equal(oldestPayrollDebt('Кештова Бэла',ref,'2026-09',ledger,cash,20830000),null);
});
test('one later issuance can pay older debt and part of September once',()=>{
 const {ledger,cash}=fixture(200000);
 ledger.allocationEvidence!.movements[1].date='2026-10-16';cash.documents[0].documentDate='2026-10-16';
 const result=oldestPayrollDebt('Кештова Бэла',ref,'2026-09',ledger,cash,8830000)!;
 assert.equal(result.remaining,88300);assert.equal(result.paid,13200);assert.equal(result.olderDebt,0);assert.equal(result.currentDocuments[0].amount,13200);
});
