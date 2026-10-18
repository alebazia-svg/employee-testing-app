import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePayrollLedgerResponse, payrollPostedAccrual } from '../lib/payroll-one-c-ledger';
const row = {organization_ref:'org', employee_ref:'person', employee_name:'Сотрудник'};
const fixture = () => ({ok:true, complete:true, mode:'read-only',write_operations:false,contract_version:'payroll-ledger-v1',
  source:'РегистрНакопления.ПрочиеАктивыПассивы',article:'Заработная плата',payroll_month_assignment:'not_inferred',
  date_from:'2026-10-01',date_to:'2026-10-18',end_exclusive:'19.10.2026 0:00:00',
  opening:[{...row,balance_signed:-23000}],closing:[],movements:[{...row,document_ref:'doc',line_number:1,period:'01.10.2026 17:31:26',sign:1,amount:23000}]});
const parse = (p: unknown) => parsePayrollLedgerResponse(p,'2026-10-01','2026-10-18','2026-10-18T12:00:00Z');
test('complete movement chain reconciles including zero closing and identifies employee',()=>{
  assert.equal(parse(fixture()).movementCount,1); assert.equal(parse(fixture()).employees.length,1);
});
test('incomplete, duplicate and contradictory balances fail closed',()=>{
  const missing=fixture();missing.complete=false;assert.throws(()=>parse(missing));
  const duplicate=fixture();duplicate.movements.push(duplicate.movements[0]);assert.throws(()=>parse(duplicate));
  const mismatch=fixture();mismatch.movements[0].amount=22999;assert.throws(()=>parse(mismatch));
  const crossOrg=fixture();crossOrg.movements[0].organization_ref='other';assert.throws(()=>parse(crossOrg));
  const truncated=fixture();truncated.end_exclusive='02.10.2026 0:00:00';assert.throws(()=>parse(truncated));
});
test('posted accrual requires an explicit month and is not inferred from issuance',()=>{
 const ledger=parse(fixture());
 assert.equal(payrollPostedAccrual(ledger,'person','2026-09'),null);
 const movement={employeeRef:'person',organizationRef:'org',key:'accrual',date:'2026-10-01',sign:-1,amountMinor:10150000,kind:'asset_liability_movement',comment:'Проценты за сент\n'};
 ledger.allocationEvidence!.movements=[movement];ledger.dateFrom='2026-09-01';
 assert.equal(payrollPostedAccrual(ledger,'person','2026-09'),101500);
 assert.equal(payrollPostedAccrual(ledger,'person','2026-10'),null);
 ledger.allocationEvidence!.movements.push({...movement,key:'other',comment:'Бонусы к продажам'});
 assert.equal(payrollPostedAccrual(ledger,'person','2026-09'),null);
});
test('owner-confirmed August premiums never inflate September; changed facts need review',()=>{
 for (const [line,ref,amount] of [
  [2,'55161477-dada-11ea-971d-0025901e48ee',1000000],
  [3,'0fae75a8-b8d2-11ed-a2b7-0025901e48ee',4250000],
  [4,'b46dff11-4e74-11eb-ad6f-0025901e48ee',1000000],
 ] as const) {
  const ledger=parse(fixture());ledger.dateFrom='2026-08-01';
  const premium={employeeRef:ref,organizationRef:'1c2d6c5c-251f-11ec-ac9f-0025901e48ee',key:`d8eb7f2e-a5f9-11f1-b4fd-002590803daf:${line}`,date:'2026-09-01',sign:-1,amountMinor:amount,kind:'asset_liability_movement',comment:'Бонусы к продажам\n'};
  ledger.allocationEvidence!.movements=[premium,{...premium,key:'sept',date:'2026-10-01',amountMinor:12800000,comment:'Проценты за сент'}];
  assert.equal(payrollPostedAccrual(ledger,ref,'2026-08'),amount/100);
  assert.equal(payrollPostedAccrual(ledger,ref,'2026-09'),128000);
  for (const change of [{amountMinor:amount+100},{date:'2026-09-02'},{comment:'Бонусы к продажам за сентябрь'},{key:'another'},{organizationRef:'other'}]) {
   ledger.allocationEvidence!.movements[0]={...premium,...change};
   assert.equal(payrollPostedAccrual(ledger,ref,'2026-09'),null);
  }
 }
});
