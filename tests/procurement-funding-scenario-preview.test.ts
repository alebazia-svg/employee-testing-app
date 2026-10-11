import test from 'node:test';
import assert from 'node:assert/strict';
import {fundingScenario, type FundingEvidence, ownerAmount, RENT_RESERVE_MINOR} from '../lib/procurement-funding-scenario';

const fixture = (): FundingEvidence => ({
  asOf:'2026-10-11',observedAt:'2026-10-11T12:00:00Z',capturedAt:'2026-10-11T12:00:00Z',
  owner:{accountNames:['Сейф Депозитный','ВТБ КБР','Банк ВТБ КБР'],positions:[{balanceMinor:10_000_000,verified:true},{balanceMinor:100_000_000,verified:true},{balanceMinor:0,verified:true}]},
  payroll:{sourceComplete:true,payableMinor:0,warnings:[]},
  manager:{checkedAt:'2026-10-11T12:00:00Z',cashboxes:[],unassignedAmount:0,unassignedCount:0,reviewCount:0},
  balances:{usdt:{balance:10},accountable:{balance:20}},
  plans:[{id:'a',supplier:'A',status:'SUBMITTED',plannedDate:'2026-10-12',paymentMethod:'CASH',requestedRub:'500000',foreignAmount:null},
    {id:'b',supplier:'B',status:'SUBMITTED',plannedDate:'2026-10-13',paymentMethod:'CASH',requestedRub:'700000',foreignAmount:null}],
  tbank:{status:'verified',statementDate:'2026-10-10',current:false,periodFrom:'2026-09-22',renewsOn:'2026-10-22',freeRemainingMinor:15_000_000,tierOneRemainingMinor:80_000_000,transferredMinor:305_000_000,freeLimitMinor:320_000_000},
  rate:{rate:90,conversionAt:'2026-10-10'},extraCash:[],
});
test('known rent reserve is deducted before any selected payment',()=>{
  const r=fundingScenario(fixture(),['a']);
  assert.equal(r.reserveMinor,RENT_RESERVE_MINOR);
  assert.equal(r.rows[0].steps[0].amount,100000);
  assert.equal(r.rows[0].steps[1].amount,350000);
  assert.equal(r.rows[0].gap,50000);
  assert.equal(r.bankAfter,415000);
});
test('one cash balance and daily withdrawal allowance cannot be used twice',()=>{
  const r=fundingScenario(fixture(),['a','b']);
  assert.equal(r.rows[1].steps.some(s=>s.kind==='cash'),false);
  assert.deepEqual(r.rows[1].steps.map(s=>[s.date,s.amount]),[['2026-10-13',350000]]);
  assert.equal(r.rows[1].gap,350000);
  assert.equal(r.bankAfter,65000);
});
test('same-day requests share one daily allowance',()=>{
  const d=fixture();d.plans[1].plannedDate='2026-10-12';
  const r=fundingScenario(d,['a','b']);
  assert.equal(r.rows[1].steps.length,0);assert.equal(r.rows[1].gap,700000);
});
test('unchecking restores amounts without mutating inputs',()=>{
  const d=fixture(),before=JSON.stringify(d);
  const r=fundingScenario(d,['b']);
  assert.equal(r.rows[0].gap,0);assert.equal(r.rows[0].steps.reduce((n,s)=>n+s.amount,0),700000);
  assert.equal(JSON.stringify(d),before);
});
test('negative owner balances are not spendable',()=>{
  const d=fixture();d.owner.positions[0].balanceMinor=-10000;
  const r=fundingScenario(d,['a']);assert.equal(r.rows[0].steps.some(s=>s.kind==='cash'),false);
});
test('USDT whole-request exchange does not subtract a partial wallet',()=>{
  const d=fixture();d.plans[0].paymentMethod='USDT';d.plans[0].foreignAmount=50;
  const r=fundingScenario(d,['a']);assert.equal(r.total,500000);assert.equal(r.rows[0].walletCovered,false);
});
test('sufficient wallet is consumed once and requires no rubles',()=>{
  const d=fixture();d.plans.forEach(p=>{p.paymentMethod='USDT';p.foreignAmount=8;});
  const r=fundingScenario(d,['a','b']);assert.equal(r.rows[0].need,0);assert.equal(r.rows[1].walletCovered,false);
});
test('unknown currency balance propagates, never assumes zero',()=>{
  const d=fixture();d.plans[0].paymentMethod='USDT';d.plans[0].foreignAmount=8;d.balances.usdt.balance=null;
  const r=fundingScenario(d,['a','b']);assert.equal(r.totalComplete,false);assert.equal(r.rows[0].need,null);
  assert.equal(r.rows[1].blockedByEarlier,true);assert.equal(r.rows[1].steps.length,0);
});
test('historical T-Bank limit does not cover a funding gap',()=>{
  const d=fixture();d.owner.positions.forEach(p=>p.balanceMinor=0);
  const r=fundingScenario(d,['a']);assert.equal(r.rows[0].gap,500000);assert.equal(r.rows[0].steps.length,0);
});
test('manager cash requires assigned obligations and subtracts known pending',()=>{
  const d=fixture();d.manager.cashboxes=[{ref:'a',name:'A',balance:150000,pending:10000},{ref:'b',name:'B',balance:50000,pending:0}];
  d.owner.positions[1].balanceMinor=RENT_RESERVE_MINOR;
  d.plans[0].requestedRub='280000';
  const r=fundingScenario(d,['a'],{includeManagerCash:true});assert.deepEqual(r.rows[0].steps.map(s=>s.amount),[100000,140000,40000]);
  d.manager.unassignedCount=1;d.manager.unassignedAmount=10000;
  const blocked=fundingScenario(d,['a'],{includeManagerCash:true});assert.equal(blocked.managersAllowed,false);
  assert.equal(blocked.rows[0].steps.some(s=>s.source==='A'),false);
});
test('unknown payroll blocks reservation completeness without turning it into zero',()=>{
  const d=fixture();d.payroll={sourceComplete:false,warnings:['known_old_balance_changed']};
  const r=fundingScenario(d,['a']);assert.equal(r.salaryMinor,null);assert.equal(r.reservationsComplete,false);
});
test('today and past dates never assume unused withdrawal capacity',()=>{
  const d=fixture();d.plans[0].plannedDate=d.asOf;
  const r=fundingScenario(d,['a']);assert.equal(r.rows[0].steps.some(s=>s.kind==='withdrawal'),false);assert.equal(r.rows[0].gap,400000);
});
test('closed requests excluded and duplicate identities rejected',()=>{
  const d=fixture();d.plans[0].status='COMPLETED';
  assert.equal(fundingScenario(d,['a','b']).rows.length,1);
  d.plans.push(d.plans[0]);assert.throws(()=>fundingScenario(d,['a']),/DUPLICATE/);
});
test('invalid amounts never become zero or a funding instruction',()=>{
  for(const value of ['NaN','Infinity','-1','']){
    const d=fixture();d.plans[0].requestedRub=value;
    const r=fundingScenario(d,['a']);assert.equal(r.rows[0].need,null);assert.equal(r.rows[0].steps.length,0);
  }
});
test('empty selection has no payment allocation, known reserves remain',()=>{
  const r=fundingScenario(fixture(),[]);assert.equal(r.rows.length,0);assert.equal(r.total,0);assert.equal(r.bankAfter,765000);
});
test('unknown owner source stays distinct from genuine zero',()=>{
  const d=fixture();assert.equal(ownerAmount(d,'missing'),null);assert.equal(ownerAmount(d,'Банк ВТБ КБР'),0);
});
test('QR and bank transfers do not consume cash withdrawal capacity',()=>{
  const d=fixture();d.plans[0].paymentMethod='ACCOUNTABLE_QR';d.plans[0].requestedRub='100000';
  d.plans[1].plannedDate='2026-10-12';d.plans[1].requestedRub='400000';
  const r=fundingScenario(d,['a','b']);assert.equal(r.rows[0].need,99980);assert.equal(r.rows[1].gap,0);
  assert.equal(r.rows[1].steps.find(s=>s.kind==='withdrawal')?.amount,300000);
});
test('future cash is prepared near its deadline rather than frozen weeks early',()=>{
  const d=fixture();d.plans[0].plannedDate='2026-10-24';d.plans[0].requestedRub='250000';
  const r=fundingScenario(d,['a']);assert.equal(r.rows[0].steps.find(s=>s.kind==='withdrawal')?.date,'2026-10-23');
});
test('known mandatory reserves take precedence over manager cash',()=>{
  const d=fixture();d.owner.positions.forEach(p=>p.balanceMinor=0);
  d.manager.cashboxes=[{ref:'m',name:'M',balance:250000,pending:0}];
  const r=fundingScenario(d,['a'],{includeManagerCash:true});assert.equal(r.rows[0].steps[0].amount,15000);
});
test('main route preserves manager cash; optional fallback takes only the uncovered remainder',()=>{
  const d=fixture();d.plans[0].requestedRub='460000';
  d.manager.cashboxes=[{ref:'small',name:'Small till',balance:5000,pending:0},{ref:'large',name:'Large till',balance:30000,pending:1000}];
  const before=JSON.stringify(d),main=fundingScenario(d,['a']);
  assert.equal(main.rows[0].gap,10000);assert.equal(main.rows[0].steps.length,2);
  const alt=fundingScenario(d,['a'],{includeManagerCash:true});
  assert.equal(alt.rows[0].gap,0);
  assert.deepEqual(alt.rows[0].steps.map(s=>[s.source,s.amount]),[['Сейф Депозитный',100000],['Снять через ВТБ',350000],['Large till',10000]]);
  assert.equal(alt.boxes.find(b=>b.ref==='large')!.available,1900000);
  assert.equal(JSON.stringify(d),before);
});
test('manager fallback is not consumed when owner sources cover a payment',()=>{
  const d=fixture();d.plans[0].requestedRub='400000';d.manager.cashboxes=[{ref:'m',name:'M',balance:10000,pending:0}];
  const r=fundingScenario(d,['a'],{includeManagerCash:true});
  assert.equal(r.rows[0].steps.some(s=>s.source==='M'),false);assert.equal(r.boxes[0].available,1000000);
});
test('optional manager fallback cannot be allocated twice across payments',()=>{
  const d=fixture();d.plans[1].plannedDate='2026-10-12';d.manager.cashboxes=[{ref:'m',name:'M',balance:100000,pending:0}];
  const r=fundingScenario(d,['a','b'],{includeManagerCash:true});
  assert.equal(r.rows[0].steps.find(s=>s.source==='M')?.amount,50000);
  assert.equal(r.rows[1].steps.find(s=>s.source==='M')?.amount,50000);
  assert.equal(r.boxes[0].available,0);
});
test('unknown or negative manager pending amounts never inflate capacity',()=>{
  const d=fixture();d.manager.cashboxes=[{ref:'m',name:'M',balance:250000,pending:-1000}];
  assert.equal(fundingScenario(d,['a']).managersAllowed,false);
  d.manager.cashboxes[0].pending=null;assert.equal(fundingScenario(d,['a']).managersAllowed,false);
});
