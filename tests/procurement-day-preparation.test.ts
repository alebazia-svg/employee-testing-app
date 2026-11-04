import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDayPreparation as calc,type PreparationPlan as P} from '../lib/procurement-day-preparation';
const plan=(id='a',patch:Partial<P>={}):P=>({id,status:'APPROVED',plannedDate:'2026-11-04',plannedAmount:1000,paymentMethod:'CASH',foreignAmount:null,evidence:{state:'NO_EVIDENCE',verification:'current',issuedAmount:0,paidAmount:0,remainingAmount:1000,remainingForeignAmount:null},...patch});
const wallet={balance:20,current:true};
const fx=(id='a',patch:Partial<P>={})=>plan(id,{paymentMethod:'USDT',foreignAmount:10,exchangeRate:100,...patch});
const partial=(method='CASH')=>plan('a',{paymentMethod:method,evidence:{...plan().evidence,state:'PARTIALLY_ISSUED',issuedAmount:400,remainingAmount:600}});
test('RUB partial uses reconciled remainder, not full amount',()=>assert.equal(calc([partial()],wallet).get('a')?.amount,600));
test('USDT RUB funding is deducted without inventing foreign units or using wallet twice',()=>assert.equal(calc([partial('USDT')],wallet).get('a')?.amount,600));
test('CNY cash funding reduces preparation',()=>assert.equal(calc([partial('CNY')],wallet).get('a')?.amount,600));
test('foreign partial uses confirmed remaining currency and request rate, not old actual RUB rate',()=>{
 const p=fx('a',{evidence:{...plan().evidence,state:'PARTIALLY_PAID_BY_ONE_C',paidAmount:360,paidForeignAmount:4,remainingAmount:640,remainingForeignAmount:6},fundingSource:'CASH_EXCHANGE'});
 assert.equal(calc([p],wallet).get('a')?.amount,600);
});
test('partial foreign without remaining units is unknown',()=>{const p=fx('a',{evidence:{...plan().evidence,state:'PARTIALLY_PAID_BY_ONE_C',paidAmount:400,remainingAmount:600}});assert.equal(calc([p],wallet).get('a')?.amount,null);});
test('all closure statuses excluded including tolerated remainder and manual completion',()=>{
 for(const state of ['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED'])assert.equal(calc([plan('a',{evidence:{...plan().evidence,state}})],wallet).size,0);
 for(const status of ['CANCELLED','COMPLETED_WITHOUT_TOPUP','RETURNED'])assert.equal(calc([plan('a',{status})],wallet).size,0);
});
test('QR transfer and expense are the same funding chain, no double deduction',()=>{const p=partial('ACCOUNTABLE_QR');p.evidence.qrFunding={state:'confirmed',checkedAt:'2026-11-04',documentRef:'transfer1',amount:1000};assert.equal(calc([p],wallet).get('a')?.amount,0);});
test('QR unallocated account balance is never assigned to supplier',()=>{const p=plan('a',{paymentMethod:'ACCOUNTABLE_QR',evidence:{...plan().evidence,qrFunding:{state:'none',checkedAt:'2026-11-04'}}});assert.equal(calc([p],wallet).get('a')?.amount,1000);});
test('stale QR funding does not show zero',()=>{const p=plan('a',{paymentMethod:'ACCOUNTABLE_QR',evidence:{...plan().evidence,qrFunding:{state:'confirmed',lastConfirmed:true,amount:1000,documentRef:'r',checkedAt:'2026-11-03'}}});assert.equal(calc([p],wallet).get('a')?.amount,null);});
test('one QR transfer cannot fund two requests',()=>{const p=plan('a',{paymentMethod:'ACCOUNTABLE_QR',evidence:{...plan().evidence,qrFunding:{state:'confirmed',amount:1000,documentRef:'r',checkedAt:'2026-11-04'}}});const r=calc([p,{...p,id:'b'}],wallet);assert.equal(r.get('a')?.amount,null);assert.equal(r.get('b')?.amount,null);});
test('wallet is consumed once across days and approval tabs',()=>{const r=calc([fx('b',{status:'SUBMITTED',plannedDate:'2026-11-05'}),fx('a')],{balance:10,current:true});assert.equal(r.get('a')?.amount,0);assert.equal(r.get('b')?.amount,1000);});
test('explicit wallet choice has priority over automatic choice',()=>{const r=calc([fx('a'),fx('b',{fundingSource:'WALLET',plannedDate:'2026-11-06'})],{balance:10,current:true});assert.equal(r.get('a')?.amount,1000);assert.equal(r.get('b')?.amount,0);});
test('cash exchange never consumes wallet',()=>{const r=calc([fx('a',{fundingSource:'CASH_EXCHANGE'}),fx('b')],{balance:10,current:true});assert.equal(r.get('a')?.amount,1000);assert.equal(r.get('b')?.amount,0);});
test('no partial wallet plus exchange; smaller later request can use it',()=>{const r=calc([fx('a'),fx('b',{foreignAmount:5,plannedAmount:500,evidence:{...plan().evidence,remainingAmount:500}})],{balance:5,current:true});assert.equal(r.get('a')?.amount,1000);assert.equal(r.get('b')?.amount,0);});
test('stale or missing wallet blocks inferred cash amount but not explicit exchange',()=>{for(const w of [{balance:10,current:false},{balance:null,current:true}]){assert.equal(calc([fx()],w).get('a')?.amount,null);assert.equal(calc([fx('a',{fundingSource:'CASH_EXCHANGE'})],w).get('a')?.amount,1000);}});
test('explicit wallet shortage cannot silently become cash',()=>assert.equal(calc([fx('a',{fundingSource:'WALLET'})],{balance:5,current:true}).get('a')?.amount,null));
test('undated wallet reserve preserved',()=>{const p=fx('b',{fundingSource:'WALLET',oneCCashEvidence:{fundingDeferral:{date:null,comment:'',changedAt:'2026-11-04T10:00:00Z',actorId:1}}});const r=calc([fx('a'),p],{balance:10,current:true});assert.equal(r.get('a')?.amount,1000);assert.equal(r.get('b')?.day,null);});
test('deferral uses preparation day, never original date',()=>{const p=plan('a',{oneCCashEvidence:{fundingDeferral:{date:'2026-11-06',comment:'',changedAt:'2026-11-04T10:00:00Z',actorId:1}}});assert.equal(calc([p],wallet).get('a')?.day,'2026-11-06');});
test('missing evidence, mismatch, source failure do not turn into zero',()=>{for(const state of ['MISMATCH','SOURCE_UNAVAILABLE','NEEDS_REVIEW'])assert.equal(calc([plan('a',{evidence:{...plan().evidence,state}})],wallet).get('a')?.amount,null);assert.equal(calc([plan()],wallet,false).get('a')?.amount,null);});
test('inconsistent reconciled amounts remain unknown',()=>assert.equal(calc([plan('a',{evidence:{...plan().evidence,remainingAmount:500}})],wallet).get('a')?.amount,null));
test('does not mutate plans or evidence',()=>{const p=partial();const before=JSON.stringify(p);calc([p],wallet);assert.equal(JSON.stringify(p),before);});
test('duplicate requests rejected',()=>assert.throws(()=>calc([plan(),plan()],wallet),/DUPLICATE/));

test('unknown foreign reservation blocks later wallet reuse',()=>{const r=calc([fx('a',{foreignAmount:null}),fx('b')],wallet);assert.equal(r.get('a')?.amount,null);assert.equal(r.get('b')?.amount,null);});
test('confirmed empty wallet needs the known RUB budget even without foreign units',()=>assert.equal(calc([fx('a',{foreignAmount:null})],{balance:0,current:true}).get('a')?.amount,1000));
