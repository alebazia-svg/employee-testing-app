import assert from 'node:assert/strict';
import test from 'node:test';
import {cashInventoryResolution} from '../lib/cash-inventory-resolution';
import {handoverCashResult} from '../lib/workday-handover-view';
import type {OneCCashStatementSummaryResult} from '../lib/one-c';
const now=new Date('2026-10-27T01:00:00+03:00');
const statement:OneCCashStatementSummaryResult={ok:true,path:'/cash-statement-summary',durationMs:1,checkedAt:now.toISOString(),params:{date:'2026-10-26',organizationRef:'org',cashboxRef:'reserve'},register:'ДенежныеСредстваНаличные',date:'2026-10-26',cashbox:{ref:'reserve',name:'Резерв',deleted:false},organization:{ref:'org',name:'Организация',deleted:false},openingBalance:500,incomingTotal:0,outgoingTotal:500,closingBalance:0,movementsCount:1,diagnostics:[],movements:[{period:'26.10.2026 21:29:58',incoming:0,outgoing:500,documentType:'Инвентаризация наличных денежных средств',document:{ref:'inventory',name:'Инвентаризация 00OF-000008'}}]};
const fixture=()=>({actual:0,expected:500,capturedAt:'2026-10-26T18:11:07.616Z',cashboxRef:'reserve',statement:structuredClone(statement)});
test('Milana: exact later inventory resolves the displayed question without replacing the original figures',()=>{
 const input=fixture(),before=structuredClone(input);const resolution=cashInventoryResolution(input,now)!;
 assert.equal(resolution.documentRef,'inventory');assert.equal(resolution.difference,-500);assert.deepEqual(input,before);
 const check={status:'matched' as const,actual:0,expected:500,inventoryResolution:resolution};
 assert.deepEqual(handoverCashResult(0,check),{label:'Оформлено инвентаризацией',tone:'neutral'});
 assert.equal(handoverCashResult(0,{...check,manualReview:{decision:'confirmed_issue'}}).label,'Проблема подтверждена');
});
test('ordinary expense, another cashbox/day, incomplete, stale, earlier or partial inventory never settles the difference',()=>{
 for(const change of [
  (i:ReturnType<typeof fixture>)=>{i.statement.ok=false;},
  (i:ReturnType<typeof fixture>)=>{i.statement.params.cashboxRef='other';},
  (i:ReturnType<typeof fixture>)=>{i.statement.cashbox!.ref='other';},
  (i:ReturnType<typeof fixture>)=>{i.statement.date='2026-10-27';},
  (i:ReturnType<typeof fixture>)=>{i.statement.movements[0].period='27.10.2026 00:01:00';},
  (i:ReturnType<typeof fixture>)=>{i.statement.movementsCount=2;},
  (i:ReturnType<typeof fixture>)=>{i.statement.checkedAt=new Date(+now-400000).toISOString();},
  (i:ReturnType<typeof fixture>)=>{i.statement.movements[0].period='26.10.2026 20:00:00';},
  (i:ReturnType<typeof fixture>)=>{i.statement.movements[0].documentType='Расходный кассовый ордер';},
  (i:ReturnType<typeof fixture>)=>{i.statement.movements[0].document.ref='';},
  (i:ReturnType<typeof fixture>)=>{i.statement.movements[0].outgoing=300;},
  (i:ReturnType<typeof fixture>)=>{i.statement.closingBalance=100;},
  (i:ReturnType<typeof fixture>)=>{i.statement.movements.push({...i.statement.movements[0],incoming:100,outgoing:0});i.statement.movementsCount=2;},
 ]){const input=fixture();change(input);assert.equal(cashInventoryResolution(input,now),null);}
});

test('ordinary movements after an inventory do not undo its historical explanation',()=>{
 const input=fixture();
 input.statement.movements.push({period:'26.10.2026 22:00:00',incoming:1000,outgoing:0,documentType:'Приходный кассовый ордер',document:{ref:'sale',name:'Продажа'}});
 input.statement.movementsCount=2;input.statement.incomingTotal=1000;input.statement.closingBalance=1000;
 assert.equal(cashInventoryResolution(input,now)?.difference,-500);
});
const priorDay=()=>{
 const s=structuredClone(statement);s.date=s.params.date='2026-10-25';s.openingBalance=s.closingBalance=500;s.incomingTotal=s.outgoingTotal=0;s.movements=[];s.movementsCount=0;
 return s;
};
test('an unchanged discrepancy carries through a continuous opening balance to the next-day inventory',()=>{
 const input={...fixture(),capturedAt:'2026-10-25T17:02:03.685Z',statement:priorDay(),followingStatements:[structuredClone(statement)],laterCounts:[{actual:0,expected:500,capturedAt:'2026-10-26T18:11:07.616Z',cashboxRef:'reserve'}]};
 const before=structuredClone(input);
 assert.equal(cashInventoryResolution(input,now)?.documentRef,'inventory');assert.deepEqual(input,before);
 for(const change of [
  (i:typeof input)=>{i.followingStatements[0].openingBalance=600;i.followingStatements[0].closingBalance=100;},
  (i:typeof input)=>{i.followingStatements[0].date=i.followingStatements[0].params.date='2026-10-27';},
  (i:typeof input)=>{i.followingStatements[0].params.organizationRef='other';},
  (i:typeof input)=>{i.laterCounts[0].actual=500;},
  (i:typeof input)=>{i.laterCounts[0].expected=600;i.laterCounts[0].actual=200;},
 ]){const bad=structuredClone(input);change(bad);assert.equal(cashInventoryResolution(bad,now),null);}
});
test('a later backdated ordinary balance does not rewrite the captured gap; duplicate documents remain invalid',()=>{
 const input=fixture();input.statement.openingBalance=600;input.statement.closingBalance=100;
 assert.equal(cashInventoryResolution(input,now)?.difference,-500);
 const duplicate=fixture();duplicate.statement.movements.push({...duplicate.statement.movements[0]});duplicate.statement.movementsCount=2;duplicate.statement.openingBalance=1000;duplicate.statement.outgoingTotal=1000;
 assert.equal(cashInventoryResolution(duplicate,now),null);
});
test('two consistent partial inventories can document the entire original gap',()=>{
 const input=fixture();input.statement.movements[0].outgoing=300;
 input.statement.movements.push({...input.statement.movements[0],period:'26.10.2026 21:40:00',outgoing:200,document:{ref:'second',name:'Вторая инвентаризация'}});input.statement.movementsCount=2;
 assert.equal(cashInventoryResolution(input,now)?.documentRef,'inventory,second');
 input.statement.movements[1].outgoing=100;input.statement.outgoingTotal=400;input.statement.closingBalance=100;
 assert.equal(cashInventoryResolution(input,now),null);
});
