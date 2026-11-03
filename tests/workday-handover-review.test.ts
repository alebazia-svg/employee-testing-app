import assert from 'node:assert/strict';
import test from 'node:test';
import {handoverReviewRequestAllowed,needsHandoverReview,handoverReviewRecord,handoverReviewReason,handoverReviewHref} from '../lib/workday-handover-review';
import {adminInboxSourceState} from '../lib/admin-operations-view';
import {selectAdminAttention} from '../lib/admin-inbox-attention-policy';
const task={id:7,category:'handover',required:true,status:'missed',handoverData:null};
const day={date:'2026-11-02',endedAt:'2026-11-03T06:57:00Z',department:'wholesale'};
test('closed unsubmitted handover needs review; open, optional and other-role workdays do not',()=>{
 assert.equal(needsHandoverReview(task,day),true);
 for(const status of ['pending','missed'])assert.equal(needsHandoverReview({...task,status},day),true);
 assert.equal(needsHandoverReview({...task,status:'done'},day),false);
 assert.equal(needsHandoverReview({...task,required:false},day),false);
 assert.equal(needsHandoverReview({...task,category:'cash'},day),false);
 assert.equal(needsHandoverReview(task,{...day,endedAt:null}),false);
 assert.equal(needsHandoverReview(task,{...day,department:'procurement'}),false);
});
test('approved handover exceptions never become a missing-handover reminder',()=>{
 const adminClosure={requestId:'approved',adminId:20,closedAt:day.endedAt};
 assert.equal(needsHandoverReview({...task,handoverData:{adminClosure}},day),false);
 assert.equal(needsHandoverReview({...task,handoverData:{adminClosure,personalCash:{encashmentExceptionRequestId:'approved'}}},day),false);
});
test('only the dedicated acknowledgement removes the reminder, not a cash review',()=>{
 assert.equal(handoverReviewRecord(7,[{checkId:'handover-cash-7',decision:'confirmed_ok'}]),null);
 assert.equal(handoverReviewRecord(7,[{checkId:'unsubmitted-handover-8',decision:'acknowledged'}]),null);
 assert.equal(handoverReviewRecord(7,[{checkId:'unsubmitted-handover-7',decision:'acknowledged'}])?.decision,'acknowledged');
 assert.equal(task.status,'missed');
});
test('current and old reason text is shown without inventing a reason',()=>{
 assert.equal(handoverReviewReason('Предыдущий день. Причина: Забыл закрыть смену.'),'Забыл закрыть смену');
 assert.equal(handoverReviewReason('Причина: старая.','Закрыт позже.\nПричина: Не было интернета.\nКомментарий сотрудника: Связь восстановили'),'Не было интернета');
 assert.equal(handoverReviewReason('Нет пояснения'),null);
 assert.match(handoverReviewHref('2026-11-02',7),/date=2026-11-02.*employee=7.*focus=shift-handover-review/);
});
test('opening/reading the inbox does not clear a pending review; acknowledgement moves it to history',()=>{
 const item={id:'receipt',readAt:'2026-11-03T07:00:00Z',event:{type:'workday.handover_review_required',sourceType:'workday_handover_review',sourceId:'7',occurredAt:day.endedAt},meta:{category:'decisions'},sourceState:adminInboxSourceState({sourceType:'workday_handover_review',current:true})};
 assert.equal(selectAdminAttention([item]).length,1);
 const resolved=adminInboxSourceState({sourceType:'workday_handover_review',current:false,businessStatus:'acknowledged'});
 assert.equal(resolved.label,'Проверено');
 assert.equal(selectAdminAttention([{...item,sourceState:resolved}]).length,0);
});

test('review POST accepts the real proxy origin and rejects cross-site or non-JSON calls',()=>{
 const request=(headers:Record<string,string>)=>new Request('http://portal-app:3000/api/admin/workday/handover-review',{method:'POST',headers:{'content-type':'application/json','host':'team.mobo-opt.ru',...headers}});
 assert.equal(handoverReviewRequestAllowed(request({origin:'https://team.mobo-opt.ru','sec-fetch-site':'same-origin'})),true);
 assert.equal(handoverReviewRequestAllowed(request({host:'portal-app:3000','x-forwarded-host':'team.mobo-opt.ru',origin:'https://team.mobo-opt.ru'})),true);
 assert.equal(handoverReviewRequestAllowed(request({origin:'https://other.example'})),false);
 assert.equal(handoverReviewRequestAllowed(request({origin:'not a url'})),false);
 assert.equal(handoverReviewRequestAllowed(request({'sec-fetch-site':'cross-site'})),false);
 assert.equal(handoverReviewRequestAllowed(request({'content-type':'text/plain'})),false);
});

test('pre-pilot runs remain history and cannot become active review reminders',()=>{
 assert.equal(needsHandoverReview(task,{...day,date:'2026-10-17'}),false);
 assert.equal(needsHandoverReview(task,{...day,date:'2026-10-18'}),true);
 for(const date of ['2026-06-07','2026-07-29','2026-09-17','2026-10-06'])assert.equal(needsHandoverReview(task,{...day,date}),false);
 const state=adminInboxSourceState({sourceType:'workday_handover_review',current:false,businessStatus:'pre_pilot'});
 assert.equal(state.active,false);assert.equal(state.label,'До начала пилота');
});
