import test from 'node:test';
import assert from 'node:assert/strict';
import { payrollPaymentMonth } from '../lib/payroll-settlement-month';
import { paymentCardSummary } from '../app/(dashboard)/admin/payroll/PayrollPaymentEvidence';
const payment={key:'doc:1',employeeRef:'ref',employeeName:'Чеченова Милана',documentNumber:'1',documentDate:'2026-10-01',amount:12500,comment:'',advancePeriod:null,identityConfirmed:true};
test('agreed calendar assigns October 1 and 16 to September, not October',()=>{
  for(const day of ['01','16']) assert.equal(payrollPaymentMonth('Чеченова Милана',{...payment,documentDate:`2026-10-${day}`})?.period,'2026-09');
});
test('date never overrides an explicit advance or unclear comment',()=>{
  assert.equal(payrollPaymentMonth('Чеченова Милана',{...payment,advancePeriod:'2026-10'})?.period,'2026-10');
  assert.equal(payrollPaymentMonth('Чеченова Милана',{...payment,comment:'аванс неизвестный'}),null);
  assert.equal(payrollPaymentMonth('Чеченова Милана',{...payment,documentDate:'2026-10-07'}),null);
});
test('new, departed and conflicting identities cannot inherit the calendar',()=>{
  for(const name of ['Новый сотрудник','Икаев Асад','Кумыков Мухаммед']) assert.equal(payrollPaymentMonth(name,payment),null);
  assert.equal(payrollPaymentMonth('Чеченова Милана',{...payment,identityConfirmed:false}),null);
});
test('confirmed procurement trainee issuance is October, never September',()=>{
  assert.equal(payrollPaymentMonth('Кумыков Мухаммед',{...payment,employeeRef:'70dbcdd8-ce99-11f0-a343-002590803daf',documentNumber:'00OF-001901',documentDate:'2026-10-16',amount:7500})?.period,'2026-10');
});

const reconciled = [
  {employee:'Тохов Астемир',key:'f2401c90-a79a-11f1-8f0e-002590803daf:1',employeeRef:'0fae75a8-b8d2-11ed-a2b7-0025901e48ee',documentNumber:'00OF-001619',documentDate:'2026-09-03',amount:30000,period:'2026-08'},
  {employee:'Ахобекова Залина',key:'dedd8243-af70-11f1-8f0f-002590803daf:1',employeeRef:'55161477-dada-11ea-971d-0025901e48ee',documentNumber:'00OF-001681',documentDate:'2026-09-13',amount:3000,period:'2026-08'},
  {employee:'Улубиев Марат',key:'17ec3a31-c622-11f1-8f13-002590803daf:1',employeeRef:'830a355a-aeab-11df-8fe6-00241d5a8bc3',documentNumber:'00OF-001879',documentDate:'2026-10-07',amount:10000,period:'2026-09'},
];
test('three reviewed historical issuances belong to their reconciled salary months',()=>{
  for(const r of reconciled) assert.deepEqual(payrollPaymentMonth(r.employee,{...payment,...r}),
    {period:r.period,advance:0,days:0,basis:'reconciled'});
});
test('historical allocation requires unchanged document, recipient, date, amount and comment',()=>{
  for(const r of reconciled) for(const change of [
    {key:r.key+'x'},{employeeRef:'another-ref'},{documentNumber:'another-document'},
    {documentDate:'2026-10-08'},{amount:r.amount+1},{comment:'пересмотрено'}, {identityConfirmed:false},
  ]) assert.equal(payrollPaymentMonth(r.employee,{...payment,...r,...change}),null);
  for(const r of reconciled) assert.equal(payrollPaymentMonth('Другой сотрудник',{...payment,...r}),null);
});
test('an explicit new month takes precedence over the historical allocation',()=>{
  for(const r of reconciled) assert.equal(payrollPaymentMonth(r.employee,{...payment,...r,advancePeriod:'2026-10'})?.period,'2026-10');
});
test('Bela issuance with older debt is not forced into August',()=>{
  assert.equal(payrollPaymentMonth('Кештова Бэла',{...payment,documentNumber:'00OF-001632',documentDate:'2026-09-02',amount:80000}),null);
});
test('reconciled issuances enter the selected month once and leave other months unchanged',()=>{
  for(const r of reconciled) {
    const evidence = {periodKey:r.period,balance:{version:1 as const,asOf:'2026-10-18',checkedAt:'2026-10-18T10:00:00Z',rows:[]},
      cash:{dateFrom:'2026-09-01',dateTo:'2026-10-18',checkedAt:'2026-10-18T10:00:00Z',documents:[{...payment,...r,employeeName:r.employee}]}};
    const summary=paymentCardSummary(evidence,r.employee,[r.employee]);
    assert.equal(summary?.periodPaid,r.amount);
    assert.equal(summary?.unassigned,0);
    assert.equal(summary?.advances,0);
    assert.equal(summary?.balance.remainingMinor,0);
    assert.equal(paymentCardSummary({...evidence,periodKey:'2026-10'},r.employee,[r.employee])?.periodPaid,0);
  }
});
