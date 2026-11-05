const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app/(dashboard)/employee/EmployeeTodayClient.tsx'), 'utf8');
const outboxSource = fs.readFileSync(path.join(root, 'lib/employee-cash-outbox.ts'), 'utf8');
const compile = (text) => ts.transpileModule(text, {compilerOptions: {
  target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
}}).outputText;
function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, 'production function boundaries must exist');
  return source.slice(from, to);
}
const actualFunctions = compile([
  section('function uploadFormData<T>(', 'async function submitFormData<T>('),
  section('class EmployeeApiError extends Error', 'type UserSummary ='),
  section('  async function submitCashOperation(', '  async function saveHandoverDraft('),
  section('  const refreshCashOutboxCount = useCallback(', '  const uploadCashItem = useCallback('),
  section('  const uploadCashItem = useCallback(', '  const flushCashOutbox = useCallback('),
  section('  const flushCashOutbox = useCallback(', '  useEffect(() => {\n    const updateConnection'),
].join('\n'));

async function waitFor(predicate) {
 const until=Date.now()+2000;
 while(!predicate()) {if(Date.now()>until)throw Error('test event timeout');await new Promise(resolve=>setTimeout(resolve,2));}
}

function setup({ storageFails = false, removalFails = false, refreshFails = false, holdResponse = false, metadataFirst = true, newProtocol = false, failMetadataUpdate = false } = {}) {
  const photo = new File(['photo-bytes'], 'cash.jpg', {type: 'image/jpeg'});
  const item = {id:'12345678-1234-4234-9234-123456789abc',userId:7,
    workDayEntryId:19,workDayDate:'2026-09-04',
    createdAt:'2026-09-04T10:00:00Z', url:'/api/employee/cash-operations',
    amount:'125000,50', direction:'deposit_safe', comment:'test', photo, lastError:''};
  if (newProtocol) Object.assign(item,{protocol:2,metadataFirst,photoSha256:require('node:crypto').createHash('sha256').update('photo-bytes').digest('hex')});
  const row = {id:11, idempotencyKey:item.id,userId:item.userId,amount:125000.5,
    direction:item.direction,status:'pending_1c',workDayEntryId:item.workDayEntryId,date:item.workDayDate};
  if (newProtocol) Object.assign(row,{photoExpectedSha256:item.photoSha256,photoExpectedBytes:photo.size,photoPath:'uploads/original.jpg',photoReceivedAt:new Date().toISOString()});
  const stored = new Map(); let saves=0;
  const requests = [];
  const messages = [];
  const auditStages = [];
  let response = {status:200,body:JSON.stringify({operation:row})};
  let pendingXHR, persistedCallback;
  const duplicateContext={exports:{}};
  vm.runInNewContext(compile(fs.readFileSync(path.join(root,'lib/cash-operation-duplicate.ts'),'utf8')),duplicateContext);
  const outboxContext = {exports:{},Blob,File,FormData,Date};
  vm.runInNewContext(compile(outboxSource),outboxContext);
  class FakeXHR {
    upload = {};
    open() {}
    send(form) {
      requests.push(form);
      if(response.event) {this[response.event]();return;}
      this.upload.onload?.();
      if (holdResponse) { pendingXHR = this; return; }
      this.complete();
    }
    complete() {
      if(response.event) {this[response.event]();return;}
      this.status=response.status;
      this.responseText=response.body;
      this.onload();
    }
  }
  const context = {File,Blob,FormData,Date,Error,queueMicrotask,XMLHttpRequest:FakeXHR,
    cashDuplicateResult:duplicateContext.exports.cashDuplicateResult,
    readEmployeeCashReceipt:async()=>null,
    watchEmployeeCashPersistence:(_, callback)=>{persistedCallback=callback;return()=>{persistedCallback=null;};},
    setCashDuplicateItem:x=>{context.cashDuplicateItem=typeof x==='function'?x(context.cashDuplicateItem):x;},
    cashDuplicateItem:null, setCashPhotoUploaded:()=>{},
    prepareEmployeeCashPhoto:async()=>newProtocol?{protocol:2,photoSha256:item.photoSha256,baselineId:null}:{},
    transferEmployeeCash:async(_item,callbacks)=>{await callbacks.onMetadata(row);return {operation:row};},
    mergeCashOperation:(current,incoming)=>[incoming], CashTransferError:class extends Error{},
    setCashPhotoOutboxCount:()=>{},setCashVolatilePhotoCount:()=>{},setCashStorageUnavailable:()=>{},
    resetCashOperationDraft:()=>{context.cashOperationDraft={direction:null,amount:'',comment:'',idempotencyKey:''};},
    cashTransferInFlightRef:{current:false},cashRetryAfterRef:{current:0},cashRetryDelayRef:{current:0},document:{visibilityState:'visible'},
    sendEmployeeActivity:()=>{},createIdempotencyKey:()=> 'audit-key-12345',
    beginEmployeeOperation:()=>stage=>auditStages.push(stage), // Collector is covered separately; never changes the cash workflow.
    cashMetadataFirstEnabled: metadataFirst,
    preview: null, // Real employee mode; the current component also supports read-only ADMIN preview.
    isRecord:x=>x!==null && typeof x==='object',useCallback:fn=>fn,
    cashOperationDraft:{...item,idempotencyKey:item.id},user:{id:7},activeWorkDay:{id:19,date:'2026-09-04'},
    parseMoneyInput:x=>Number(x.replace(',','.')),
    cashOutboxResponseAcknowledges:outboxContext.exports.cashOutboxResponseAcknowledges,
    cashMetadataAcknowledges:outboxContext.exports.cashMetadataAcknowledges,
    cashOutboxFormData:outboxContext.exports.cashOutboxFormData,
    saveEmployeeCashOutboxItem:async x=>{if(storageFails || failMetadataUpdate && ++saves===2)throw Error('storage unavailable');stored.set(x.id,x);},
    removeEmployeeCashOutboxItem:async id=>{if(removalFails)throw Error('delete failed');stored.delete(id);},
    listEmployeeCashOutboxItems:async()=>[...stored.values()],
    setCashOutboxCount:()=>{},syncCurrentWorkdayState:async()=>{if(refreshFails)throw Error('refresh failed');},
    setError:x=>messages.push(x),setMessage:x=>messages.push(x),setCashOutboxError:x=>messages.push(x),
    setIsSaving:x=>{context.saving=x;},setUploadProgress:()=>{},setCashOutboxSyncing:()=>{},
    setCashOperationDraft:x=>{context.cashOperationDraft=x;},setCashOperationsState:()=>{},
    formatCashOperationAmount:String,cashOperationDirectionLabel:String,
    navigator:{onLine:true},cashOutboxSyncingRef:{current:false},
  };
  context.saveEmployeeCashIntent=(...args)=>context.transferEmployeeCash(...args);
  const safety = {exports:{}, Blob, crypto:require('node:crypto').webcrypto,
    require:()=>({
      saveEmployeeCashOutboxItem:context.saveEmployeeCashOutboxItem,
      readEmployeeCashOutboxItem:async id=>stored.get(id),
      listEmployeeCashOutboxItems:context.listEmployeeCashOutboxItems,
      removeEmployeeCashOutboxItem:context.removeEmployeeCashOutboxItem,
    }),
  };
  vm.runInNewContext(compile(fs.readFileSync(path.join(root,'lib/employee-cash-photo-retention.ts'),'utf8')),safety);
  Object.assign(context,{
    saveEmployeeCashOutboxItem:safety.exports.retainEmployeeCashOutboxItem,
    listEmployeeCashOutboxItems:safety.exports.listRetainedEmployeeCashOutboxItems,
    removeEmployeeCashOutboxItem:safety.exports.removeRetainedEmployeeCashOutboxItem,
    isEmployeeCashPhotoVolatile:safety.exports.isEmployeeCashPhotoVolatile,
  });
  vm.createContext(context);
  vm.runInContext(actualFunctions+'\nthis.flush = flushCashOutbox;',context);
  return {item,row,stored,requests,messages,auditStages,storageRecovered:()=>{storageFails=false;},
    persisted:()=>persistedCallback?.(row),complete:()=>pendingXHR.complete(),
    respond:x=>{response=x;},
    submit:async()=>{await context.submitCashOperation(photo);await waitFor(()=>!context.cashOutboxSyncingRef.current);},submitNow:()=>context.submitCashOperation(photo),flush:async()=>{await waitFor(()=>!context.cashOutboxSyncingRef.current);await context.flush(true);},autoFlush:()=>context.flush(),resolve:async same=>{await context.resolveCashDuplicate(same);await waitFor(()=>!context.cashOutboxSyncingRef.current);},context,
    acknowledges:outboxContext.exports.cashOutboxResponseAcknowledges,
  };
}

