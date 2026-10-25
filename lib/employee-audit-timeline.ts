import { readInteraction, interactionStages, interactionMessages } from './employee-interaction-policy';
import { readHandoverContext, handoverEventTitle } from './employee-handover-audit-policy';
import { activitySections } from './employee-activity-policy';
import { cashIssueRef } from './procurement-cash-issue-policy';
export type AuditStep={id:string;at:string;label:string;tone:'plain'|'warning'|'error'|'success';origin:'app'|'system';note?:string;opened?:'notification'|'card'};
export type AuditEpisode={id:string;title:string;start:string;end:string;steps:AuditStep[];visits:boolean;unopened:boolean;notice?:string;result?:string};
type Event={id:string;kind:string;section:string;createdAt:Date;context:unknown;notificationId:number|null};
type Notice={id:number;title:string;body:string;kind:string;fingerprint:string;sentAt:Date|null;taskId:number|null;issueId:number|null;reviewId:string|null;pushDeliveredAt:Date|null};
export function noticeAuditKey(n:Notice){return n.issueId?`issue:${n.issueId}`:n.reviewId?`review:${n.reviewId}`:n.taskId?`handover:${n.taskId}`:cashIssueRef(n.fingerprint)?`cash:${cashIssueRef(n.fingerprint)}`:n.kind==='employee_expense_payable'?`cash:${n.fingerprint.split(':')[3]}`:`notification:${n.id}`;}
export function buildAuditTimeline(events:Event[],notifications:Notice[],date:string,results:Array<{id:string;title:string;result:string;at:string|null}>=[]):AuditEpisode[]{
 const groups=new Map<string,AuditEpisode>();
 const add=(id:string,title:string,step:AuditStep,visits=false)=>{const e=groups.get(id)||{id,title,start:step.at,end:step.at,steps:[],visits,unopened:false};e.steps.push(step);e.start=e.start<step.at?e.start:step.at;e.end=e.end>step.at?e.end:step.at;groups.set(id,e);return e;};
 const inDay=(at:Date)=>new Date(+at+10800000).toISOString().slice(0,10)===date;
 for(const n of notifications){if(!n.sentAt||!inDay(n.sentAt))continue;const key=noticeAuditKey(n);const e=add(key,n.title,{id:`sent:${n.id}`,at:n.sentAt.toISOString(),label:'Уведомление отправлено',tone:'plain',origin:'system',note:n.pushDeliveredAt?'Push принят службой доставки. Показ на телефоне не подтверждён.':'Подтверждение приёма push службой доставки отсутствует.'});e.notice=n.body;e.unopened=true;}
 for(const event of [...events].sort((a,b)=>+a.createdAt-+b.createdAt)){
  const at=event.createdAt.toISOString();
  if(event.kind==='visit'){add(`visit:${event.id}`,activitySections[event.section as keyof typeof activitySections]||'Раздел приложения',{id:event.id,at,label:'Открыл раздел',tone:'plain',origin:'app'},true);continue;}
  const interaction=event.kind==='interaction'?readInteraction(event.context):null;
  const handover=['handover','handover_check'].includes(event.kind)?readHandoverContext(event.context,event.kind==='handover_check'):null;
  if(handover){const error=['save_error','network_error'].includes(handover.stage);const warning=['waiting','kkm_question','check_open','check_missing','check_unavailable'].includes(handover.stage);add(`handover:${handover.taskId}`,'Сдача смены',{id:event.id,at,label:handoverEventTitle(handover.stage),tone:error?'error':warning?'warning':handover.stage==='check_confirmed'?'success':'plain',origin:event.kind==='handover_check'?'system':'app',note:handover.durationMs!==undefined?`Ожидание по данным приложения: ${Math.round(handover.durationMs/1000)} с, включая время в фоне.`:error?'Сообщение об ошибке было показано. Произвольный текст ошибки в журнал не копируется.':undefined});continue;}
  const n=notifications.find(n=>n.id===(event.notificationId??(interaction?.target==='notification'?Number(interaction.ref):-1)));
  if(interaction||event.kind==='notification_open'){
   const id=n?noticeAuditKey(n):interaction?`${interaction.target}:${interaction.ref}`:`notification:${event.notificationId}`;
   const stage=interaction?.stage||'open';
   // Preserve first-open evidence without doubling the same browser click.
   if(event.kind==='notification_open'&&events.some(other=>other.kind==='interaction'&&Math.abs(+other.createdAt-+event.createdAt)<2000&&readInteraction(other.context)?.target==='notification'&&readInteraction(other.context)?.ref===String(event.notificationId)&&readInteraction(other.context)?.stage==='open'))continue;
   const label=stage==='open'&&(interaction?.target==='notification'||event.kind==='notification_open')?'Открыл уведомление':interaction?.message?interactionMessages[interaction.message]:stage==='shown'&&interaction?.target==='cash'?'Заявка показалась на экране':stage==='retry'?interaction?.target==='cash'?'Нажал «Обновить статус»':'Повторил загрузку карточки':interactionStages[stage];
   const e=add(id,n?.title||(interaction?.target==='cash'?'Выдача денег':interaction?.target==='notification'?'Уведомление':'Проверка чека'),{id:event.id,at,label,opened:stage==='open'?(interaction?.target==='notification'||event.kind==='notification_open'?'notification':'card'):undefined,tone:stage==='error'?'error':stage==='warning'?'warning':stage==='accepted'?'success':'plain',origin:'app',note:stage==='accepted'?'Ответ приложения; это не доказательство исправления документа в 1С.':stage==='error'&&!interaction?.message?'Текст ошибки не сохранён.':undefined});
   if(n){e.notice=n.body;if(stage==='shown'&&!e.steps.some(s=>s.opened))e.unopened=true;}if(stage==='open')e.unopened=false;
  }
 }
 for(const result of results){const e=groups.get(result.id);if(!e)continue;e.result=result.result;e.title=result.title||e.title;if(result.at&&Number.isFinite(Date.parse(result.at))&&inDay(new Date(result.at)))add(result.id,e.title,{id:`result:${result.id}`,at:result.at,label:result.result,tone:'success',origin:'system',note:'Подтверждено системой. Автор действия может быть неизвестен.'});}
 return [...groups.values()].map(e=>({...e,steps:e.steps.sort((a,b)=>a.at.localeCompare(b.at))})).sort((a,b)=>a.start.localeCompare(b.start));
}
