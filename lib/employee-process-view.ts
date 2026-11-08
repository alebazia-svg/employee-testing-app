import type {WorkflowFact,WorkflowContext} from './employee-workflow-outcomes';
import type { EmployeeActivityReport } from './employee-activity-report';
import { auditStepOrder, type AuditStep } from './employee-audit-timeline';
import { buildActivityView } from './employee-activity-view';
import { interactionMessages } from './employee-interaction-policy';

export type ProcessItem = {
 id:string; title:string; section:'day'|'notifications'|'payroll'|'schedule'|'other'|'procurement'|'learning'|'receipts'|'cash'; at:string; end:string;
 steps:AuditStep[]; outcome:string; outcomeAt:string|null; confirmed:boolean; hasProblems:boolean;
 unresolved:boolean; visits:number; summary:string[]; message?:string; currentProblem?:boolean; attentionReason?:string;questionNote?:string;questionCheckedAt?:string|null; scheduleDates?:string[]; verification?:'unavailable'|'mismatch';workflowOutcome?:WorkflowFact;workflowContext?:WorkflowContext;
};
function problemReason(step:AuditStep):string {
 if(step.target==='push_delivery')return step.label+(step.source?' · '+step.source.label:'');
 if(step.target==='notification'&&step.label===interactionMessages.load_failed)return 'Не удалось загрузить уведомление';
 if(step.label===interactionMessages.send_failed)return 'Не удалось отправить ответ';
 const reasons:Record<string,string>={
  payroll_load:step.note==='Расчёт пока недоступен.'?'Расчёт зарплаты пока недоступен':'Не удалось загрузить зарплату',
  schedule_load:'Не удалось обновить график',schedule_save:'Сохранение графика не подтверждено',
  cash_send:step.stage==='queued'?'Инкассация осталась на телефоне':'Отправка инкассации не подтверждена',
  day_start:'Начало смены не подтверждено',day_end:step.note?.includes('обязательные действия')?'Не выполнены условия завершения смены':'Завершение смены не подтверждено',
  vacation_save:'Сохранение отпуска не подтверждено',vacation_cancel:'Отмена отпуска не подтверждена',
 };
 return reasons[step.target||'']||step.label.replace(/\.$/,'');
}
/** Count the same scoped rows that the toggle will show, not individual error events. */
export function filterProcessView(items:ProcessItem[],options:{query:string;section:string;attentionOnly:boolean}) {
 const query=options.query.trim().toLocaleLowerCase('ru-RU');
 const scoped=items.filter(i=>(options.section==='all'||i.section===options.section)&&`${i.title} ${i.outcome} ${i.attentionReason||''} ${i.steps.map(s=>s.label).join(' ')}`.toLocaleLowerCase('ru-RU').includes(query));
 return {items:options.attentionOnly?scoped.filter(i=>i.unresolved):scoped,attentionCount:scoped.filter(i=>i.unresolved).length};
}
export function elapsed(ms:number):string {
 if(ms<1000)return 'меньше секунды';
 if(ms<60000)return `${Math.round(ms/1000)} с`;
 const minutes=Math.floor(ms/60000),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 if(days)return `${days} д${hours%24?' '+hours%24+' ч':''}${minutes%60?' '+minutes%60+' мин':''}`;
 if(hours)return `${hours} ч${minutes%60?' '+minutes%60+' мин':''}`;
 return `${minutes} мин${ms%60000>=1000?' '+Math.floor(ms%60000/1000)+' с':''}`;
}
/** Operational projection. No employee blame or reading inference, no live 1C work. */
export function buildProcessView(data:EmployeeActivityReport):ProcessItem[] {
 const view=buildActivityView(data);
 const groups=new Map<string,ProcessItem>();
 for(const episode of data.audit||[]){
  if(episode.visits)continue;
  const notice=view.notices.find(n=>n.id===episode.id);
  const workflow=episode.steps.find(s=>s.target==='workflow')?.action||(episode.id.startsWith('experience:workflow:')?episode.id.split(':')[2]:null);
  const workflowSection=workflow?.startsWith('procurement')?'procurement':workflow==='learning'?'learning':workflow==='salary_review'?'payroll':workflow?.startsWith('schedule')||workflow==='vacation_editor'?'schedule':workflow?'day':null;
  const section=workflowSection|| (episode.id.startsWith('experience:')?'other':episode.id.startsWith('payroll:')?'payroll':episode.id.startsWith('schedule:')?'schedule':notice?'notifications':'day');
  const schedulePeriod=['schedule_bulk','schedule_editor'].includes(workflow||'')?episode.steps.find(s=>s.period)?.period?.slice(0,7):null;
  const taskId=['task_form','task_save','task_photo','handover_form','handover_photo'].includes(workflow||'')?episode.steps.find(s=>s.taskId)?.taskId:undefined;
  const cashRef=['cash_form','cash_photo'].includes(workflow||'')?episode.steps.find(s=>s.ref)?.ref:undefined;
  const key=schedulePeriod?`schedule:${schedulePeriod}`:taskId?`handover:${taskId}`:cashRef?`encashment:${cashRef}`:episode.id;
  const previous=groups.get(key);
  if(previous){previous.steps.push(...episode.steps);continue;}
  const title=cashRef?'Инкассация':schedulePeriod?`График · ${new Date(schedulePeriod+'-01T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})}`:episode.title;
  groups.set(key,{id:key,title,section:schedulePeriod?'schedule':section,at:episode.start,end:episode.end,steps:[...episode.steps],outcome:notice?.result||episode.result||'',outcomeAt:notice?.resultAt||null,confirmed:notice?.completed||false,hasProblems:false,unresolved:false,visits:0,summary:[],message:notice?.body});
 }
 const facts=data.sections.flatMap(s=>s.events.filter(f=>!f.visit&&/^(start|end|task|schedule|cash):/.test(f.id)));
 for(const f of facts){
  if(f.id.startsWith('cash:')&&data.cashEvidence?.some(c=>c.factId===f.id))continue;
  const task=f.id.startsWith('task:')?`handover:${f.id.slice(5)}`:null;
  const dayAction=f.id.startsWith('start:')?'day_start':f.id.startsWith('end:')?'day_end':null;
  const dayKey=dayAction?`operation:${dayAction}:${new Date(Date.parse(f.at)+10800000).toISOString().slice(0,10)}`:null;
  const key=f.period?`schedule:${f.period}`:task||dayKey||f.id;
  const item=groups.get(key)||{id:key,title:f.period?`График · ${new Date(`${f.period}-01T12:00:00Z`).toLocaleDateString('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'})}`:f.title,section:f.section==='schedule'?'schedule':'day',at:f.at,end:f.at,steps:[],outcome:'',outcomeAt:null,confirmed:false,hasProblems:false,unresolved:false,visits:0,summary:[]} as ProcessItem;
  if(!item.steps.some(s=>s.id===`result:${key}`&&s.at===f.at))item.steps.push({id:`fact:${f.id}`,at:f.at,label:f.title,origin:'system',tone:'success',note:f.note,period:f.scheduleDate||f.period});
  if(f.id.startsWith('task:')){item.title=f.title;item.verification=f.verification;}
  if(f.section!=='schedule'){item.outcome=f.title;item.outcomeAt=f.at;item.confirmed=true;}
  groups.set(key,item);
 }
 for(const cash of data.cashEvidence||[]){
  const key=`encashment:${cash.key}`;
  const item=groups.get(key)||{id:key,title:'Инкассация',section:'day',at:cash.at,end:cash.at,steps:[],outcome:'',outcomeAt:null,confirmed:false,hasProblems:false,unresolved:false,visits:0,summary:[]} as ProcessItem;
  item.steps.push({id:`cash-saved:${cash.key}`,at:cash.at,label:'Операция сохранена в портале',origin:'system',tone:'success'});
  if(cash.postedAt){item.steps.push({id:`cash-posted:${cash.key}`,at:cash.postedAt,label:`Проведение в 1С подтверждено${cash.document?' · № '+cash.document:''}`,origin:'system',tone:'success',note:'Время подтверждения порталом, не точный момент действий человека в 1С.'});item.outcome='Проведение в 1С подтверждено';item.outcomeAt=cash.postedAt;item.confirmed=true;}
  else if(cash.status==='one_c_error'){
   item.outcome='Ошибка передачи в 1С — нужна проверка';item.currentProblem=true;
  } else if(cash.status==='manual_in_progress'){
   item.outcome='Передана на ручную проверку';item.currentProblem=true;
  } else if(cash.status==='resolved_manual'){
   item.outcome='Подтверждена вручную; автоматическое проведение в 1С не подтверждено';
  } else item.outcome='Сохранена в портале; проведение в 1С не подтверждено';
  groups.set(key,item);
 }
 // Legacy visits remain useful for payroll/schedule, never as duplicated workday operations.
 for(const section of ['payroll','schedule'] as const){
  const visits=(data.audit||[]).filter(e=>e.visits&&e.title===(section==='payroll'?'Моя зарплата':'График'));
  // Old visits lack a period; do not silently assign them to whichever month is visible now.
  // Modern screens no longer emit a second generic visit; don't merge separate devices by time.
  const old=visits;
  if(old.length){groups.set(`visits:${section}`,{id:`visits:${section}`,title:section==='payroll'?'Просмотры зарплаты':'Просмотры графика',section,at:old[0].start,end:old.at(-1)!.end,steps:old.flatMap(e=>e.steps),outcome:'Период и результат загрузки не записаны',outcomeAt:null,confirmed:false,hasProblems:false,unresolved:false,visits:old.length,summary:[]});}
 }
 for(const fact of data.workflowFacts||[]){
  const key=fact.caseKey||`workflow:${fact.key}`;
  const hasCase=Boolean(fact.caseKey&&groups.has(key));
  const item=groups.get(key)||{id:key,title:fact.title,section:fact.section,at:fact.at,end:fact.at,steps:[],outcome:'',outcomeAt:null,confirmed:false,hasProblems:false,unresolved:false,visits:0,summary:[]} as ProcessItem;
  if(!hasCase){item.title=fact.title;item.section=fact.section;}
  item.steps.push({id:`workflow-fact:${fact.id}`,at:fact.at,label:fact.label,tone:'plain',origin:'system',target:'workflow',action:fact.action,ref:fact.ref,operation:fact.operation,stage:'saved',note:'Подтверждено сохранённой записью портала. Автор браузерного действия может быть не установлен.'});
  if(!hasCase&&(!item.workflowOutcome||item.workflowOutcome.at<=fact.at))item.workflowOutcome=fact;
  groups.set(key,item);
 }
 for(const context of data.workflowContexts||[]){const item=groups.get(`workflow:${context.key}`);if(item){item.title=context.title;item.workflowContext=context;if(context.pending)item.summary.push(`Состояние заявки при чтении журнала: ${context.pending}.`);if(context.priorResultAt)item.summary.push(`Результат сохранён ранее: ${context.priorResultAt}.`);}}
 for(const item of groups.values()){
  item.steps.sort(auditStepOrder);
  if(item.steps.length){item.at=item.steps.reduce((v,s)=>s.at<v?s.at:v,item.steps[0].at);item.end=item.steps.reduce((v,s)=>s.at>v?s.at:v,item.steps[0].at);}
  const problems=item.steps.filter(s=>s.tone==='error'||s.tone==='warning');
  item.hasProblems=problems.length>0||!!item.currentProblem;
  // Ordinary confirmation prompts are not evidence of a failure.
  const reviewProblems=problems.filter(p=>!['confirmation','kkm_question'].includes(p.stage||''));
  const unresolvedProblems=reviewProblems.filter(p=>!item.steps.some(s=>{
   if(s.at<=p.at)return false;
   if(p.target==='push_delivery')return s.target==='push_delivery'&&s.stage==='display_requested'&&Boolean(p.source&&s.source&&p.source.id===s.source.id);
   if((item.workflowContext?.priorResult||item.workflowOutcome?.operation==='learning_finish')&&p.action==='learning'&&['learning_start','learning_finish'].includes(p.operation||'')&&['access','already_completed'].includes(p.reason||'')&&s.action==='learning'&&s.stage==='completed_view'&&p.ref===s.ref)return true;
   if(s.id.startsWith('workflow-fact:'))return Boolean(p.target==='workflow'&&p.action&&p.action===s.action&&p.ref===s.ref&&p.operation&&p.operation===s.operation);
   if(s.id.startsWith('fact:task:'))return true;
   if(s.id.startsWith('fact:schedule:')&&p.period&&s.period&&(s.period===p.period||p.period.length===7&&s.period.startsWith(p.period)))return true;
   if(p.target==='workflow'&&(p.action!==s.action||p.taskId!==s.taskId||p.ref!==s.ref||p.operation!==s.operation))return false;
   if(s.id.startsWith('result:')||s.id.startsWith('cash-posted:')||s.id.startsWith('fact:start:')||s.id.startsWith('fact:end:'))return true;
   return Boolean(p.target&&s.target===p.target&&s.period===p.period&&['completed','accepted','duplicate_cleared','response_received','copy_succeeded'].includes(s.stage||'')&&(!p.source||!s.source||p.source.id===s.source.id));
  }));
  item.unresolved=!!item.currentProblem||unresolvedProblems.length>0;
  if(item.currentProblem)item.attentionReason=item.outcome;
  else if(unresolvedProblems.length)item.attentionReason=problemReason(unresolvedProblems.at(-1)!);
  const explicitViews=item.steps.filter(s=>s.target?.endsWith('_view'));
  item.visits+=explicitViews.length;
  if(item.visits)item.summary.push(`Просмотров: ${item.visits}`);
  const changed=item.steps.filter(s=>s.id.startsWith('fact:schedule:'));
  if(changed.length){
   item.summary.push(`Сохранённых изменений: ${changed.length}`);
   const saved=facts.filter(f=>f.period&&`schedule:${f.period}`===item.id&&f.id.startsWith('schedule:'));
   // Dates come from saved records, never parsed from a translated title or inferred from views.
   if(saved.length===changed.length&&saved.every(f=>f.scheduleDate))item.scheduleDates=[...new Set(saved.map(f=>f.scheduleDate!))].sort();
   item.outcome=changed.length===1?changed[0].label:`График изменён · ${changed.length} записей`;
   item.outcomeAt=changed.reduce((at,s)=>s.at>at?s.at:at,changed[0].at);item.confirmed=true;
  }
  if(changed.length&&item.unresolved){item.outcome='Есть попытка изменения без подтверждённого результата';item.confirmed=false;}
  const lastResponse=[...item.steps].reverse().find(s=>s.target?.endsWith('_load')&&['completed','failed'].includes(s.stage||''));
  if(lastResponse){item.summary.push(`${lastResponse.stage==='completed'?'Обновление':'Ошибка обновления'}${lastResponse.durationMs!==undefined?': '+elapsed(lastResponse.durationMs):''}`);if(!item.outcome)item.outcome=lastResponse.stage==='completed'?'Данные получены':'Обновление не удалось';}
  const cashAttempts=item.steps.filter(s=>s.target==='cash_send'&&s.stage==='started');
  if(cashAttempts.length)item.summary.push(`Попыток отправки: ${cashAttempts.length}`);
  const waits=item.steps.filter(s=>s.durationMs!==undefined&&!s.target?.endsWith('_load'));
  const longestWait=waits.length?Math.max(...waits.map(s=>s.durationMs!)):0;
  if(longestWait>=3000)item.summary.push(`Ожидание ответа: до ${elapsed(longestWait)}`);
  const n=view.notices.find(n=>n.id===item.id);
  if(n){
   item.questionNote=n.note;item.questionCheckedAt=data.obligations.find(o=>o.auditKey===item.id)?.sourceAt;
   if(!n.completed&&n.note.includes('вопрос остаётся открытым'))item.outcome=n.opened.length?'Сообщение открывали; по последней проверке вопрос не закрыт':'По последней проверке вопрос не закрыт';
   const sent=n.firstSentAt||n.sent[0],opened=n.opened[0];
   if(n.sent.length>1)item.summary.push(`Повторных напоминаний: ${n.sent.length-1}`);
   const openings=item.steps.filter(s=>s.opened==='notification');
   if(openings.length>1)item.summary.push(`Открытий: ${openings.length} · последнее ${new Date(openings.at(-1)!.at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})}`);
   if(opened&&sent&&Date.parse(opened)>=Date.parse(sent))item.summary.push(`Открытие через ${elapsed(Date.parse(opened)-Date.parse(sent))}`);
   else if(!opened)item.summary.push('Открытие не зафиксировано');
   if(opened&&n.resultAt&&Date.parse(n.resultAt)>=Date.parse(opened))item.summary.push(`От открытия до подтверждения: ${elapsed(Date.parse(n.resultAt)-Date.parse(opened))}`);
  }
  if(reviewProblems.length&&!item.currentProblem&&!item.unresolved){
   const lostConnection=reviewProblems.some(p=>p.note?.includes('отсутствии сети')||p.stage==='network_error');
   item.summary.push(lostConnection?'После потери связи получен результат':'После затруднения получен результат');
  }
  const clearedDuplicate=[...item.steps].reverse().find(s=>s.stage==='duplicate_cleared');
  if(clearedDuplicate&&!item.confirmed&&!item.currentProblem&&!item.unresolved){item.outcome='Повторная отправка снята сотрудником';item.outcomeAt=clearedDuplicate.at;}
  if(item.id.startsWith('experience:')&&!item.id.startsWith('experience:workflow:')) {
   const last=item.steps.at(-1);
   const result=[...item.steps].reverse().find(s=>['connected','acknowledged'].includes(s.stage||''));
   const blocked=[...item.steps].reverse().find(s=>['failed','permission_denied','permission_default','acknowledge_failed'].includes(s.stage||''));
   item.unresolved=Boolean(blocked&&(!result||result.at<blocked.at));
   item.attentionReason=item.unresolved?((blocked?.stage==='permission_denied'||blocked?.reason==='denied')?'На устройстве запрещены уведомления':(blocked?.stage==='permission_default'||blocked?.reason==='default')?'Разрешение не получено':blocked?.label):undefined;
   item.confirmed=Boolean(result&&!item.unresolved);item.outcomeAt=result?.at||null;
   item.outcome=result?.stage==='connected'?'Подключение подтверждено':result?.stage==='acknowledged'?(result.note?.includes('проверка владельцем')?'Подтверждение при проверке владельцем':'Нажатие «Понятно» сохранено'):last?.stage?.startsWith('close_')?'Справка закрыта без подтверждения':last?.stage==='hidden'?'Приложение ушло в фон; подтверждения нет':last?.stage==='schedule_clicked'?'Перешёл к графику; подтверждения справки нет':last?.stage==='shown'?'Предложение показано; нажатие кнопки не записано':last?.stage?.includes('shown')?'Справка показана; подтверждение не записано':last?.stage==='enable_clicked'?'Нажал подключить; результат не записан':'Результат пока не подтверждён';
   if(blocked&&result&&result.at>blocked.at)item.summary.push('После затруднения получен результат');
  }
  if(item.id.startsWith('experience:workflow:')){const last=item.steps.at(-1);item.outcome=['error_shown','request_failed'].includes(last?.stage||'')?'Действие не завершилось успешно':last?.stage==='response_received'?'Ответ получен; сохранённый результат проверяется отдельно':last?.label||'Результат не записан';}
  if(!item.outcome||item.outcome==='Выполнение не подтверждено'){
   const last=item.steps.at(-1);
   item.outcome=last?.stage==='queued'?'Сохранена на телефоне; отправка не подтверждена':last?.stage==='confirmation'?'Ожидает подтверждения изменения':last?.stage==='completed'||last?.stage==='accepted'?'Ответ приложения получен; итог операции не подтверждён':'Результат не подтверждён';
  }
 }
 return [...groups.values()].sort((a,b)=>a.at.localeCompare(b.at));
}
