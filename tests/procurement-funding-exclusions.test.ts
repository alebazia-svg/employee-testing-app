import test from 'node:test';
import assert from 'node:assert/strict';
import { fundingExclusionFingerprint, forecastFundingWithExclusions } from '../lib/procurement-funding-exclusions';
import { DELIVERY_PERSON as P } from '../lib/procurement-delivery-policy';
const now=Date.parse('2026-10-11T12:00:00Z');
const id=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
function fixture():any {
  return {ok:true,complete:true,contract_version:'cash-funding-context-v2',organization_ref:P.organizationRef,
    mode:'read-only',write_operations:false,snapshot_consistent:false,automatic_spending_allowed:false,
    automatic_cashbox_selection_allowed:false,available_cash_calculated:false,
    payables_scope:'current_active_register_all_dates_including_future_plans',
    requests_scope:'non_deleted_unposted_or_no_active_history_or_nonzero_native_balance_all_dates_all_forms',
    movement_scope:'nonzero_groups_only_same_grain_as_native_balances',
    cash_as_of:'2026-10-11T15:00:00',read_finished_at:'2026-10-11T15:00:01',
    sections_complete:Object.fromEntries(['cash','requests','distribution','payables','payable_movements'].map(s=>[s,true])),
    cash:[{cashbox_ref:id(1),cashbox_name:'Касса А',currency_ref:P.currencyRef,deleted:false,balance:50000}],
    requests:[2,3].map(n=>({request_ref:id(n),number:String(n),date:'01.01.2025 10:00:00',organization_ref:P.organizationRef,currency_ref:P.currencyRef,version_token:'AQ==',amount:20000,posted:true,status_key:'payable',is_accountable_issue:false,multiple_recipients:false})),
    distribution:[],payables:[2,3].map(n=>({document_ref:id(n),source_ref:null,recipient_ref:id(4),remaining_amount:7000})),
    payable_movements:[2,3].map(n=>({document_ref:id(n),source_ref:null,recipient_ref:id(4),planned_amount:20000,executed_amount:13000})),
  };
}
test('only exact reviewed document is excluded, equally old neighbour stays, input unchanged',()=>{
  const d=fixture(),before=structuredClone(d),fp=fundingExclusionFingerprint(d,d.requests[0]);
  const r=forecastFundingWithExclusions(d,[fp],now);
  assert.equal(r.unassignedCount,1);assert.equal(r.unassignedAmount,7000);assert.equal(r.excludedCount,1);assert.equal(r.excludedUnassignedAmount,7000);assert.deepEqual(d,before);
});
test('edits, changed identity, source, currency or payment invalidate exclusion',()=>{
  for(const mutate of [(d:any)=>d.requests[0].version_token='Ag==',(d:any)=>d.requests[0].amount=25000,(d:any)=>d.requests[0].number='new',
    (d:any)=>{d.payables[0].remaining_amount=6000;d.payable_movements[0].executed_amount=14000;},
    (d:any)=>{d.payables[0].source_ref=id(1);d.payable_movements[0].source_ref=id(1);},
    (d:any)=>d.requests[0].currency_ref=id(9)]){
    const d=fixture(),fp=fundingExclusionFingerprint(d,d.requests[0]);mutate(d);assert.equal(forecastFundingWithExclusions(d,[fp],now).excludedCount,0);
  }
});
test('incomplete, inconsistent or duplicate source cannot be hidden by an exclusion',()=>{
  for(const mutate of [(d:any)=>d.complete=false,(d:any)=>d.payables[0].remaining_amount=8,(d:any)=>d.requests.push(d.requests[0])]){
    const d=fixture(),fp=fundingExclusionFingerprint(d,d.requests[0]);mutate(d);assert.throws(()=>forecastFundingWithExclusions(d,[fp],now));
  }
});
test('source row order and unrelated cash balance do not change reviewed identity',()=>{
  const d=fixture(),fp=fundingExclusionFingerprint(d,d.requests[0]);d.payables.reverse();d.cash[0].balance=40000;
  assert.equal(forecastFundingWithExclusions(d,[fp],now).excludedCount,1);
});
test('missing or closed request is not recreated by policy',()=>{
  const d=fixture(),fp=fundingExclusionFingerprint(d,d.requests[0]);d.requests.shift();d.payables.shift();d.payable_movements.shift();
  assert.equal(forecastFundingWithExclusions(d,[fp],now).excludedCount,0);assert.equal(forecastFundingWithExclusions(d,[fp],now).unassignedCount,1);
});
