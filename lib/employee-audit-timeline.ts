import { employeePushReceiptStages, isEmployeePushReceiptStage } from './employee-push-receipt';
import { readExperience, guideStages,pushSetupStages,experienceReasons,workflowActions,workflowStages,workflowOperations,workflowFailures,workflowResourceKey } from './employee-experience-policy';
import { readInteraction, interactionStages, interactionMessages } from './employee-interaction-policy';
import { readHandoverContext, handoverEventTitle } from './employee-handover-audit-policy';
import { activitySections } from './employee-activity-policy';
import { cashIssueRef } from './procurement-cash-issue-policy';
import { readOperationContext, operationActions, operationStages } from './employee-operation-policy';
export type ActivitySource={id:string;label:string;browserCode:string|null;kind:'employee_account'|'owner_check'};
export type AuditStep={id:string;at:string;label:string;tone:'plain'|'warning'|'error'|'success';origin:'app'|'system';note?:string;opened?:'notification'|'card';stage?:string;target?:string;pushAcceptedAt?:string;durationMs?:number;attemptId?:string;period?:string;action?:string;taskId?:number;ref?:string;source?:ActivitySource;reason?:string;operation?:string};
/** UI displays seconds: preserve cause before acknowledgement when both share that second. */
export function auditStepOrder(a:AuditStep,b:AuditStep){const second=a.at.slice(0,19).localeCompare(b.at.slice(0,19));if(second)return second;const rank=(s:AuditStep)=>s.target==='guide'&&s.stage==='acknowledge_clicked'?0:s.target==='guide'&&s.stage==='acknowledged'?2:1;return rank(a)-rank(b)||a.at.localeCompare(b.at);}
export type AuditEpisode={id:string;title:string;start:string;end:string;steps:AuditStep[];visits:boolean;unopened:boolean;notice?:string;result?:string};
type Event={id:string;kind:string;section:string;createdAt:Date;context:unknown;notificationId:number|null;sessionId?:string;source?:ActivitySource};
type Notice={id:number;title:string;body:string;kind:string;fingerprint:string;sentAt:Date|null;taskId:number|null;issueId:number|null;reviewId:string|null;pushDeliveredAt:Date|null};
export function noticeAuditKey(n:Notice){return n.issueId?`issue:${n.issueId}`:n.reviewId?`review:${n.reviewId}`:n.taskId?`handover:${n.taskId}`:cashIssueRef(n.fingerprint)?`cash:${cashIssueRef(n.fingerprint)}`:n.kind==='employee_expense_payable'?`cash:${n.fingerprint.split(':')[3]}`:`notification:${n.id}`;}
export function buildAuditTimeline(events:Event[],notifications:Notice[],date:string,results:Array<{id:string;title:string;result:string;at:string|null}>=[]):AuditEpisode[]{
 const groups=new Map<string,AuditEpisode>();
 const add=(id:string,title:string,step:AuditStep,visits=false)=>{const e=groups.get(id)||{id,title,start:step.at,end:step.at,steps:[],visits,unopened:false};if(!e.steps.some(s=>s.id===step.id))e.steps.push(step);e.start=e.start<step.at?e.start:step.at;e.end=e.end>step.at?e.end:step.at;groups.set(id,e);return e;};
 const refsByAttempt=new Map<string,Set<string>>();
 for(const event of events){const c=event.kind==='experience'?readExperience(event.context):null;if(c?.target==='workflow'&&c.ref&&workflowResourceKey(c.action,c.ref)){const key=`${event.sessionId||'legacy'}:${c.attemptId}`;const refs=refsByAttempt.get(key)||new Set<string>();refs.add(c.ref);refsByAttempt.set(key,refs);}}
 const inDay=(at:Date)=>new Date(+at+10800000).toISOString().slice(0,10)===date;
 for(const n of notifications){if(!n.sentAt||!inDay(n.sentAt))continue;const key=noticeAuditKey(n);const e=add(key,n.title,{id:`sent:${n.id}`,at:n.sentAt.toISOString(),label:'Уведомление отправлено',stage:'sent',target:'notification',pushAcceptedAt:n.pushDeliveredAt?.toISOString(),tone:'plain',origin:'system',note:n.pushDeliveredAt?'Push принят службой доставки. Показ на телефоне не подтверждён.':'Подтверждение приёма push службой доставки отсутствует.'});e.notice=n.body;e.unopened=true;}
 for(const event of [...events].sort((a,b)=>+a.createdAt-+b.createdAt)){
  const at=event.createdAt.toISOString();
  if(event.kind==='access_login'||event.kind==='access_logout'){add(`access:${event.sessionId}`,'Входы и выходы',{id:event.id,at,source:event.source,label:event.kind==='access_login'?'Вошёл в кабинет':'Вышел из кабинета',tone:'plain',origin:'system'},true);continue;}
  if(event.kind==='visit'){add(`visit:${event.id}`,activitySections[event.section as keyof typeof activitySections]||'Раздел приложения',{id:event.id,at,source:event.source,label:'Открыл раздел',tone:'plain',origin:'app'},true);continue;}
  const experience=event.kind==='experience'?readExperience(event.context):null;
  if(experience || event.kind==='work_help_ack'){
   const target=experience?.target||'guide';
   const context=event.context as {ownerRequestedRepeat?:unknown}|null;
   const ownerCheck=event.source?.kind==='owner_check'||Boolean(context?.ownerRequestedRepeat);
   const stage=experience?.stage||'acknowledged';
   const candidates=experience?.target==='workflow'?refsByAttempt.get(`${event.sessionId||'legacy'}:${experience.attemptId}`):undefined;
   const resourceRef=experience?.target==='workflow'?(experience.ref||(candidates?.size===1?[...candidates][0]:undefined)):undefined;
   const resourceKey=experience?.target==='workflow'&&resourceRef?workflowResourceKey(experience.action,resourceRef):null;

   add(resourceKey?`workflow:${resourceKey}`:`experience:${target}:${experience?.target==='workflow'?experience.action+':'+experience.attemptId+':':''}${event.sessionId||'legacy'}`,experience?.target==='workflow'?workflowActions[experience.action]:target==='guide'?'Справка «Работа в приложении»':'Подключение уведомлений',{id:event.id,at,source:event.source,stage,target,attemptId:experience?.attemptId,period:experience?.target==='workflow'?experience.period:undefined,action:experience?.target==='workflow'?experience.action:undefined,taskId:experience?.target==='workflow'?experience.taskId:undefined,ref:resourceRef,operation:experience?.target==='workflow'?experience.operation:undefined,reason:experience?.target==='push_setup'?experience.reason:experience?.target==='workflow'?experience.failure:undefined,origin:event.kind==='work_help_ack'?'system':'app',label:experience?experience.target==='workflow'?`${workflowStages[experience.stage]} · ${(experience.operation?workflowOperations[experience.operation]:workflowActions[experience.action]).toLocaleLowerCase('ru-RU')}${experience.period?' · '+new Date(experience.period+(experience.period.length===7?'-01':'')+'T12:00:00Z').toLocaleDateString('ru-RU',experience.period.length===7?{timeZone:'UTC',month:'long',year:'numeric'}:{timeZone:'UTC',day:'numeric',month:'long'}):''}`:experience.target==='guide'?guideStages[experience.stage]:pushSetupStages[experience.stage]:ownerCheck?'Нажатие «Понятно» при проверке владельцем':'Нажатие «Понятно» сохранено',tone:stage==='request_failed'||stage==='error_shown'||stage==='acknowledge_failed'||stage==='failed'?'error':stage==='permission_denied'||stage==='permission_default'?'warning':['connected','acknowledged'].includes(stage)?'success':'plain',note:experience?.target==='workflow'&&experience.failure?workflowFailures[experience.failure]:experience?.target==='push_setup'&&experience.reason?experienceReasons[experience.reason]:ownerCheck?'Это проверка владельцем кабинета; не подтверждает ознакомление сотрудника.':event.kind==='work_help_ack'?'Подтверждено сохранённой записью. Это не доказательство прочтения текста.':undefined},experience?.target==='workflow'&&['app','notification_list'].includes(experience.action));continue;
  }
  const operation=event.kind==='operation'?readOperationContext(event.context):null;
  if(operation){
   const isSchedule=operation.action.startsWith('schedule')||operation.action.startsWith('vacation');
   const group=operation.action.startsWith('payroll')?`payroll:${operation.period}`:isSchedule?`schedule:${operation.period?.slice(0,7)}`:operation.action==='cash_send'?`encashment:${operation.ref||operation.attemptId}`:`operation:${operation.action}:${operation.period||operation.attemptId}`;
   const period=operation.period?new Date(`${operation.period.slice(0,7)}-01T12:00:00Z`).toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}):'';
   const title=operation.action.startsWith('payroll')?`Зарплата · ${period}`:isSchedule?`График · ${period}`:operation.action==='cash_send'?'Инкассация':operationActions[operation.action];
   const subject=operation.period?.length===10?` · ${new Date(`${operation.period}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'numeric',month:'long',timeZone:'UTC'})}`:'';
   const label=(operation.action.endsWith('_view')?'Открыл период':`${operationActions[operation.action]}: ${operationStages[operation.stage].toLowerCase()}`)+subject;
   add(group,title,{id:event.id,at,source:event.source,label,stage:operation.stage,target:operation.action,period:operation.period,attemptId:operation.attemptId,durationMs:operation.durationMs,tone:['failed','queued'].includes(operation.stage)?'error':operation.stage==='confirmation'?'warning':['completed','duplicate_cleared'].includes(operation.stage)?'success':'plain',origin:'app',note:operation.stage==='duplicate_cleared'?`По ответу сотрудника снята повторная отправка инкассации № ${operation.duplicateOfOperationId}. Это не подтверждение нового перевода.`:operation.reason==='network'?'Браузер сообщил об отсутствии сети.':operation.reason==='unavailable'?'Расчёт пока недоступен.':operation.reason==='incomplete'?'В ответе не хватило необходимых данных.':operation.reason==='prerequisite'?'Не выполнены обязательные действия перед завершением дня.':operation.reason==='request'?'Запрос не завершился успешно; точная причина не установлена.':operation.stage==='completed'&&operation.action==='cash_send'?'Ответ приложения не означает проведение в 1С. Подтверждение показано отдельно.':undefined});continue;
  }
  if(event.kind==='push_receipt'){
   const receipt=event.context as {stage?:unknown}|null;
   const notice=notifications.find(n=>n.id===event.notificationId);
   if(notice&&isEmployeePushReceiptStage(receipt?.stage)){
    const e=add(noticeAuditKey(notice),notice.title,{id:event.id,at,source:event.source,target:'push_delivery',stage:receipt.stage,label:employeePushReceiptStages[receipt.stage],origin:'app',tone:receipt.stage==='display_failed'?'error':'plain',note:receipt.stage==='display_requested'?'Запрос принят браузером. Фактический баннер ОС и прочтение не подтверждены.':receipt.stage==='closed'?'Причина закрытия и действие человека не установлены.':undefined});
    e.notice=notice.body;
   }
   continue;
  }
  const interaction=event.kind==='interaction'?readInteraction(event.context):null;
  const handover=['handover','handover_check'].includes(event.kind)?readHandoverContext(event.context,event.kind==='handover_check'):null;
  if(handover){const error=['save_error','network_error'].includes(handover.stage);const warning=['kkm_question','check_open','check_missing','check_unavailable'].includes(handover.stage);add(`handover:${handover.taskId}`,'Сдача смены',{id:event.id,at,source:event.source,label:handoverEventTitle(handover.stage),stage:handover.stage,target:'handover',attemptId:handover.attemptId,durationMs:handover.durationMs,tone:error?'error':warning?'warning':handover.stage==='check_confirmed'?'success':'plain',origin:event.kind==='handover_check'?'system':'app',note:handover.durationMs!==undefined?`Ожидание по данным приложения: ${Math.round(handover.durationMs/1000)} с, включая время в фоне.`:error?'Сообщение об ошибке было показано. Произвольный текст ошибки в журнал не копируется.':undefined});continue;}
  const n=notifications.find(n=>n.id===(event.notificationId??(interaction?.target==='notification'?Number(interaction.ref):-1)));
  if(interaction||event.kind==='notification_open'){
   const id=n?noticeAuditKey(n):interaction?`${interaction.target}:${interaction.ref}`:`notification:${event.notificationId}`;
   const stage=interaction?.stage||'open';
   // Preserve first-open evidence without doubling the same browser click.
   if(event.kind==='notification_open'&&events.some(other=>other.kind==='interaction'&&(!event.sessionId||other.sessionId===event.sessionId)&&Math.abs(+other.createdAt-+event.createdAt)<2000&&readInteraction(other.context)?.target==='notification'&&readInteraction(other.context)?.ref===String(event.notificationId)&&readInteraction(other.context)?.stage==='open'))continue;
   const label=stage==='open'&&(interaction?.target==='notification'||event.kind==='notification_open')?'Открыл уведомление':interaction?.message?interactionMessages[interaction.message]:stage==='shown'&&interaction?.target==='cash'?'Заявка показалась на экране':stage==='retry'?interaction?.target==='cash'?'Нажал «Обновить статус»':'Повторил загрузку карточки':interactionStages[stage];
   const e=add(id,n?.title||(interaction?.target==='cash'?'Выдача денег':interaction?.target==='notification'?'Уведомление':'Проверка чека'),{id:event.id,at,source:event.source,label,stage,target:interaction?.target||'notification',pushAcceptedAt:n?.pushDeliveredAt?.toISOString(),opened:stage==='open'?(interaction?.target==='notification'||event.kind==='notification_open'?'notification':'card'):undefined,tone:stage==='error'?'error':stage==='warning'?'warning':stage==='accepted'?'success':'plain',origin:'app',note:stage==='accepted'?'Ответ приложения; это не доказательство исправления документа в 1С.':stage==='error'&&!interaction?.message?'Текст ошибки не сохранён.':undefined});
   if(n){e.notice=n.body;if(stage==='shown'&&!e.steps.some(s=>s.opened))e.unopened=true;}if(stage==='open')e.unopened=false;
  }
 }
 for(const result of results){const e=groups.get(result.id);if(!e)continue;e.result=result.result;e.title=result.title||e.title;if(result.at&&Number.isFinite(Date.parse(result.at))&&inDay(new Date(result.at)))add(result.id,e.title,{id:`result:${result.id}`,at:result.at,label:result.result,tone:'success',origin:'system',note:'Подтверждено системой. Автор действия может быть неизвестен.'});}
 return [...groups.values()].map(e=>({...e,steps:e.steps.sort(auditStepOrder)})).sort((a,b)=>a.start.localeCompare(b.start));
}
