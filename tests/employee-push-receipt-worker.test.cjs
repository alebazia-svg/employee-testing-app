const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
function worker(options={}){
 const handlers={},shown=[],requests=[],navigated=[],waiters=[];
 const self={location:{origin:'https://portal.test'},navigator:{},registration:{showNotification:(title,config)=>{shown.push({title,config});return options.displayFails?Promise.reject(Error('os rejected')):Promise.resolve();}},addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(fs.readFileSync('public/workday-sw.js','utf8'),{self,URL,setTimeout,crypto:{randomUUID},AbortSignal:{timeout:ms=>{assert.equal(ms,4000);return undefined;}},fetch:(url,init)=>{requests.push({url,init,body:JSON.parse(init.body)});return options.fetch?options.fetch():Promise.resolve({ok:true,status:200,json:async()=>({recorded:true})});},clients:{matchAll:async()=>[{navigate:url=>{navigated.push(url);return Promise.resolve();},focus:()=>Promise.resolve()}],openWindow:url=>{navigated.push(url);return Promise.resolve();}}});
 const event=extra=>({...extra,waitUntil:p=>waiters.push(p)});
 return {handlers,shown,requests,navigated,waiters,event};
}
test('device receipt and browser display acknowledgement preserve notification options and never claim OS visibility',async()=>{
 const w=worker();w.handlers.push(w.event({data:{json:()=>({notificationId:71,title:'Задание',body:'Проверьте чек',url:'/employee?notification=71',badgeCount:2})}}));await Promise.all(w.waiters);
 assert.deepEqual(w.requests.map(r=>r.body.stage),['received','display_requested']);assert.ok(w.requests.every(r=>r.body.kind==='push_receipt'&&r.body.notificationId===71));
 assert.equal(w.shown.length,1);assert.equal(w.shown[0].config.tag,'workday-71');assert.equal(w.shown[0].config.body,'Проверьте чек');assert.equal(w.shown[0].config.renotify,false);
 assert.ok(w.requests.every(r=>r.init.credentials==='same-origin'&&Object.keys(r.body).sort().join(',')==='key,kind,notificationId,stage'));
});
test('failed display records a distinct failure and retains the original display failure',async()=>{
 const w=worker({displayFails:true});w.handlers.push(w.event({data:{json:()=>({notificationId:72,url:'/employee'})}}));
 const result=await Promise.allSettled(w.waiters);assert.equal(result[0].status,'rejected');await new Promise(resolve=>setTimeout(resolve,0));assert.deepEqual(w.requests.map(r=>r.body.stage),['received','display_failed']);
});
test('unavailable telemetry cannot prevent showing or navigating; push click is not an in-app open',async()=>{
 const w=worker({fetch:()=>Promise.reject(Error('network'))});w.handlers.push(w.event({data:{json:()=>({notificationId:73,url:'/employee'})}}));await Promise.all(w.waiters);
 w.waiters.length=0;let closed=0;w.handlers.notificationclick(w.event({notification:{data:{notificationId:73,url:'/employee?notification=73'},close:()=>closed++}}));await Promise.all(w.waiters);
 assert.equal(closed,1);assert.deepEqual(w.navigated,['https://portal.test/employee?notification=73']);assert.equal(w.requests.at(-1).body.stage,'clicked');assert.equal(w.requests.some(r=>r.body.kind==='notification_open'),false);
});
test('a slow telemetry request cannot delay the actual notification display or navigation',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve);const w=worker({fetch:()=>pending});
 w.handlers.push(w.event({data:{json:()=>({notificationId:74,url:'/employee'})}}));assert.equal(w.shown.length,1);
 w.handlers.notificationclick(w.event({notification:{data:{notificationId:74,url:'/employee'},close(){}}}));
 await new Promise(resolve=>setImmediate(resolve));assert.equal(w.navigated.length,1);release({ok:true,status:200,json:async()=>({recorded:true})});await Promise.all(w.waiters);
});
test('ADMIN, cross-origin, missing and malformed identifiers never generate employee receipts',async()=>{
 for(const payload of [{notificationId:'attention-1',url:'/admin',tagPrefix:'admin'},{notificationId:7,url:'https://other.test/employee'},{notificationId:1.5,url:'/employee'},{url:'/employee'},{}]){
  const w=worker();w.handlers.push(w.event({data:{json:()=>payload}}));await Promise.all(w.waiters);assert.equal(w.shown.length,1);assert.equal(w.requests.length,0);
 }
});
test('closure is recorded separately without changing or inferring its cause',async()=>{
 const w=worker();w.handlers.notificationclose(w.event({notification:{data:{notificationId:75,url:'/procurement'}}}));await Promise.all(w.waiters);assert.equal(w.requests[0].body.stage,'closed');assert.deepEqual(w.navigated,[]);
});


test('a busy collector gets one retry with exactly the same event key, then remains bounded',async()=>{
 let calls=0;const w=worker({fetch:()=>{calls++;return Promise.resolve({ok:true,status:200,json:async()=>({recorded:calls%2===0})});}});
 w.handlers.push(w.event({data:{json:()=>({notificationId:76,url:'/employee'})}}));await Promise.all(w.waiters);
 assert.equal(w.requests.length,4);assert.equal(w.requests[0].init.body,w.requests[1].init.body);assert.equal(w.requests[2].init.body,w.requests[3].init.body);
 assert.deepEqual(w.requests.map(r=>r.body.stage),['received','received','display_requested','display_requested']);
});
