const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function setup({hidden=false,throws=false}={}){
 let now=0;const events=[];
 const context={exports:{},document:{visibilityState:hidden?'hidden':'visible'},performance:{now:()=>now},crypto:{randomUUID:()=> 'attempt-test-123'},require:name=>name==='react'?{}:name.includes('Tracker')?{sendEmployeeActivity:e=>{if(throws)throw Error('collector unavailable');events.push(e);}}:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/EmployeeOperationAudit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {events,start:context.exports.beginEmployeeOperation,tick:n=>{now=n;}};
}
test('operation reports one attempt and one timed result without waiting',()=>{const p=setup();const finish=p.start('cash_send',{ref:'cash-ref-123'});p.tick(2300);finish('completed');finish('failed');assert.equal(p.events.length,2);assert.equal(p.events[1].context.durationMs,2300);assert.equal(p.events[1].context.stage,'completed');});
test('disabled preview and hidden actions do not generate events',()=>{for(const config of [{hidden:true},{}]){const p=setup(config);const finish=p.start('payroll_load',{disabled:!config.hidden});finish('completed');assert.equal(p.events.length,0);}});
test('collector failure never breaks an action or its result callback',()=>{const p=setup({throws:true});let finish;assert.doesNotThrow(()=>{finish=p.start('schedule_save');});assert.doesNotThrow(()=>finish('failed','request'));});

function periodPage({preview=null,visible=true}={}){
 let now=100000,effect,cleanup,id=0;const events=[],timers=new Map(),listeners=new Map();
 const document={visibilityState:visible?'visible':'hidden',addEventListener:(n,fn)=>listeners.set(n,fn),removeEventListener:n=>listeners.delete(n)};
 const context={exports:{},document,Date:{now:()=>now},performance:{now:()=>now},crypto:{randomUUID:()=>`attempt-${++id}`},window:{setTimeout:(fn,delay)=>{const key=++id;timers.set(key,{fn,due:now+delay});return key;},clearTimeout:key=>timers.delete(key)},require:name=>name==='react'?{useEffect:fn=>{effect=fn;}}:name.includes('Tracker')?{sendEmployeeActivity:e=>events.push(e)}:name.includes('PreviewProvider')?{useEmployeePreview:()=>preview}:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('components/EmployeeOperationAudit.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
 return {events,mount:(period,enabled=true)=>{cleanup?.();context.exports.useEmployeePeriodView('payroll_view',period,enabled);cleanup=effect();},advance:ms=>{now+=ms;for(const [key,t] of [...timers])if(t.due<=now){timers.delete(key);t.fn();}},visibility:value=>{document.visibilityState=value?'visible':'hidden';listeners.get('visibilitychange')?.();},unmount:()=>cleanup?.()};
}
test('period views record the viewed month and a real return, not polling or a brief background',()=>{
 const p=periodPage();p.mount('2026-10');p.advance(350);p.advance(60000);assert.equal(p.events.length,1);
 p.visibility(false);p.advance(1000);p.visibility(true);p.advance(350);assert.equal(p.events.length,1);
 p.visibility(false);p.advance(60000);p.visibility(true);p.advance(350);assert.equal(p.events.length,2);
 p.mount('2026-09');p.advance(350);assert.deepEqual(p.events.map(e=>e.context.period),['2026-10','2026-10','2026-09']);
 p.unmount();p.visibility(false);p.advance(60000);p.visibility(true);p.advance(350);assert.equal(p.events.length,3);
});
test('period views skip preview, disabled, hidden and abandoned screens',()=>{
 for(const config of [{preview:{}},{visible:false},{}]){const p=periodPage(config);p.mount('2026-10',!!config.preview||config.visible===false);p.advance(350);assert.equal(p.events.length,0);}
 const p=periodPage();p.mount('2026-10');p.advance(100);p.mount('2026-09');p.advance(350);assert.equal(p.events.length,1);assert.equal(p.events[0].context.period,'2026-09');
});

test('schedule refresh preserves weekly API and attention refresh alongside bounded activity capture',async()=>{
 const source=fs.readFileSync('app/(dashboard)/employee/EmployeeTodayClient.tsx','utf8');
 const start=source.indexOf('  const syncScheduleState = useCallback(');
 const end=source.indexOf('\n  useEffect(',start);
 assert.ok(start>0&&end>start);
 const code=ts.transpileModule(source.slice(start,end)+'\nexports.sync=syncScheduleState;', {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 for(const week of ['2026-11-02',null]){
  const requests=[],audit=[],loaded=[],dispatched=[];let deps;
  const context={exports:{},planningWeekStart:week,scheduleMode:'month',calendarMonth:'2026-10',today:'2026-10-26',activeTab:'schedule',preview:null,scheduleAuditSeen:{current:''},navigator:{onLine:true},Set,Event,
   useCallback:(fn,values)=>{deps=values;return fn;},
   beginEmployeeOperation:(action,options)=>{if(!options.disabled)audit.push({action,period:options.period});return stage=>{if(!options.disabled)audit.push({stage});};},
   request:async url=>{requests.push(url);return {ok:true,json:async()=>({ownSchedule:[],departmentSchedule:[],range:{from:'2026-10-26',to:'2026-11-08'}})};},
   isRecord:value=>!!value&&typeof value==='object',replaceScheduleRange:()=>[],replaceVacationRange:()=>[],
   setLoadingScheduleMonth:()=>{},setOwnScheduleState:fn=>fn([]),setDepartmentScheduleState:fn=>fn([]),setOwnVacationsState:()=>{},setDepartmentVacationsState:()=>{},setReplacementRequestDates:()=>{},setLoadedScheduleMonths:fn=>fn(new Set()),setLoadedPlanningWeek:value=>loaded.push(value),window:{dispatchEvent:event=>dispatched.push(event.type)},
  };
  vm.runInNewContext(code,context);await context.exports.sync();await context.exports.sync();
  assert.equal(requests[0],week?'/api/employee/workday/schedule?week=2026-11-02':'/api/employee/workday/schedule?month=2026-10');
  assert.equal(audit.length,2);assert.equal(audit[0].period,week||'2026-10');assert.equal(audit[1].stage,'completed');
  assert.deepEqual(dispatched,['mobo:attention-refresh','mobo:attention-refresh']);assert.equal(loaded.length,week?2:0);assert.ok(deps.includes(week));
 }
});
