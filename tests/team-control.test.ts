import test from 'node:test';
import assert from 'node:assert/strict';
import { googleDay, taskTimingLabel, usesAppSchedule, dateKeyFromGoogle, teamStartControl, teamOperationAlerts } from '../lib/team-control';
const schedule=(plannedWork:boolean|null)=>({date:'18.10.2026',employee:'Магомед',plannedWork,scheduleNote:''});
const mark={date:'2026-10-18',timestamp:'18.10.2026 09:02:00',employee:'Косторенко Магомед',action:'Начало рабочего дня',time:'09:02',shift:'09:00–18:00'};
test('known aliases match; marks do not fabricate a plan',()=>{const d=googleDay('Костеренко Магомед','2026-10-18',[],[mark]);assert.equal(d.plan,null);assert.equal(d.arrival,542);assert.equal(d.lateMinutes,2);assert.equal(d.departure,null)});
test('explicit day off remains distinct from missing plan',()=>{assert.equal(googleDay('Магомед','2026-10-18',[schedule(false)],[]).plan,'off');assert.equal(googleDay('Магомед','2026-10-18',[schedule(null)],[]).plan,null)});
test('conflicting plans and shifts fail to unknown rather than blame',()=>{const d=googleDay('Магомед','2026-10-18',[schedule(true),schedule(false)],[mark,{...mark,shift:'11:00–20:00'}]);assert.equal(d.plan,null);assert.equal(d.ambiguous,true);assert.equal(d.lateMinutes,0)});
test('other dates cannot leak into selected day',()=>{assert.equal(googleDay('Магомед','2026-10-19',[schedule(true)],[mark]).arrival,null);assert.equal(dateKeyFromGoogle('18.10.2026'),'2026-10-18')});
test('pilot does not silently enroll other employees',()=>{assert.equal(usesAppSchedule('Ляна'),true);assert.equal(usesAppSchedule('Абшаева Зухра'),false);assert.equal(usesAppSchedule('Астемир Тохов'),false)});
test('timeliness uses Moscow time, not UTC or the cash result',()=>{assert.deepEqual(taskTimingLabel(540,'2026-10-18T06:00:00Z','2026-10-18'),{text:'В срок',tone:'green'});assert.deepEqual(taskTimingLabel(540,'2026-10-18T07:00:00Z','2026-10-18'),{text:'Позже на 60 мин',tone:'amber'});assert.equal(taskTimingLabel(540,'2026-10-19T06:00:00Z','2026-10-18').text,'Позже на 1440 мин');assert.equal(taskTimingLabel(840,null,'2026-10-18').tone,'neutral');assert.equal(taskTimingLabel(840,null,'2026-10-18',15).text,'Просрочено на 15 мин')});

test('absence uses a known shift time and never a department cutoff',()=>{
 const check=(date:string,start:number|null,now=600)=>teamStartControl('working',false,true,date,'2026-10-18',now,start);
 assert.deepEqual(check('2026-10-18',660),{missing:false,unknownTime:false});
 assert.equal(check('2026-10-18',540).missing,true);
 assert.deepEqual(check('2026-10-18',null),{missing:false,unknownTime:true});
 assert.equal(check('2026-10-17',null).missing,true);
 assert.deepEqual(check('2026-10-19',null),{missing:false,unknownTime:false});
 assert.equal(teamStartControl('off',false,true,'2026-10-18','2026-10-18',900,null).unknownTime,false);
 assert.equal(teamStartControl('working',false,false,'2026-10-17','2026-10-18',900,540).missing,false);
});
test('closing and cash exceptions are independent of completed checklists',()=>{
 assert.deepEqual(teamOperationAlerts([{status:'pending'},{status:'approved'}],[{status:'posted_1c_pair'},{status:'one_c_error'},{status:'pending_1c'}]),['Запросов на завершение: 1','Инкассаций без подтверждения 1С: 1','Инкассаций в обработке: 1']);
 assert.deepEqual(teamOperationAlerts([],[{status:'posted_1c_pair'}]),[]);
});