const failures = [
  ['network', {event:'onerror'}], ['timeout',{event:'ontimeout'}],
  ['502 HTML',{status:502,body:'<html>Bad gateway</html>'}],
  ['503 JSON',{status:503,body:'{"error":"Service unavailable"}'}],
  ['expired login',{status:401,body:'{"error":"Unauthorized"}'}],
  ['400 server error',{status:400,body:'{"error":"Database unavailable"}'}],
  ['409 conflict',{status:409,body:'{"error":"Conflict"}'}],
  ['200 login HTML',{status:200,body:'<html>Sign in</html>'}],
  ['200 empty',{status:200,body:''}],
  ['200 unrelated JSON',{status:200,body:'{"ok":true}'}],
  ['202 empty',{status:202,body:'{}'}],
];
for(const [name,response] of failures) {
  test(`${name}: initial upload and retry preserve amount, photo and key`,async()=>{
    const s=setup();s.respond(response);await s.submit();
    assert.equal(s.stored.size,1);
    const original=s.stored.get(s.item.id);
    assert.equal(original.amount,s.item.amount);
    assert.equal(await original.photo.text(),'photo-bytes');
    await s.flush();
    assert.equal(s.stored.get(s.item.id),original);
    s.respond({status:202,body:JSON.stringify({operation:s.row})});
    await s.flush();assert.equal(s.stored.size,0);
    assert.equal(s.requests.length,3);
    for(const request of s.requests) {
      assert.equal(request.get('idempotencyKey'),s.item.id);
      assert.equal(request.get('amount'),s.item.amount);
      assert.equal(request.get('workDayEntryId'),'19');
      assert.equal(request.get('workDayDate'),'2026-09-04');
      assert.equal(await request.get('photo').text(),'photo-bytes');
    }
  });
}
for(const patch of [{id:0},{idempotencyKey:'other'},{userId:99},{amount:1},{direction:'phone_reserve'}]) {
  test(`wrong acknowledgement ${JSON.stringify(patch)} keeps the original`,async()=>{
    const s=setup();s.respond({status:200,body:JSON.stringify({operation:{...s.row,...patch}})});
    await s.submit();await s.flush();assert.equal(s.stored.size,1);
  });
}
for(const status of [200,202]) {
  test(`matching ${status} acknowledgement removes only accepted operation`,async()=>{
    const s=setup();s.stored.set('other',{...s.item,id:'other',userId:99});
    s.respond({status,body:JSON.stringify({operation:s.row})});await s.submit();
    assert.deepEqual([...s.stored.keys()],['other']);
  });
}
test('storage unavailable and network failure retain the first photo without claiming durability',async()=>{
  const s=setup({storageFails:true});s.respond({event:'onerror'});await s.submit();
  assert.equal(s.stored.size,0);assert.ok(!s.messages.some(x=>/сохранена на телефоне/.test(x)));assert.equal(s.auditStages.at(-1),'failed');
  const [pending]=await s.context.listEmployeeCashOutboxItems();
  assert.equal(await pending.photo.text(),'photo-bytes');
  assert.equal(s.context.isEmployeeCashPhotoVolatile(pending.id),true);
  s.respond({status:200,body:JSON.stringify({operation:s.row})});
  await s.flush();
  assert.equal((await s.context.listEmployeeCashOutboxItems()).length,0);
  assert.equal(await s.requests.at(-1).get('photo').text(),'photo-bytes');
});
test('failed local deletion retains the same retry key',async()=>{
  const s=setup({removalFails:true});await s.submit();await s.flush();
  assert.equal(s.stored.size,1);
  assert.ok(s.requests.every(x=>x.get('idempotencyKey')===s.item.id));
});
test('UI refresh failure after acceptance never changes a successful save into an error',async()=>{
  const s=setup({refreshFails:true});await s.submit();
  assert.equal(s.stored.size,0);
  assert.ok(!s.messages.some(x=>/сохранена на телефоне|refresh failed/.test(x)));
  assert.ok(s.messages.some(x=>/Зафиксировано/.test(x)));
});
test('recovery after reopening reads stored records and isolates users',async()=>{
  const s=setup();
  s.stored.set(s.item.id,{...s.item,photo:new Blob(['photo-bytes'],{type:'image/jpeg'})});
  s.stored.set('other',{...s.item,id:'other',userId:99});
  await s.flush();assert.deepEqual([...s.stored.keys()],['other']);
  assert.equal(s.requests[0].get('photo').name,`cash-operation-${s.item.id}.jpg`);
});
test('acknowledgement for another workday never deletes the retained operation',async()=>{
  const s=setup();
  s.respond({status:202,body:JSON.stringify({operation:{...s.row,workDayEntryId:20,date:'2026-09-05'}})});
  await s.submit();
  assert.equal(s.stored.size,1);
});


