import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarQrAccepted, resolveCalendarFact, parseCalendarWorkingCorrection } from '../lib/team-calendar-fact';
const at=(date:string,time:string)=>new Date(`${date}T${time}:00+03:00`);
const base={date:'2026-11-11',department:'retail',plan:'working',source:'Приложение',vacation:false,qrAccepted:false,now:at('2026-11-11','20:01')};

for(const plan of ['working','off','unset','unknown','unavailable']) {
 test(`${plan}: no QR after department closing is a day off`,()=>{
  const input={...base,plan},before=JSON.stringify(input);const r=resolveCalendarFact(input);
  assert.equal(r.state,'off');assert.equal(r.source,'Автоматически');assert.equal(JSON.stringify(input),before);
 });
 test(`${plan}: accepted QR is a working day regardless of plan`,()=>{
  const r=resolveCalendarFact({...base,plan,qrAccepted:true});assert.equal(r.state,'working');assert.equal(r.source,'По QR');
 });
}
for(const [department,end] of [['retail','20:00'],['wholesale','19:00'],['procurement','18:00']]) {
 test(`${department}: changes only at the agreed end of day`,()=>{
  const close=at(base.date,end),before=new Date(+close-1);
  assert.equal(resolveCalendarFact({...base,department,plan:'unset',now:before}).state,'unset');
  assert.equal(resolveCalendarFact({...base,department,plan:'unset',now:close}).state,'off');
 });
}
test('late QR replaces automatic off without erasing the original plan',()=>{
 const input={...base,now:at(base.date,'20:15')};
 assert.equal(resolveCalendarFact(input).state,'off');
 assert.equal(resolveCalendarFact({...input,qrAccepted:calendarQrAccepted(base.date,[at(base.date,'20:14')],input.now)}).state,'working');
 assert.equal(input.plan,'working');
});
test('one accepted QR is enough, even if shift choice or checkout was not completed',()=>{
 const now=at(base.date,'20:01');
 for(const values of [[at(base.date,'09:00')],[at(base.date,'09:00'),at(base.date,'09:00')]]) {
  assert.equal(resolveCalendarFact({...base,qrAccepted:calendarQrAccepted(base.date,values,now)}).state,'working');
 }
});
test('future days and history before the approved QR cutover retain their original plan/source',()=>{
 for(const date of ['2026-11-12','2026-10-23']) {
  const r=resolveCalendarFact({...base,date,plan:'unset',source:'Нет записи',qrAccepted:true});
  assert.equal(r.state,'unset');assert.equal(r.source,'Нет записи');assert.equal(r.canMarkWorking,false);
 }
});
test('vacation is retained without QR; QR records work without cancelling the vacation record',()=>{
 const input={...base,plan:'vacation',vacation:true};
 assert.equal(resolveCalendarFact(input).state,'vacation');
 assert.equal(resolveCalendarFact({...input,qrAccepted:true}).state,'working');
 assert.equal(input.vacation,true);assert.equal(input.plan,'vacation');
});
test('QR dates follow Moscow, reject future/invalid timestamps and never repair a different day',()=>{
 const now=at('2026-11-12','00:05');
 assert.equal(calendarQrAccepted('2026-11-11',['2026-11-11T21:01:00Z'],now),false);
 assert.equal(calendarQrAccepted('2026-11-12',['2026-11-11T21:01:00Z'],now),true);
 assert.equal(calendarQrAccepted('2026-11-12',[at('2026-11-12','00:06'),'invalid',null],now),false);
});
test('unknown department does not invent a today closing time; past day is finalized',()=>{
 assert.equal(resolveCalendarFact({...base,department:'other'}).state,'working');
 assert.equal(resolveCalendarFact({...base,department:'other',date:'2026-11-10'}).state,'off');
});
test('audited correction counts work without fabricating QR; cancellation restores automatic policy',()=>{
 const correction={version:1 as const,userId:4,date:base.date,status:'working' as const,actorId:1,actorName:'Администратор',reason:'Сотрудник работал, QR забыл',correctedAt:base.now.toISOString()};
 assert.equal(resolveCalendarFact({...base,correction}).state,'working');
 assert.equal(resolveCalendarFact({...base,correction:{...correction,status:'reset'}}).state,'off');
 assert.equal(resolveCalendarFact({...base,qrAccepted:true,correction:{...correction,status:'reset'}}).state,'working');
 assert.deepEqual(parseCalendarWorkingCorrection(JSON.stringify(correction)),correction);
 for(const input of ['bad',JSON.stringify({...correction,actorId:0}),JSON.stringify({...correction,reason:''}),JSON.stringify({...correction,date:'2026-02-30'})])assert.equal(parseCalendarWorkingCorrection(input),null);
});
