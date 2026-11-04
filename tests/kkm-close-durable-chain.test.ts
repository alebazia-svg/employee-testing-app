import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,rm,readdir,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createKkmCloseReportJournal} from '../lib/kkm-close-report-journal';
import {createKkmCloseReportCache,createKkmCloseReportLoader} from '../lib/kkm-close-report-cache';
import {verifyEmployeeKkmShiftClose,kkmShiftCloseRequiresEmployeeAction} from '../lib/kkm-shift-close-control';
import {createKkmCloseConfirmation} from '../lib/kkm-close-confirmation';
import {runKkmCloseBackgroundCycle} from '../lib/kkm-close-background-cycle';
const input={kktRegistrationNumber:'kkt',from:'2026-11-04T00:00:00+03:00',to:'2026-11-05T00:00:00+03:00'};
const report={kktRegistrationNumber:'kkt',fiscalDriveNumber:'fn',shiftNumber:'353',openedAt:'2026-11-04T07:33:00Z',closedAt:'2026-11-04T16:50:00Z',documentLink:'report-353'};
async function fixture(){
 const dir=await mkdtemp(path.join(tmpdir(),'kkm-durable-'));let clock=Date.parse('2026-11-04T17:00:00Z'),reports:any[]=[report],complete=true,receipts:any[]=[],receiptComplete=true;
 const journal=()=>createKkmCloseReportJournal(path.join(dir,'proof'),()=>clock);
 const loader=()=>createKkmCloseReportLoader({cache:createKkmCloseReportCache(path.join(dir,'cache'),()=>clock),journal:journal(),now:()=>clock,load:async()=>({complete,checkedAt:new Date(clock).toISOString(),data:reports})});
 const shift:any={cashRegister:{ref:'kkm'},number:'1101',fiscalShiftNumber:'353',fiscalShiftDate:report.closedAt,posted:true,status:'Открыта',openedAt:'2026-11-04T07:41:38Z',closedAt:'',datetime:'2026-11-04T07:41:38Z'};
 const db:any={userOneCCashboxMapping:{findUnique:async()=>({oneCCashierRef:'cashier'})}};
 const sources:any={loadPlatformaOfdZReports:loader(),loadOneCKkmChecks:async()=>({complete:true,data:[{cashier:{ref:'cashier'},cashRegisterRef:'kkm',kktRegistrationNumber:'kkt',fiscalDateTime:'2026-11-04T14:52:00Z',dateTime:'2026-11-04T15:00:56Z',fiscalDriveNumber:'fn',fiscalDocumentNumber:'3340',fiscalSign:'123'}]}),getCashShifts:async()=>({ok:true,shifts:[shift]}),loadPlatformaOfdReceipts:async(arg:any,options:any)=>{assert.equal(arg.kktRegistrationNumber,'kkt');assert.equal(options.attempts,1);assert.equal(options.timeoutMs,3000);return{complete:receiptComplete,checkedAt:new Date(clock).toISOString(),data:receipts};}};
 return{dir,journal,loader,sources,shift,advance:()=>clock+=600000,setReports:(r:any[],ok=true)=>{reports=r;complete=ok;},setReceipts:(r:any[],ok=true)=>{receipts=r;receiptComplete=ok;},verify:()=>verifyEmployeeKkmShiftClose({db,userId:5,date:'2026-11-04'},sources),cleanup:()=>rm(dir,{recursive:true,force:true})};
}
test('closure survives ten minutes, a new worker and empty or unavailable Z-report responses; no photo action',async()=>{
 const f=await fixture();try{
 await f.sources.loadPlatformaOfdZReports(input,{force:true,prefetch:true});f.advance();f.sources.loadPlatformaOfdZReports=f.loader();f.setReports([]);
 let evidence=await f.verify();assert.equal(evidence.status,'confirmed');assert.equal(evidence.ofdRead?.storedEvidence,true);assert.equal(kkmShiftCloseRequiresEmployeeAction(evidence),false);
 f.setReports([],false);evidence=await f.verify();assert.equal(evidence.status,'confirmed');assert.equal(evidence.ofdRead?.liveReadComplete,false);
 }finally{await f.cleanup();}
});
test('Zukhra reopening: new OFD check blocks first closing before 1C sees the check; second closing confirms',async()=>{
 const f=await fixture();try{
 assert.equal((await f.verify()).status,'confirmed');f.advance();
 f.setReceipts([{kktRegistrationNumber:'kkt',fiscalDriveNumber:'fn',fiscalDocumentNumber:'3342',fiscalSign:'999',receiptAt:'2026-11-04T16:55:00Z'}]);
 let evidence=await f.verify();assert.notEqual(evidence.status,'confirmed');assert.notEqual(evidence.status,'confirmed');
 f.setReports([{...report,shiftNumber:'354',openedAt:'2026-11-04T16:54:00Z',closedAt:'2026-11-04T17:00:00Z'}]);
 evidence=await f.verify();assert.equal(evidence.status,'confirmed');assert.equal(evidence.fiscalShiftNumber,'354');assert.deepEqual(evidence.ofdClosures?.map(r=>r.shiftNumber),['353','354']);
 assert.equal(kkmShiftCloseRequiresEmployeeAction(evidence),false);
 f.shift.fiscalShiftNumber='355';f.shift.fiscalShiftDate='2026-11-04T17:10:00Z';assert.notEqual((await f.verify()).status,'confirmed','a known later empty reopening also blocks old proof');
 }finally{await f.cleanup();}
});
test('no proof, corrupt journal, conflicting closure and OFD receipt outage keep the photo/not-printed escape',async()=>{
 const f=await fixture();try{
 f.setReports([],false);assert.notEqual((await f.verify()).status,'confirmed');
 f.setReports([report]);assert.equal((await f.verify()).status,'confirmed');
 f.setReceipts([],false);assert.notEqual((await f.verify()).status,'confirmed');
 f.setReceipts([]);await f.journal().write(input,{complete:true,checkedAt:'2026-11-04T17:00:00Z',data:[{...report,closedAt:'2026-11-04T16:51:00Z'}]});
 assert.notEqual((await f.verify()).status,'confirmed');
 const data={personalCash:{cashBalance:9680},photos:{zReport:{storagePath:'uploads/shift-control/147/598/z-report-test.jpg',mimeType:'image/jpeg',sizeBytes:100}}};
 assert.equal(createKkmCloseConfirmation(data,5,147,598)?.method,'photo');assert.equal(createKkmCloseConfirmation(data,5,147,598,new Date(),'not_printed')?.method,'not_printed');
 }finally{await f.cleanup();}
});
test('concurrent workers preserve closures of two shifts; other periods/devices and future observations are rejected',async()=>{
 const f=await fixture();try{
 const snapshot={complete:true,checkedAt:'2026-11-04T17:00:00Z',data:[report]};
 await Promise.all([f.journal().write(input,snapshot),f.journal().write(input,{...snapshot,data:[{...report,shiftNumber:'354',openedAt:'2026-11-04T16:54:00Z',closedAt:'2026-11-04T17:00:00Z'}]})]);
 assert.equal((await f.journal().read(input))?.data.length,2);assert.equal(await f.journal().read({...input,kktRegistrationNumber:'other'}),null);
 assert.equal(await f.journal().write(input,{...snapshot,checkedAt:'2026-11-05T17:00:00Z'}),false);
 assert.equal(await f.journal().write(input,{...snapshot,data:[{...report,kktRegistrationNumber:'other'}]}),false);
 }finally{await f.cleanup();}
});
test('the installed dedicated minute job and HTTP entry share prefetch/recheck; push dispatcher stays independent',async()=>{
 const order:string[]=[];const sources:any={prefetch:async()=>{order.push('prefetch');return{checked:2,complete:2};},recheck:async()=>{order.push('recheck');return{checked:1,resolved:1};}};
 assert.equal((await runKkmCloseBackgroundCycle(sources)).kkmShiftClose.resolved,1);assert.deepEqual(order,['prefetch','recheck']);
 sources.prefetch=async()=>{throw Error('outage');};assert.equal((await runKkmCloseBackgroundCycle(sources)).kkmShiftClose.resolved,1);
 for(const file of ['../scripts/refresh-kkm-closures.ts','../app/api/internal/workday-notifications/run/route.ts'])assert.match(readFileSync(new URL(file,import.meta.url),'utf8'),/runKkmCloseBackgroundCycle\(/);
 const service=readFileSync(new URL('../ops/systemd/offonika-kkm-close-refresh.service',import.meta.url),'utf8');assert.match(service,/scripts\/refresh-kkm-closures.ts/);
 assert.match(readFileSync(new URL('../ops/systemd/offonika-kkm-close-refresh.timer',import.meta.url),'utf8'),/OnCalendar=\*-\*-\* \*:\*:00 Europe\/Moscow/);
 assert.doesNotMatch(readFileSync(new URL('../scripts/dispatch-workday-notifications.ts',import.meta.url),'utf8'),/runKkmCloseBackgroundCycle/);
});

test('a corrupted proof file never falls through to automatic confirmation; a same-minute receipt stays ambiguous',async()=>{
 const f=await fixture();try{
  await f.verify();
  f.setReceipts([{kktRegistrationNumber:'kkt',fiscalDriveNumber:'fn',fiscalDocumentNumber:'3342',fiscalSign:'999',receiptAt:report.closedAt}]);
  assert.notEqual((await f.verify()).status,'confirmed');f.setReceipts([]);
  const folder=path.join(f.dir,'proof',(await readdir(path.join(f.dir,'proof')))[0]);const file=(await readdir(folder)).find(n=>n.endsWith('.json'))!;
  await writeFile(path.join(folder,file),'{broken');assert.notEqual((await f.verify()).status,'confirmed');
 }finally{await f.cleanup();}
});
test('handover OFD receipt outage is bounded to one request; existing callers retain their retry defaults',async()=>{
 const {loadPlatformaOfdReceipts}=await import('../lib/terminal-fiscal-sources');
 const before=process.env.PLATFORMA_OFD_PROXY_BASE_URL;process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://isolated.invalid';let calls=0;
 try{
  const result=await loadPlatformaOfdReceipts(input,{attempts:1,timeoutMs:3000,fetchJson:async(_url,options)=>{calls++;assert.ok(options?.signal);throw Error('outage');},sleep:async()=>{throw Error('must not sleep');}});
  assert.equal(result.complete,false);assert.equal(calls,1);
 }finally{if(before===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=before;}
});
