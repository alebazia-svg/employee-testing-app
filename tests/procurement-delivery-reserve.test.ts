import test from 'node:test';
import assert from 'node:assert/strict';
import {deliveryFundingForTopup, DELIVERY_PHONE_RESERVE_REF as reserveRef} from '../lib/procurement-delivery-reserve';
import {deliveryFundingForManagerCashboxes, type DeliveryFunding} from '../lib/procurement-delivery-funding';
import {chooseDeliveryCashbox} from '../lib/procurement-delivery-cashbox-choice';
import {cashboxShiftLabel, cashboxShiftWarning} from '../lib/procurement-cashbox-shift-policy';

const manager='11111111-1111-4111-a111-111111111111';
const safe='22222222-2222-4222-a222-222222222222';
const now=Date.now();
function data():DeliveryFunding {return {checkedAt:new Date(now).toISOString(),topups:[],unassignedCount:0,unassignedAmount:0,reviewCount:0,cashboxes:[
 {ref:manager,name:'Менеджер',balance:20000,pending:1000,count:1,shift:{state:'active',employee:'Менеджер',checkedAt:new Date(now).toISOString(),version:'shift'}},
 {ref:reserveRef,name:'Резерв Под Телефоны',balance:100000,pending:10000,count:2},
 {ref:safe,name:'Резерв Под Телефоны',balance:999999,pending:0,count:0},
]};}
test('only exact approved reserve is added; general manager scope and source stay unchanged',()=>{
 const source=data(), original=JSON.stringify(source);
 const output=deliveryFundingForTopup(source,[manager]);
 assert.deepEqual(output.cashboxes.map(b=>b.ref),[manager,reserveRef]);
 assert.equal(output.cashboxes[1].manualOnly,true);
 assert.equal(output.cashboxes[1].shift?.state,'shared');
 assert.deepEqual(deliveryFundingForManagerCashboxes(source,[manager]).cashboxes.map(b=>b.ref),[manager]);
 assert.equal(JSON.stringify(source),original);
 assert.equal(deliveryFundingForTopup({...source,cashboxes:source.cashboxes.filter(b=>b.ref!==reserveRef)},[manager]).cashboxes.length,1);
});
test('reserve is never auto-selected, even with biggest balance or accidental personal mapping',()=>{
 const source=data();source.cashboxes[1].shift=source.cashboxes[0].shift;
 const output=deliveryFundingForTopup(source,[manager,reserveRef]);
 assert.equal(output.cashboxes.length,2);
 assert.equal(chooseDeliveryCashbox(output,15000,now).selected?.ref,manager);
 const larger=chooseDeliveryCashbox(output,30000,now);
 assert.equal(larger.state,'ready');assert.equal(larger.selected,null);
 assert.deepEqual(larger.candidates.map(b=>b.ref),[reserveRef]);
});
test('reserve still protects pending payments, unknown balances, stale evidence and existing requests',()=>{
 const source=data();
 assert.equal(chooseDeliveryCashbox(deliveryFundingForTopup(source,[]),90000,now).candidates[0]?.ref,reserveRef);
 assert.equal(chooseDeliveryCashbox(deliveryFundingForTopup(source,[]),90001,now).state,'insufficient');
 source.cashboxes[1].pending=null;
 assert.equal(chooseDeliveryCashbox(deliveryFundingForTopup(source,[]),10000,now).state,'unknown');
 assert.equal(chooseDeliveryCashbox(deliveryFundingForTopup(data(),[]),10000,now+300001).state,'stale');
 const existing=data();existing.topups=[{ref:'request',number:'1',date:'',status:'payable',remaining:1000}];
 assert.equal(chooseDeliveryCashbox(deliveryFundingForTopup(existing,[]),10000,now).state,'existing_request');
});
test('shared reserve never pretends a cashier is on shift',()=>{
 const shift=deliveryFundingForTopup(data(),[]).cashboxes[0].shift;
 assert.equal(shift?.employee,'');
 assert.match(cashboxShiftLabel(shift),/ручной выбор/);
 assert.match(cashboxShiftWarning(shift),/менеджеры розницы на смене/);
 assert.doesNotMatch(cashboxShiftWarning(shift),/смена не|Смена не|появится после/);
});
