import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

async function fixture() {
 const date='2026-11-11';
 const users=[1,2,3,4,5,6,7].map(id=>({id,name:`Сотрудник ${id}`,department:id===3?'wholesale':id===5?'procurement':'retail',accessSessions:[]}));
 const plans=users.map(u=>({userId:u.id,date,status:[2,4].includes(u.id)?'off':'working'}));
 const days=[{userId:3,date,startedAt:new Date(`${date}T09:00:00+03:00`),endedAt:null,qrAcceptedAt:new Date(`${date}T09:00:00+03:00`),shiftLabel:'09:00–19:00',lateMinutes:0,status:'active'},
  {userId:4,date,startedAt:new Date(`${date}T09:00:00+03:00`),endedAt:new Date(`${date}T17:00:00+03:00`),qrAcceptedAt:new Date(`${date}T09:00:00+03:00`),shiftLabel:'09:00–17:00',lateMinutes:0,status:'completed'}];
 const intents=[{userId:2,date,qrAcceptedAt:new Date(`${date}T20:01:00+03:00`)}];
 const corrections=[{id:'manual',sourceId:`7:${date}`,body:JSON.stringify({version:1,userId:7,date,status:'working',actorId:99,actorName:'Администратор',reason:'Подтверждено без QR',correctedAt:`${date}T16:00:00Z`})}];
 const google={plans:[],marks:[] as any[],planAvailable:true,marksAvailable:true,readAt:`${date}T17:00:00Z`};
 const read=(rows:unknown[])=>({findMany:async()=>rows});
 const db={user:read(users),workScheduleEntry:read(plans),employeeVacation:read([{userId:6,dateFrom:date,dateTo:date}]),workDayEntry:read(days),shiftControlRun:read([]),workdayStartIntent:read(intents),adminInboxEvent:read(corrections),
  workdayControlIssue:read([{id:91,user:{name:'Сотрудник 1'},title:'Проверить чек',messages:[],detail:'Обращение сохраняется'}]),
  workdayCloseExceptionRequest:read([{id:'close',employee:{name:'Сотрудник 3'},comment:'Разрешить завершение'}]),
  terminalFiscalEmployeeReview:read([]),cashOperation:read([{id:92,user:{id:1,name:'Сотрудник 1'},date,amount:100,status:'one_c_error'}])};
 const mocks:Record<string,any>={'server-only':{},'./prisma':{prisma:db},'./team-control-source':{getTeamGoogleSnapshot:async()=>google},'./workday-handover-review-server':{loadOpenHandoverReviews:async()=>[]},'./terminal-fiscal-summary':{getTerminalFiscalWorkdaySummary:async()=>null,presentTerminalFiscalWorkdaySummary:()=>({status:'not_run',label:'',detail:''})}};
 const keep=new Set(['./team-calendar-evidence','./team-calendar-fact','./team-control-calendar','./workday','./workday-timing','./team-control','./team-attendance','./workday-handover-review']);
 const output=await build({entryPoints:['lib/admin-home-data.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'home-day-evidence',setup(b){b.onResolve({filter:/.*/},a=>{
  if(a.path in mocks)return {path:a.path,external:true};
  if(a.importer.endsWith('/lib/admin-home-data.ts')&&!keep.has(a.path)){mocks[a.path]={};return {path:a.path,external:true};}
 });}}]});
 const mod={exports:{} as any},require=createRequire(import.meta.url);
 new Function('require','module','exports',output.outputFiles[0].text)((name:string)=>mocks[name]??require(name),mod,mod.exports);
 return {users,plans,days,intents,corrections,google,load:(now:string)=>mod.exports.loadHomeSection('workday',99,new Date(now))};
}
test('home uses calendar cutoffs while keeping actual active/completed shifts and all real questions',async()=>{
 const f=await fixture(),before=JSON.stringify([f.users,f.plans,f.days,f.intents,f.corrections]);
 const earlier=await f.load('2026-11-11T19:59:59+03:00');
 assert.equal(earlier.off,3,'planned off QR-not-yet-accepted, closed procurement and vacation');
 assert.ok(earlier.timing.some((a:any)=>a.id==='timing-1-workday-not-started'));
 const after=await f.load('2026-11-11T20:05:00+03:00');
 assert.equal(after.off,4,'retail/procurement automatic off and vacation; scan intent does not remove planned off');
 assert.equal(after.working,1);assert.equal(after.completed,1);assert.equal(after.notStarted,0);
 assert.ok(!after.timing.some((a:any)=>a.id.includes('workday-not-started')));
 for(const id of ['cash-92','issue-91','close-close'])assert.ok(after.actions.some((a:any)=>a.id===id),id);
 assert.equal(JSON.stringify([f.users,f.plans,f.days,f.intents,f.corrections]),before);
});
test('Google arrival/checkout cannot override the agreed QR day accounting or fabricate an app shift',async()=>{
 const f=await fixture();
 f.google.marks.push(...[1,2].flatMap(id=>[{employee:`Сотрудник ${id}`,date:'2026-11-11',action:'Начало',time:'09:00',timestamp:'2026-11-11T09:00:00+03:00',shift:'09:00–18:00'},{employee:`Сотрудник ${id}`,date:'2026-11-11',action:'Окончание',time:'18:00',timestamp:'2026-11-11T18:00:00+03:00',shift:'09:00–18:00'}]));
 const after=await f.load('2026-11-11T20:05:00+03:00');
 assert.equal(after.off,4);assert.equal(after.completed,1);assert.equal(after.working,1);assert.equal(after.notStarted,0);
});