import { teamControlSummary, type ControlSummaryRow } from '../lib/team-control-summary';
const summaryRow:ControlSummaryRow={id:2,planState:'working',missing:false,needsReview:false,review:'',alerts:[],alertTargets:{},issues:[],timing:[]};
test('control summary prioritizes owner decision and preserves distinct matters without duplicate issue alerts',()=>{
 const result=teamControlSummary({...summaryRow,alerts:['Чек по кредитной продаже','Завершить рабочий день без инкассации · 19:00','Инкассация 5000 · внесена 14:01','Инкассация 5000 · внесена 14:01'],issues:[{id:1,title:'Чек по кредитной продаже',meta:'Документ 1',href:'/issue/1'}]},'2026-10-18');
 assert.equal(result.label,'Ждёт разрешения');assert.equal(result.kind,'decision');assert.deepEqual(result.breakdown,{decision:1,check:1,employee:1});assert.equal(result.count,1);assert.equal(result.totalCount,3);assert.equal(result.items[0].kind,'decision');assert.equal(result.items.filter(item=>item.kind==='employee').length,1);
});
test('source unavailable is distinct from a clean day and does not hide employee issues',()=>{
 assert.equal(teamControlSummary(summaryRow,'2026-10-18').kind,'normal');
 assert.equal(teamControlSummary({...summaryRow,planState:'unavailable'},'2026-10-18').kind,'unavailable');
 const result=teamControlSummary({...summaryRow,planState:'unavailable',issues:[{id:1,title:'Чек',meta:'',href:'/issue/1'}]},'2026-10-18');
 assert.equal(result.kind,'employee');assert.equal(result.unavailable,true);
});
test('unverifiable issue needs inspection instead of claiming employee is correcting it',()=>{
 assert.equal(teamControlSummary({...summaryRow,issues:[{id:1,title:'Чек',state:'Не удалось проверить',meta:'',href:'/issue/1'}]},'2026-10-18').kind,'check');
});
test('timing history stays distinct from unresolved action and keeps exact detail targets',()=>{
 const result=teamControlSummary({...summaryRow,timing:['Позже на 1 мин'],alertTargets:{'Позже на 1 мин':'shift-task-42'}},'2026-10-18');
 assert.equal(result.kind,'timing');assert.equal(result.items.length,0);assert.match(result.timing[0].href,/focus=shift-task-42/);
});

test('control count always belongs to its highest priority actor while details retain other matters',()=>{
 const issue={id:1,title:'Чек',meta:'',href:'/issue/1'};
 assert.equal(teamControlSummary({...summaryRow,issues:[issue]},'2026-10-18').label,'Есть замечания');
 const mixed=teamControlSummary({...summaryRow,issues:[issue],alerts:['Инкассация']},'2026-10-18');
 assert.equal(mixed.label,'Нужна проверка');assert.equal(mixed.count,1);assert.equal(mixed.totalCount,2);assert.deepEqual(mixed.breakdown,{decision:0,check:1,employee:1});
});

test('a missing mark source cannot look clean even when the schedule source is available',()=>{
 const result=teamControlSummary({...summaryRow,sourceUnavailable:true},'2026-10-18');
 assert.equal(result.kind,'unavailable');assert.equal(result.unavailable,true);assert.equal(result.count,0);
});

import { fiscalControlAction } from '../lib/team-control-summary';
const fiscalReview={id:'review-1',status:'admin_review',amountKopecks:50000,participants:[] as Array<{response:string}>};
test('fiscal owner gate uses workflow status and never invents an employee assignment',()=>{
 const action=fiscalControlAction(fiscalReview,undefined,true)!;
 assert.equal(action.kind,'decision');assert.equal(action.department,'retail');
 assert.equal(action.href,'/admin/workday/payment-checks/review-1');
 assert.equal(fiscalControlAction({...fiscalReview,status:'open'},undefined,true)?.kind,'employee');
 assert.equal(fiscalControlAction(fiscalReview,undefined,false)?.kind,'check');
});
test('existing or confirmed receipts cannot request permission to send a missing-receipt task',()=>{
 assert.equal(fiscalControlAction(fiscalReview,{status:'mismatch',oneCSourceRef:'receipt'},true)?.kind,'check');
 assert.equal(fiscalControlAction(fiscalReview,{status:'confirmed',oneCSourceRef:'receipt'},true),null);
 for(const status of ['resolved','superseded','cancelled'])assert.equal(fiscalControlAction({...fiscalReview,status},undefined,true),null);
});
test('employee help and all participants declining are admin checks, one declining is still a colleague task',()=>{
 const review={...fiscalReview,status:'open'};
 assert.equal(fiscalControlAction({...review,participants:[{response:'help'}]},undefined,true)?.kind,'check');
 assert.equal(fiscalControlAction({...review,participants:[{response:'not_mine'},{response:'not_mine'}]},undefined,true)?.kind,'check');
 assert.equal(fiscalControlAction({...review,participants:[{response:'not_mine'},{response:'pending'}]},undefined,true)?.kind,'employee');
});

