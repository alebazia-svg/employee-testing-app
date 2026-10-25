import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshHandoverReceipts} from '../lib/terminal-fiscal-handover';

test('handover reads up to now rather than delayed polling cutoff and tolerates a failed source',async()=>{
 const before=Date.now(),day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());
 const calls:any[]=[];
 const db:any={terminalFiscalMapping:{findMany:async()=>[{id:'one'},{id:'two'}]}};
 await refreshHandoverReceipts(db,{userId:5,date:day,department:'retail'},(async(input:any)=>{calls.push(input);if(input.mappingId==='one')throw Error('source unavailable');return {acquired:false};}) as any);
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>+c.periodTo>=before&&+c.periodTo<=Date.now()));
 assert.ok(calls.every(c=>c.closingEmployeeId===5&&c.syncWorkdayControl&&c.syncSourceHealth&&c.persist));
 await refreshHandoverReceipts(db,{userId:5,date:day,department:'wholesale'},(async()=>{throw Error('must not read wholesale');}) as any);
 assert.equal(calls.length,2);
});
