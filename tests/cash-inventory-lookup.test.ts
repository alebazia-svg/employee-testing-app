import assert from 'node:assert/strict';
import test from 'node:test';
import {createCashInventoryLookup} from '../lib/cash-inventory-lookup';
import type {OneCCashStatementSummaryResult} from '../lib/one-c';
const now=new Date('2026-10-27T01:00:00+03:00');
function statement(date:string,inventory=false):OneCCashStatementSummaryResult{return {ok:true,path:'/cash-statement-summary',durationMs:1,checkedAt:now.toISOString(),params:{date,organizationRef:'org',cashboxRef:'reserve'},register:'cash',date,cashbox:{ref:'reserve',name:'Резерв',deleted:false},organization:{ref:'org',name:'Организация',deleted:false},openingBalance:500,incomingTotal:0,outgoingTotal:inventory?500:0,closingBalance:inventory?0:500,movementsCount:inventory?1:0,diagnostics:[],movements:inventory?[{period:date+'T21:29:58+03:00',incoming:0,outgoing:500,documentType:'Инвентаризация наличных денежных средств',document:{ref:'inventory',name:'Документ инвентаризации'}}]:[]};}
test('a next-day lookup shares source reads and recount reads without persisting anything',async()=>{
 let reads=0,counts=0;const lookup=createCashInventoryLookup({organizationRef:'org',now,load:async p=>{reads++;return statement(p.date,true);},db:{shiftControlTask:{findMany:async()=>{counts++;return [];}}} as any});
 const input={actual:0,expected:500,capturedAt:'2026-10-25T20:02:00+03:00',cashboxRef:'reserve',statement:statement('2026-10-25')};
 const [a,b]=await Promise.all([lookup(input),lookup(input)]);assert.equal(a?.documentRef,'inventory');assert.equal(b?.documentRef,'inventory');assert.equal(reads,1);assert.equal(counts,1);
});
test('an invalid baseline source stops additional reads; an outage never becomes proof',async()=>{
 let reads=0;const lookup=createCashInventoryLookup({organizationRef:'org',now,load:async p=>{reads++;return {...statement(p.date),ok:false};},db:{shiftControlTask:{findMany:async()=>[]}} as any});
 const input={actual:0,expected:500,capturedAt:'2026-10-25T20:02:00+03:00',cashboxRef:'reserve',statement:statement('2026-10-25')};
 assert.equal(await lookup({...input,statement:{...input.statement,movementsCount:1}}),null);assert.equal(reads,0);
 assert.equal(await lookup(input),null);assert.equal(reads,1);
});
