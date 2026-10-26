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