test('a different draft for the same transfer stays in review and is not retried in the background',async()=>{
 const s=setup();const previous={...s.row,id:75,idempotencyKey:'original-key',createdAt:'2026-09-04T10:00:00Z'};
 s.respond({status:409,body:JSON.stringify({code:'CASH_OPERATION_DUPLICATE',requestedIdempotencyKey:s.item.id,operation:previous})});
 await s.submit();assert.equal(s.stored.size,1);assert.equal(s.stored.get(s.item.id).duplicateOf.id,75);
 await s.flush();assert.equal(s.requests.length,1);
 await s.resolve(true);assert.equal(s.stored.size,0);assert.equal(s.requests.length,1,'acknowledging the first transfer must not create another request');
});
test('another actual transfer needs an explicit answer and reuses the retained photo/key',async()=>{
 const s=setup();const previous={...s.row,id:75,idempotencyKey:'original-key',createdAt:'2026-09-04T10:00:00Z'};
 s.respond({status:409,body:JSON.stringify({code:'CASH_OPERATION_DUPLICATE',requestedIdempotencyKey:s.item.id,operation:previous})});await s.submit();
 s.respond({status:200,body:JSON.stringify({operation:s.row})});await s.resolve(false);
 assert.equal(s.requests.length,2);assert.equal(s.requests[1].get('distinctFromOperationId'),'75');
 assert.equal(s.requests[1].get('idempotencyKey'),s.item.id);assert.equal(await s.requests[1].get('photo').text(),'photo-bytes');assert.equal(s.stored.size,0);
});
test('duplicate review survives a refresh when local photo storage is unavailable',async()=>{
 const s=setup({storageFails:true});
 const previous={...s.row,id:75,idempotencyKey:'original-key',createdAt:'2026-09-04T10:00:00Z'};
 s.respond({status:409,body:JSON.stringify({code:'CASH_OPERATION_DUPLICATE',requestedIdempotencyKey:s.item.id,operation:previous})});
 await s.submit();assert.equal(s.stored.size,0);assert.equal(s.context.cashDuplicateItem.duplicateOf.id,75);
 await s.resolve(true);assert.equal(s.context.cashDuplicateItem,null);assert.equal(s.requests.length,1);
});
test('automatic retries back off and neither hidden app nor simultaneous form upload starts another request',async()=>{
 const s=setup();s.respond({event:'onerror'});await s.submit();await s.autoFlush();assert.equal(s.requests.length,1);
 s.context.cashRetryAfterRef.current=0;s.context.document.visibilityState='hidden';await s.autoFlush();assert.equal(s.requests.length,1);
 s.context.document.visibilityState='visible';s.context.cashTransferInFlightRef.current=true;await s.flush();assert.equal(s.requests.length,1);
 s.context.cashTransferInFlightRef.current=false;await s.flush();assert.equal(s.requests.length,2);
});


