import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedEditData} from '../lib/procurement-approved-edit';
import {revisionChanges} from '../lib/procurement-plan-revision';
const plan={supplierPartner:'Luxo',supplierCounterparty:'contract-counterparty',paymentPurpose:'GOODS',orderRefs:['order-423'],orderNumbers:['423'],plannedDate:new Date('2026-10-12'),plannedAmount:'731483',foreignAmount:'8173',exchangeRate:'89.5',paymentMethod:'USDT',currency:'USDT',fundingSource:null,condition:'Комментарий',commissionAmount:null,exchangerName:'',supplierConfirmation:'',updatedAt:new Date('2026-10-12T07:00:00Z')};
const body={plannedDate:'2026-10-13',reason:'Поставщик перенёс отгрузку',version:plan.updatedAt.toISOString()};
test('date-only edit preserves approved amount, FX, supplier and order identity exactly',()=>{
  const {data}=approvedEditData(plan,body,'2026-10-12');
  assert.equal(data.plannedAmount,731483);assert.equal(data.foreignAmount,8173);assert.equal(data.exchangeRate,89.5);
  assert.deepEqual(revisionChanges(plan,data).map(c=>c.key),['plannedDate']);assert.deepEqual(data.orderRefs,plan.orderRefs);
});
test('rejects stale version, injected basis, invalid/past dates and malformed optional reason',()=>{
  for(const bad of [{version:'old'},{orderRefs:['other']},{plannedDate:'2026-02-30'},{plannedDate:'2026-10-11'},{reason:42},{reason:'a'.repeat(501)}])assert.throws(()=>approvedEditData(plan,{...body,...bad},'2026-10-12'));
});
test('admin can edit without explaining; changed fields still produce the audit diff',()=>{
  for(const reason of [undefined,'','   ','OK']){
    const result=approvedEditData(plan,{...body,reason},'2026-10-12');
    assert.equal(result.reason,reason?.trim()||'');
    assert.deepEqual(revisionChanges(plan,result.data).map(c=>c.key),['plannedDate']);
  }
});
test('financial edits validate sums and currency; comment-only never recalculates old FX',()=>{
  assert.throws(()=>approvedEditData(plan,{...body,plannedAmount:-1,foreignAmount:null},'2026-10-12'));
  const changed=approvedEditData(plan,{...body,paymentMethod:'BANK',plannedAmount:'700000'},'2026-10-12').data;
  assert.equal(changed.currency,'RUB');assert.equal(changed.foreignAmount,null);assert.equal(changed.exchangeRate,null);assert.equal(changed.plannedAmount,700000);
  assert.equal(approvedEditData(plan,{version:body.version,reason:'Уточнение',condition:'Новый текст'},'2026-10-12').data.plannedAmount,731483);
});