test('a gate with no eligible employees requires a check rather than an impossible send decision',()=>{
 assert.equal(fiscalControlAction(fiscalReview,undefined,true,0)?.kind,'check');
});

test('an unresolved credit request for help is an admin check with its original issue target',()=>{
 const result=teamControlSummary({...summaryRow,issues:[{id:12,title:'Чек',state:'Нужна помощь',meta:'',href:'/issue/12'}]},'2026-10-18');
 assert.equal(result.kind,'check');assert.equal(result.items[0].href,'/issue/12');
});

test('Google-only problems without a shift card open their source instead of an absent modal',()=>{
 const result=teamControlSummary({...summaryRow,detailAvailable:false,missing:true},'2026-10-17');
 assert.equal(result.items[0].href,'/admin/attendance?date=2026-10-17');
});

import { teamShiftState } from '../lib/team-control';
test('shift wording is source-independent and past open days cannot appear as current work',()=>{
 assert.equal(teamShiftState('2026-10-19','2026-10-19',true,false,'—',''), 'Работает');
 assert.equal(teamShiftState('2026-10-19','2026-10-19',true,true,'—',''), 'Работает');
 assert.equal(teamShiftState('2026-10-18','2026-10-19',true,true,'—',''), 'Не завершил смену');
 assert.equal(teamShiftState('2026-10-18','2026-10-19',true,false,'—',''), 'Не завершил смену');
 assert.equal(teamShiftState('2026-10-18','2026-10-19',true,false,'19:00',''), 'Завершил · 19:00');
 assert.equal(teamShiftState('2026-10-18','2026-10-19',false,false,'—','Выходной'), 'Выходной');
});

import { controlCountLabel } from '../lib/team-control-summary';
test('mixed questions keep their total visible with explicit units and preserve all destinations',()=>{
 const result=teamControlSummary({...summaryRow,alerts:['Завершить рабочий день без инкассации','Инкассация'],issues:[{id:1,title:'Чек',meta:'',href:'/issue/1'}]},'2026-10-18');
 assert.equal(result.totalCount,3);assert.equal(result.items.length,3);
 assert.equal(controlCountLabel(result.totalCount,result.kind,true),'Всего 3 вопроса');
 assert.equal(controlCountLabel(1,'decision'),'1 запрос');
 assert.equal(controlCountLabel(2,'employee'),'2 замечания');
 assert.equal(controlCountLabel(12,'employee'),'12 замечаний');
 assert.equal(controlCountLabel(21,'check'),'21 вопрос');
});