test('a lost response is recovered by the lightweight receipt without another photo upload',async()=>{
 const s=setup();s.respond({event:'onerror'});await s.submit();assert.equal(s.requests.length,1);
 s.context.readEmployeeCashReceipt=async()=>({operation:s.row});await s.flush();
 assert.equal(s.requests.length,1);assert.equal(s.stored.size,0);
});

test('verified persistence closes the form while 1C waits, without unlocking another cash submission',async()=>{
 const s=setup({holdResponse:true});const pending=s.submit();await waitFor(()=>s.requests.length>0);
 assert.equal(s.context.saving,true);assert.equal(s.context.cashOperationDraft.direction,'deposit_safe');
 s.persisted();await new Promise(setImmediate);
 assert.equal(s.context.saving,false);assert.equal(s.context.cashOperationDraft.direction,null);
 assert.equal(s.context.cashTransferInFlightRef.current,true);assert.equal(s.stored.size,0);
 s.context.saving=true; // Another checklist action owns the general saving flag now.
 s.complete();await pending;
 assert.equal(s.context.saving,true,'late cash completion must not unlock a different checklist action');
 assert.equal(s.requests.length,1);assert.ok(!s.messages.some(x=>/Зафиксировано/.test(x)));
});
test('a lost final response cannot turn a verified portal save back into a phone-only error',async()=>{
 const s=setup({holdResponse:true});const pending=s.submit();await waitFor(()=>s.requests.length>0);
 s.persisted();await new Promise(setImmediate);s.respond({event:'onerror'});s.complete();await pending;
 assert.equal(s.stored.size,0);assert.ok(!s.messages.some(x=>/сохранена на телефоне|Связь прервалась/.test(x)));
 assert.equal(s.auditStages.at(-1),'completed');
});

