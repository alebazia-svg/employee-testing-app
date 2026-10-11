const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function worker() {
 const handlers={},shown=[],closed=[];
 const self={location:{origin:'https://portal.test'},navigator:{},registration:{showNotification:async(title,options)=>shown.push({title,options}),getNotifications:async()=>['admin-attention-1','workday-employee-1','admin-receipt-1'].map(tag=>({tag,close:()=>closed.push(tag)}))},addEventListener:(type,handler)=>handlers[type]=handler};
 vm.runInNewContext(fs.readFileSync('public/workday-sw.js','utf8'),{self,URL,console});
 return {handlers,shown,closed};
}
test('digest repeats use the same tag and can alert; employee push behavior is unchanged', async()=>{
 const w=worker(); let done;
 const push=async(data)=>{w.handlers.push({data:{json:()=>data},waitUntil:p=>done=p});await done;};
 await push({title:'Два дела',tagPrefix:'admin',notificationId:'attention-1',renotify:true});
 await push({title:'Три дела',tagPrefix:'admin',notificationId:'attention-1',renotify:true});
 assert.equal(w.shown[0].options.tag,w.shown[1].options.tag);
 assert.equal(w.shown[1].options.renotify,true);
 await push({title:'Сотрудник',notificationId:'1',renotify:true});
 assert.equal(w.shown[2].options.renotify,false);
});
test('clearing empty admin queue closes only admin summaries, never employee or receipt pushes',async()=>{
 const w=worker();let done;
 w.handlers.message({data:{type:'ADMIN_ATTENTION_CLEARED'},source:{url:'https://portal.test/admin/inbox'},waitUntil:p=>done=p});await done;
 assert.deepEqual(w.closed,['admin-attention-1']);
 const x=worker();x.handlers.message({data:{type:'ADMIN_ATTENTION_CLEARED'},source:{url:'https://portal.test/employee'},waitUntil:()=>assert.fail('employee must not clear admin notifications')});
 assert.equal(x.closed.length,0);
});
