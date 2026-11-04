import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyEmployeeKkmShiftClose,firstKkmCloseEvidence} from '../lib/kkm-shift-close-control';
function scenario(){
 const date='2026-11-01',mapping={id:'milana-place',terminalKey:'1010808747019437',oneCCashRegisterRef:'milana-kkm',kktRegistrationNumber:'milana-kkt'};
 const home:any={isActive:true,oneCCashierRef:'milana-cashier',oneCCashRegisterRef:null};
 const day:any={id:1,userId:3,date,startedAt:new Date(date+'T07:21:17Z'),endedAt:new Date(date+'T08:00:56Z'),user:{name:'Чеченова Милана',department:'retail'}};
 let mappings:any[]=[mapping],assignments:any[]=[],checks:any[]=[],reports:any[]=[{kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',shiftNumber:'82',openedAt:date+'T07:12:00Z',closedAt:date+'T07:47:00Z',documentLink:'report-82'}];
 const shift:any={cashRegister:{ref:'milana-kkm',name:'Учебная ККТ'},posted:true,deletionMark:false,number:'1094',fiscalShiftNumber:'82',status:'Закрыта',datetime:date+'T07:24:11Z',openedAt:date+'T07:24:11Z',closedAt:date+'T07:59:33Z',fiscalShiftDate:date+'T07:47:00Z'};
 const db:any={userOneCCashboxMapping:{findUnique:async()=>home},workDayEntry:{findUnique:async()=>day},terminalFiscalMapping:{findMany:async()=>mappings},workdayKkmAssignment:{findMany:async()=>assignments}};
 const calls:any[]=[];
 const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:checks}),getCashShifts:async()=>({ok:true,shifts:[shift]}),loadPlatformaOfdZReports:async(arg:any)=>{calls.push(arg);return{complete:true,data:reports};}};
 return{date,db,home,day,shift,sources,calls,verify:()=>verifyEmployeeKkmShiftClose({db,userId:3,date},sources),setMappings:(x:any[])=>mappings=x,setAssignments:(x:any[])=>assignments=x,setChecks:(x:any[])=>checks=x,setReports:(x:any[])=>reports=x};
}
test('Milana empty shift uses the agreed home workstation, without any same-day receipt',async()=>{
 const s=scenario(),r=await s.verify();assert.equal(r.status,'confirmed');assert.equal(r.fiscalShiftNumber,'82');assert.equal(r.workplaceBasis,'home_workstation');assert.equal(s.calls[0].kktRegistrationNumber,'milana-kkt');
 s.shift.status='Открыта';s.shift.closedAt='';assert.equal((await s.verify()).status,'confirmed','delayed 1C closure does not defeat exact OFD proof');
});
test('OFD starts before external 1C reads and does not wait for their responses',async()=>{
 const s=scenario(),order:string[]=[];let release!:()=>void;
 const barrier=new Promise<void>(r=>{release=r;});
 s.sources.loadOneCKkmChecks=async()=>{order.push('checks');await barrier;return{complete:true,data:[]};};
 s.sources.getCashShifts=async()=>{order.push('shifts');await barrier;return{ok:true,shifts:[s.shift]};};
 const original=s.sources.loadPlatformaOfdZReports;
 s.sources.loadPlatformaOfdZReports=async(arg:any)=>{order.push('ofd');return {...await original(arg),providerFetchedAt:'2026-11-01T08:01:00Z'};};
 const pending=s.verify();await new Promise(r=>setImmediate(r));
 assert.equal(order[0],'ofd');assert.equal(order.includes('checks'),true);assert.equal(order.includes('shifts'),true);
 release();const result=await pending;assert.equal(result.status,'confirmed');
 assert.deepEqual(result.ofdRead?.shiftNumbers,['82']);assert.equal(result.ofdRead?.complete,true);assert.equal(result.ofdRead?.providerFetchedAt,'2026-11-01T08:01:00Z');
});
test('an early home-workplace report cannot confirm a different KKT identified by actual receipts',async()=>{
 const s=scenario();s.setChecks([{cashier:{ref:'milana-cashier'},cashRegisterRef:'foreign-kkm',kktRegistrationNumber:'foreign-kkt',dateTime:'2026-11-01T07:46Z',fiscalDateTime:'2026-11-01T07:46Z',fiscalDriveNumber:'foreign-fn',fiscalDocumentNumber:'1',fiscalSign:'2'}]);
 assert.notEqual((await s.verify()).status,'confirmed');assert.deepEqual(s.calls.map((c:any)=>c.kktRegistrationNumber),['milana-kkt','foreign-kkt']);
});
test('an empty shift never guesses a workstation or accepts another day, device or ambiguous report',async()=>{
 for(const change of [(s:any)=>s.day.user.name='Неизвестный сотрудник',(s:any)=>s.setMappings([]),(s:any)=>s.setMappings([{terminalKey:'1010808747019437',oneCCashRegisterRef:'a',kktRegistrationNumber:'a'},{terminalKey:'1010808747019437',oneCCashRegisterRef:'b',kktRegistrationNumber:'b'}]),(s:any)=>s.setReports([{kktRegistrationNumber:'other',fiscalDriveNumber:'fn',shiftNumber:'82',openedAt:'2026-11-01T07:12Z',closedAt:'2026-11-01T07:47Z'}]),(s:any)=>s.setReports([{kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',shiftNumber:'81',openedAt:'2026-11-01T07:12Z',closedAt:'2026-11-01T07:47Z'}]),(s:any)=>{s.shift.fiscalShiftNumber='';}]){const s=scenario();change(s);assert.notEqual((await s.verify()).status,'confirmed');}
});
test('an explicit day assignment overrides the fixed home workplace when there are no receipts',async()=>{
 const s=scenario();s.setAssignments([{oneCCashRegisterRef:'another-kkm'}]);assert.notEqual((await s.verify()).status,'confirmed');assert.equal(s.calls.length,0,'a missing or inconsistent explicit mapping must not silently fall back to home');
});
test('a stale prefetched report is refreshed before accepting a different fiscal shift',async()=>{
 const s=scenario();let calls=0;s.sources.loadPlatformaOfdZReports=async(_arg:any,mode:any)=>{calls++;return mode?.force?{complete:true,data:[{kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',shiftNumber:'82',openedAt:'2026-11-01T07:12Z',closedAt:'2026-11-01T07:47Z',documentLink:'new'}]}:{complete:true,fromCache:true,data:[{kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',shiftNumber:'81',openedAt:'2026-11-01T07:00Z',closedAt:'2026-11-01T07:10Z'}]};};
 assert.equal((await s.verify()).status,'confirmed');assert.equal(calls,2);
});
test('a new fiscal opening invalidates an older closure even without a subsequent sale',async()=>{
 const s=scenario();s.setChecks([{sourceRef:'check',sourceType:'sale_check',cashier:{ref:'milana-cashier'},cashRegisterRef:'milana-kkm',kktRegistrationNumber:'milana-kkt',dateTime:'2026-11-01T07:32Z',fiscalDateTime:'2026-11-01T07:30Z',fiscalDriveNumber:'fn',fiscalDocumentNumber:'10',fiscalSign:'20'}]);
 s.shift.status='Открыта';s.shift.closedAt='';s.shift.fiscalShiftDate='2026-11-01T07:45Z';
 s.setReports([{kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',shiftNumber:'81',openedAt:'2026-11-01T07:00Z',closedAt:'2026-11-01T07:40Z'}]);
 assert.notEqual((await s.verify()).status,'confirmed');
});
test('the initial failed evidence survives a photo response and later successful reconciliation',()=>{
 const first:any={status:'unavailable',checkedAt:'2026-11-01T08:00:00Z',sourceError:'Первоначальный ответ источника'},later:any={status:'confirmed',checkedAt:'2026-11-01T08:01:00Z'};
 assert.deepEqual(firstKkmCloseEvidence({evidence:first},later),first);assert.deepEqual(firstKkmCloseEvidence({firstEvidence:first,evidence:later},later),first);assert.deepEqual(firstKkmCloseEvidence(null,later),later);
});
test('a credit receipt may omit the KKM ref, but partial identities from two different devices are never combined',async()=>{
 const s=scenario();const credit={sourceRef:'credit',sourceType:'credit_realization',cashier:{ref:'milana-cashier'},cashRegisterRef:'',kktRegistrationNumber:'milana-kkt',dateTime:'2026-11-01T07:59Z',fiscalDateTime:'2026-11-01T07:46Z',fiscalDriveNumber:'fn',fiscalDocumentNumber:'1',fiscalSign:'2'};
 s.setChecks([credit]);assert.equal((await s.verify()).status,'confirmed');
 s.setChecks([{...credit,kktRegistrationNumber:'foreign-kkt'}]);assert.notEqual((await s.verify()).status,'confirmed');
 s.setChecks([{...credit,cashRegisterRef:'foreign-kkm',kktRegistrationNumber:''}]);assert.notEqual((await s.verify()).status,'confirmed');
});
test('replacement workplace reuses real overlapping workdays, including when the colleague has already left',async()=>{
 const {resolveKkmCloseWorkplace}=await import('../lib/kkm-close-workplace');
 const date='2026-11-01',user={name:'Костеренко Магомед',department:'retail'},day={userId:5,date,startedAt:new Date(date+'T05:00Z'),endedAt:new Date(date+'T17:00Z'),user};
 const mappings=[{id:'m',terminalKey:'1010808747019437',oneCCashRegisterRef:'m-kkm',kktRegistrationNumber:'m-kkt'},{id:'z',terminalKey:'2332022071',oneCCashRegisterRef:'z-kkm',kktRegistrationNumber:'z-kkt'}];
 let entries:any[]=[day,{userId:3,startedAt:new Date(date+'T06:00Z'),endedAt:new Date(date+'T15:00Z'),user:{name:'Чеченова Милана'}}];
 const db:any={workDayEntry:{findUnique:async()=>day,findMany:async()=>entries},terminalFiscalMapping:{findMany:async()=>mappings,findUnique:async({where}:any)=>mappings.find(m=>m.id===where.id)},workdayKkmAssignment:{findMany:async()=>[]},userOneCCashboxMapping:{findUnique:async()=>({isActive:true,oneCCashRegisterRef:null}),findMany:async()=>[]}};
 assert.equal((await resolveKkmCloseWorkplace(db,5,date))?.cashRegisterRef,'z-kkm');
 entries.push({userId:4,startedAt:new Date(date+'T07:00Z'),endedAt:new Date(date+'T16:00Z'),user:{name:'Абшаева Зухра'}});
 assert.equal(await resolveKkmCloseWorkplace(db,5,date),null,'three overlapping employees do not establish a unique replacement workstation');
});

test('new OFD receipt and second closure confirm the mapped KKT even when both are absent from 1C',async()=>{
 const s=scenario();
 s.sources.loadPlatformaOfdReceipts=async()=>({complete:true,checkedAt:'2026-11-01T08:01:00Z',data:[{kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',fiscalDocumentNumber:'3342',fiscalSign:'123',receiptAt:'2026-11-01T07:50:00Z'}]});
 const first={kktRegistrationNumber:'milana-kkt',fiscalDriveNumber:'fn',shiftNumber:'82',openedAt:'2026-11-01T07:12:00Z',closedAt:'2026-11-01T07:47:00Z',documentLink:'report-82'};
 s.setReports([first]);assert.notEqual((await s.verify()).status,'confirmed');
 s.setReports([first,{...first,shiftNumber:'83',openedAt:'2026-11-01T07:49:00Z',closedAt:'2026-11-01T07:52:00Z'}]);
 const result=await s.verify();assert.equal(result.status,'confirmed');assert.equal(result.fiscalShiftNumber,'83');assert.equal(result.ofdReceiptRead?.fiscalDocumentNumber,'3342');
});