test('late completion of a confirmed second transfer leaves a newly opened draft intact',async()=>{
 const s=setup({holdResponse:true});
 s.context.cashDuplicateItem={...s.item,duplicateOf:{...s.row,id:75}};
 const pending=s.resolve(false);await waitFor(()=>s.requests.length>0);
 s.persisted();await new Promise(setImmediate);
 assert.equal(s.context.cashOperationDraft.direction,null);
 const nextDraft={direction:'deposit_safe',amount:'9000',comment:'next transfer',idempotencyKey:'next-key'};
 s.context.cashOperationDraft=nextDraft;s.context.saving=true;
 s.complete();await pending;
 assert.equal(s.context.cashOperationDraft,nextDraft,'late response must not reset another form');
 assert.equal(s.context.saving,true);assert.equal(s.requests.length,1);
});

test('recovery switch uses full photo-first v2 transport and retains exact financial identity',async()=>{
 const s=setup({newProtocol:true,metadataFirst:false});await s.submit();
 assert.equal(s.requests.length,1);assert.equal(s.requests[0].get('protocol'),'2');
 assert.equal(s.requests[0].get('idempotencyKey'),s.item.id);
 assert.equal(s.requests[0].get('photoSha256'),s.item.photoSha256);
 assert.equal(await s.requests[0].get('photo').text(),'photo-bytes');
 assert.equal(s.stored.size,0);
});
test('an IndexedDB metadata-flag failure does not block already-retained photo upload after server receipt',async()=>{
 const s=setup({newProtocol:true,failMetadataUpdate:true});await s.submit();
 assert.equal(s.stored.size,0);assert.equal(s.context.cashOperationDraft.direction,null);
 assert.equal(s.context.saving,false);assert.equal(s.auditStages.at(-1),'completed');
});