import { pastOwnerActions, openCashControl } from '../lib/team-control-summary';
const pastRequest={id:'request-1',employeeId:2,status:'pending',reasonCode:'power',requestedAt:new Date('2026-10-18T16:00:00Z'),employee:{name:'Лиана',department:'wholesale'},workDayEntry:{date:'2026-10-18',status:'active',endedAt:null as Date|null}};
const pastOperation={id:4,userId:2,date:'2026-10-18',status:'one_c_error',amount:5000,createdAt:new Date('2026-10-18T11:00:00Z'),user:{name:'Лиана',department:'wholesale'}};
test('today retains prior pending permissions and cash checks with original day targets',()=>{
 const actions=pastOwnerActions([pastRequest],[pastOperation],'2026-10-19','2026-10-19');
 assert.equal(actions.length,2);assert.equal(actions[0].kind,'decision');
 assert.match(actions[0].href,/date=2026-10-18.*employee=2.*shift-request-request-1/);
 assert.match(actions[1].href,/date=2026-10-18.*shift-cash-4/);
 const summary=teamControlSummary({...summaryRow,issues:[{id:12,title:'Чек',meta:'',href:'/issue/12'}]},'2026-10-19',actions);
 assert.equal(summary.label,'Ждёт разрешения');assert.equal(summary.totalCount,3);
 assert.equal(teamControlSummary({...summaryRow,id:3},'2026-10-19',actions).totalCount,0);
});
test('past queues exclude decisions already made, closed days, completed cash and historical views',()=>{
 for(const status of ['approved','rejected','cancelled'])assert.equal(pastOwnerActions([{...pastRequest,status}],[],'2026-10-19','2026-10-19').length,0);
 assert.equal(pastOwnerActions([{...pastRequest,workDayEntry:{...pastRequest.workDayEntry,endedAt:new Date()}}],[],'2026-10-19','2026-10-19').length,0);
 assert.equal(pastOwnerActions([{...pastRequest,workDayEntry:{...pastRequest.workDayEntry,status:'completed'}}],[],'2026-10-19','2026-10-19').length,0);
 for(const status of ['posted_1c_pair','resolved_manual','cancelled']){assert.equal(openCashControl(status),false);assert.equal(pastOwnerActions([],[{...pastOperation,status}],'2026-10-19','2026-10-19').length,0);}
 assert.equal(pastOwnerActions([pastRequest],[pastOperation],'2026-10-18','2026-10-19').length,0);
 assert.equal(pastOwnerActions([{...pastRequest,workDayEntry:{...pastRequest.workDayEntry,date:'2026-10-19'}}],[{...pastOperation,date:'2026-10-19'}],'2026-10-19','2026-10-19').length,0);
});

test('future requests and cash do not leak into today',()=>{
 assert.equal(pastOwnerActions([{...pastRequest,workDayEntry:{...pastRequest.workDayEntry,date:'2026-10-20'}}],[{...pastOperation,date:'2026-10-20'}],'2026-10-19','2026-10-19').length,0);
 assert.equal(openCashControl('unknown_result'),true);
});

test('past questions never suppress a separate current-day review',()=>{
 const actions=pastOwnerActions([pastRequest],[pastOperation],'2026-10-19','2026-10-19');
 const result=teamControlSummary({...summaryRow,needsReview:true,review:'Проверить результаты сегодняшней смены'},'2026-10-19',actions);
 assert.equal(result.totalCount,3);assert.equal(result.items.some(item=>item.key==='review'),true);
});

test('one original day can open directly while several days keep explicit provenance',()=>{
 const actions=pastOwnerActions([pastRequest],[pastOperation],'2026-10-19','2026-10-19');
 const issue={id:12,title:'Чек',originDate:'2026-10-18',meta:'',href:'/issue/12'};
 assert.deepEqual(teamControlSummary({...summaryRow,issues:[issue]},'2026-10-19',actions).originDates,['2026-10-18']);
 assert.equal(teamControlSummary({...summaryRow,issues:[{...issue,originDate:'2026-10-19'}]},'2026-10-19',actions).originDates.length,2);
});

import { controlCompositionLabel } from '../lib/team-control-summary';
test('mixed questions identify owner and employee responsibility without implying activity',()=>{assert.equal(controlCompositionLabel({decision:1,check:1,employee:1}),'Вам: 2 · сотруднику: 1');assert.equal(controlCompositionLabel({decision:0,check:2,employee:3}),'Вам: 2 · сотруднику: 3');assert.equal(controlCompositionLabel({decision:1,check:0,employee:0}),null);assert.equal(controlCompositionLabel({decision:1,check:1,employee:0}),'1 разрешение · 1 проверка');assert.equal(controlCompositionLabel({decision:11,check:21,employee:0}),'11 разрешений · 21 проверка')});
