const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { webcrypto, createHash } = require('node:crypto');
const source = ts.transpileModule(fs.readFileSync('lib/employee-cash-photo-retention.ts','utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
function setup() {
 const stored = new Map();
 const faults = {write:false, read:false, corrupt:false};
 const storage = {
  saveEmployeeCashOutboxItem:async item=>{if(faults.write)throw Error('quota');stored.set(item.id,{...item,photo:new Blob([item.photo])});},
  readEmployeeCashOutboxItem:async id=>{if(faults.read)throw Error('unavailable');const row=stored.get(id);return faults.corrupt?{...row,photo:new Blob(['wrong-photo'])}:row;},
  listEmployeeCashOutboxItems:async()=>{if(faults.read)throw Error('unavailable');return [...stored.values()];},
  removeEmployeeCashOutboxItem:async id=>{if(faults.write)throw Error('unavailable');stored.delete(id);},
  probeEmployeeCashStorage:async()=>{if(faults.write)throw Error('quota');},
 };
 const instantiate=()=>{
  const context={exports:{},Blob,crypto:webcrypto,require:()=>storage,navigator:{storage:{persist:async()=>false}}};
  vm.runInNewContext(source,context);return context.exports;
 };
 const api=instantiate();
 const photo = new File(['first-original-photo'], 'cash.jpg', {type:'image/jpeg'});
 const item={id:require('node:crypto').randomUUID(),userId:7,photo,photoSha256:createHash('sha256').update('first-original-photo').digest('hex'),metadataSaved:false};
 return {api,stored,faults,item,instantiate,storage};
}
test('committed actual original is read back and survives a new app instance',async()=>{
 const s=setup();await s.api.retainEmployeeCashOutboxItem(s.item);
 assert.equal(s.api.isEmployeeCashPhotoVolatile(s.item.id),false);
 const restarted=s.instantiate();const [recovered]=await restarted.listRetainedEmployeeCashOutboxItems();
 assert.equal(await recovered.photo.text(),'first-original-photo');
 assert.equal(recovered.id,s.item.id);
 assert.equal(restarted.hasVolatileEmployeeCashPhoto(7),false);
});
test('quota refusal preserves the first File synchronously and supports re-entry and storage recovery',async()=>{
 const s=setup();s.faults.write=true;
 const pending=s.api.retainEmployeeCashOutboxItem(s.item);
 assert.equal(s.api.hasVolatileEmployeeCashPhoto(7),true);
 await assert.rejects(pending);
 s.faults.read=true;
 const [recovered]=await s.api.listRetainedEmployeeCashOutboxItems();
 assert.equal(recovered.photo,s.item.photo);
 assert.equal(await recovered.photo.text(),'first-original-photo');
 assert.equal(s.api.hasVolatileEmployeeCashPhoto(99),false);
 s.faults.read=false;s.faults.write=false;
 await s.api.retainEmployeeCashOutboxItem(recovered);
 assert.equal(s.api.isEmployeeCashPhotoVolatile(s.item.id),false);
 assert.equal((await s.instantiate().listRetainedEmployeeCashOutboxItems())[0].id,s.item.id);
});
test('successful put with a corrupt or unreadable photo never acknowledges durable evidence',async()=>{
 for(const fault of ['corrupt','read']) {
  const s=setup();s.faults[fault]=true;
  await assert.rejects(s.api.retainEmployeeCashOutboxItem(s.item));
  assert.equal(s.api.isEmployeeCashPhotoVolatile(s.item.id),true);
  assert.equal((await s.api.listRetainedEmployeeCashOutboxItems())[0].photo,s.item.photo);
 }
});
test('metadata update failure retains prior verified photo and newer metadata flag',async()=>{
 const s=setup();await s.api.retainEmployeeCashOutboxItem(s.item);s.faults.write=true;
 await assert.rejects(s.api.retainEmployeeCashOutboxItem({...s.item,metadataSaved:true}));
 const [recovered]=await s.api.listRetainedEmployeeCashOutboxItems();
 assert.equal(recovered.metadataSaved,true);
 assert.equal(recovered.photo,s.item.photo);
 assert.equal(s.api.isEmployeeCashPhotoVolatile(s.item.id),false);
});
test('only the acknowledged key is removed; missing disk storage does not keep a delivered memory-only photo',async()=>{
 const s=setup();s.faults.write=true;
 await assert.rejects(s.api.retainEmployeeCashOutboxItem(s.item));
 await assert.rejects(s.api.retainEmployeeCashOutboxItem({...s.item,id:'second-transfer'}));
 await s.api.removeRetainedEmployeeCashOutboxItem(s.item.id);
 assert.deepEqual(Array.from(await s.api.listRetainedEmployeeCashOutboxItems(),i=>i.id),['second-transfer']);
});
test('preflight failure is advisory; refusing persistent permission is not a storage failure',async()=>{
 const s=setup();assert.equal(await s.api.prepareEmployeeCashStorage(),true);
 s.faults.write=true;assert.equal(await s.api.prepareEmployeeCashStorage(),false);
 await assert.rejects(s.api.retainEmployeeCashOutboxItem(s.item));
 assert.equal((await s.api.listRetainedEmployeeCashOutboxItems())[0].photo,s.item.photo);
});

test('late storage enumeration cannot resurrect a photo already acknowledged and removed',async()=>{
 const s=setup();await s.api.retainEmployeeCashOutboxItem(s.item);
 const snapshot=[...s.stored.values()];
 let release;
 s.storage.listEmployeeCashOutboxItems=()=>new Promise(resolve=>{release=resolve;});
 const listing=s.api.listRetainedEmployeeCashOutboxItems();
 await s.api.removeRetainedEmployeeCashOutboxItem(s.item.id);
 release(snapshot);
 assert.equal((await listing).length,0,'stale disk reads must not recreate an acknowledged upload');
 assert.equal(s.api.hasVolatileEmployeeCashPhoto(7),false);
});

test('app update never reloads a memory-only first photo while React is restoring its outbox counter',()=>{
 const app=fs.readFileSync('app/(dashboard)/employee/EmployeeTodayClient.tsx','utf8');
 const start=app.indexOf('  useEmployeeAppUpdate(() =>');
 const end=app.indexOf('\n\n  useEffect(',start);
 const code=ts.transpileModule(app.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 for(const volatile of [true,false]){
  let state;
  const context={useEmployeeAppUpdate:fn=>{state=fn();},isSaving:false,uploadProgress:null,
   cashPhotoPickerActiveRef:{current:false},cashOutboxSyncing:false,cashOutboxSyncingRef:{current:false},cashOutboxCount:0,
   user:{id:7},hasVolatileEmployeeCashPhoto:()=>volatile,activeTab:'schedule',preview:null};
  vm.runInNewContext(code,context);
  assert.equal(state,volatile?'unsent':'safe_screen');
 }
});

test('blocked IndexedDB opening times out without claiming a saved photo or keeping a late connection open',async()=>{
 const code=ts.transpileModule(fs.readFileSync('lib/employee-cash-outbox.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const timers=new Map();let sequence=0,closed=0,transactions=0;const opening={result:{close(){closed++;},transaction(){transactions++;}}};
 const context={exports:{},Blob,indexedDB:{open:()=>opening},setTimeout:(fn,delay)=>{timers.set(++sequence,{fn,delay});return sequence;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(code,context);
 const pending=context.exports.saveEmployeeCashOutboxItem({id:'first'});
 const [timeout]=timers.values();assert.equal(timeout.delay,5000);timeout.fn();
 await assert.rejects(pending,/OFFLINE_STORAGE_TIMEOUT/);
 opening.onsuccess();assert.equal(closed,1);assert.equal(transactions,0);
});

test('stalled IndexedDB commit aborts; provisional write success cannot freeze or acknowledge the capture',async()=>{
 const code=ts.transpileModule(fs.readFileSync('lib/employee-cash-outbox.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const timers=new Map();let sequence=0,aborted=0,closed=0;const write={result:'first'};
 const transaction={error:null,objectStore:()=>({put:()=>write}),abort(){aborted++;this.onabort();}};
 const opening={result:{close(){closed++;},transaction:()=>transaction}};
 const context={exports:{},Blob,indexedDB:{open:()=>opening},setTimeout:(fn,delay)=>{timers.set(++sequence,{fn,delay});return sequence;},clearTimeout:id=>timers.delete(id)};
 vm.runInNewContext(code,context);
 const pending=context.exports.saveEmployeeCashOutboxItem({id:'first'});opening.onsuccess();await Promise.resolve();
 write.onsuccess?.();let settled=false;void pending.then(()=>{settled=true;},()=>{settled=true;});await Promise.resolve();assert.equal(settled,false);
 const [timeout]=timers.values();assert.equal(timeout.delay,8000);timeout.fn();
 await assert.rejects(pending);assert.equal(aborted,1);assert.ok(closed>0);
});