test('storage refusal never couples a v2 money receipt to photo transport or loses the first capture',async()=>{
 const s=setup({storageFails:true,newProtocol:true});
 let firstCapture;
 s.context.transferEmployeeCash=async(item,callbacks)=>{
  firstCapture=item.photo;
  await callbacks.onMetadata({...s.row,photoPath:null,photoReceivedAt:null});
  throw Error('photo network failure');
 };
 await s.submit();
 assert.equal(s.context.cashOperationDraft.direction,null,'money receipt releases the form');
 const [pending]=await s.context.listEmployeeCashOutboxItems();
 assert.equal(pending.photo,firstCapture);
 assert.equal(pending.metadataSaved,true);
 assert.equal(s.context.isEmployeeCashPhotoVolatile(pending.id),true);
 assert.ok(!s.messages.some(text=>/Фото сохранено на телефоне/.test(text)));
 s.context.transferEmployeeCash=async(item)=>{
  assert.equal(item.photo,firstCapture,'recovery must reuse the first capture');
  assert.equal(item.id,s.item.id,'recovery must reuse the financial key');
  return {operation:s.row};
 };
 await s.flush();
 assert.equal((await s.context.listEmployeeCashOutboxItems()).length,0);
});

test('capture preparation reserves the cash attempt before awaiting file reads',async()=>{
 const s=setup({newProtocol:true});
 const prepare=s.context.prepareEmployeeCashPhoto;let finish,prepares=0,transfers=0;
 s.context.prepareEmployeeCashPhoto=()=>{prepares++;return new Promise(resolve=>{finish=resolve;});};
 const transfer=s.context.transferEmployeeCash;
 s.context.transferEmployeeCash=async(...args)=>{transfers++;return transfer(...args);};
 const first=s.submit();
 assert.equal(s.context.saving,true,'the form must not dismiss or take another photo during preparation');
 await s.submit();assert.equal(prepares,1);
 finish(await prepare());await first;
 assert.equal(transfers,1);assert.equal(s.context.saving,false);assert.equal(s.context.cashTransferInFlightRef.current,false);
});

test('a rejected image releases preparation locks without sending financial data',async()=>{
 const s=setup({newProtocol:true});let transfers=0;
 s.context.prepareEmployeeCashPhoto=async()=>{throw Error('invalid image');};
 s.context.transferEmployeeCash=async()=>{transfers++;};
 await s.submit();
 assert.equal(transfers,0);assert.equal(s.stored.size,0);
 assert.equal(s.context.saving,false);assert.equal(s.context.cashTransferInFlightRef.current,false);
 assert.ok(s.messages.includes('invalid image'));
});

test('phone storage recovers offline without sending money or waiting for network backoff',async()=>{
 const s=setup({storageFails:true,newProtocol:true});let transfers=0;
 s.context.transferEmployeeCash=async()=>{transfers++;throw Error('network unavailable');};
 await s.submit();
 assert.equal(s.context.isEmployeeCashPhotoVolatile(s.item.id),true);
 s.storageRecovered();s.context.navigator.onLine=false;
 s.context.cashRetryAfterRef.current=Date.now()+300000;
 await s.autoFlush();
 assert.equal(transfers,1,'offline recovery must not call financial/photo transport');
 assert.equal(s.context.isEmployeeCashPhotoVolatile(s.item.id),false);
 assert.equal(await s.stored.get(s.item.id).photo.text(),'photo-bytes');
 assert.equal(s.context.cashTransferInFlightRef.current,false);
 s.context.navigator.onLine=true;
 s.context.transferEmployeeCash=async()=>{transfers++;return {operation:s.row};};
 await s.flush();assert.equal(transfers,2);
 assert.equal((await s.context.listEmployeeCashOutboxItems()).length,0);
});

test('real connection/visibility handlers retry immediately on recovery, never while hidden',()=>{
 const effect=compile(section('  useEffect(() => {\n    const updateConnection', '  const syncScheduleState = useCallback('));
 const windowEvents=new Map(),documentEvents=new Map(),sent=[];let interval,cleanup;
 const context={useEffect:fn=>{cleanup=fn();},navigator:{onLine:false},document:{visibilityState:'visible',addEventListener:(name,fn)=>documentEvents.set(name,fn),removeEventListener:name=>documentEvents.delete(name)},
  window:{setInterval:fn=>{interval=fn;return 1;},clearInterval:()=>{},addEventListener:(name,fn)=>windowEvents.set(name,fn),removeEventListener:name=>windowEvents.delete(name)},
  setIsOnline:()=>{},syncCurrentWorkdayState:()=>{},refreshCashOutboxCount:()=>{},flushCashOutbox:force=>sent.push(force)};
 vm.runInNewContext(effect,context);
 assert.equal(sent.length,0);
 context.navigator.onLine=true;windowEvents.get('online')();assert.deepEqual(sent,[true]);
 context.document.visibilityState='hidden';documentEvents.get('visibilitychange')();windowEvents.get('online')();assert.equal(sent.length,1);
 context.document.visibilityState='visible';documentEvents.get('visibilitychange')();assert.deepEqual(sent,[true,true]);
 interval();assert.deepEqual(sent,[true,true,undefined]);
 cleanup();assert.equal(windowEvents.size,0);assert.equal(documentEvents.size,0);
});

test('a slow photo cannot hold another same-amount intent or clear its newer financial guard',async()=>{
 const s=setup({newProtocol:true});
 const metadata={...s.row,photoPath:'',photoReceivedAt:null};
 let finishPhoto,finishSecondIntent,money=0,photoStarted=false;
 const secondKey='22345678-1234-4234-9234-123456789abc';
 const secondRow={...s.row,id:12,idempotencyKey:secondKey};
 s.context.saveEmployeeCashIntent=async(item,callbacks)=>{
  money++;
  const operation=money===1?metadata:await new Promise(resolve=>{finishSecondIntent=resolve;});
  await callbacks.onMetadata(operation);return {operation};
 };
 s.context.transferEmployeeCash=async(item,callbacks)=>{
  if(item.id===s.item.id){
   await callbacks.onMetadata(metadata);photoStarted=true;
   return new Promise(resolve=>{finishPhoto=()=>resolve({operation:s.row});});
  }
  await callbacks.onMetadata(secondRow);return {operation:secondRow};
 };
 await s.submitNow();await waitFor(()=>photoStarted);
 assert.equal(s.context.saving,false);
 assert.equal(s.context.cashTransferInFlightRef.current,false,'photo transport must not reserve another financial attempt');
 assert.equal(s.stored.size,1,'metadata must retain the first original');
 s.context.cashOperationDraft={direction:'deposit_safe',amount:s.item.amount,comment:'second actual transfer',idempotencyKey:secondKey};
 const second=s.submitNow();await waitFor(()=>money===2);
 assert.equal(s.context.cashTransferInFlightRef.current,true);
 finishPhoto();await waitFor(()=>!s.context.cashOutboxSyncingRef.current);
 assert.equal(s.context.cashTransferInFlightRef.current,true,'late first photo must not unlock the second money request');
 finishSecondIntent(secondRow);await second;await waitFor(()=>!s.context.cashOutboxSyncingRef.current);
 assert.equal(money,2);assert.equal(s.context.cashTransferInFlightRef.current,false);
 assert.equal(s.stored.size,0);
});
