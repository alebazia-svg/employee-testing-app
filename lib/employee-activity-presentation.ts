import {activitySections} from './employee-activity-policy';
import {workflowFailures,workflowOperations} from './employee-experience-policy';
import type { EmployeeActivityReport, ActivityObligation } from './employee-activity-report';
import { auditStepOrder, type AuditStep } from './employee-audit-timeline';
import { buildProcessView, type ProcessItem } from './employee-process-view';

export type ActivityStatus='result'|'question'|'difficulty'|'observed'|'unknown';
export const activityStatusLabels:Record<ActivityStatus,string>={result:'Есть результат',question:'Открытый вопрос',difficulty:'Затруднение',observed:'Просмотр / действие',unknown:'Нужны сведения'};
export type HumanActivity={id:string;at:string;from:string;label:string;title:string;section:ProcessItem['section'];itemId:string;unresolved:boolean;raw:AuditStep[]};
export type ManagerActivity={item:ProcessItem;status:ActivityStatus;result:string;time:{at:string;label:string};nextStep?:string;reason?:string;resultCheck?:'before_opening'|'after_opening'|'same_time'|'unknown';obligation?:ActivityObligation;openings:AuditStep[];shown:AuditStep[];push:{label:string;explanation:string;at?:string;source?:AuditStep['source']};ownerCheck:boolean;history:HumanActivity[]};
const descending=(a:AuditStep,b:AuditStep)=>auditStepOrder(b,a);
const sameSource=(a:AuditStep,b:AuditStep)=>Boolean(a.source&&b.source&&a.source.id===b.source.id);
const isSaved=(s:AuditStep)=>s.id.startsWith('workflow-fact:')||s.id.startsWith('fact:')||s.id.startsWith('result:')||s.id.startsWith('cash-posted:')||s.id.startsWith('cash-saved:');
const viewSection=(title:string):ProcessItem['section']=>title==='Список уведомлений'?'notifications':(Object.entries(activitySections).find(([,label])=>label===title)?.[0] as ProcessItem['section']|undefined)||'day';
export const activityClock=(at:string,seconds=false)=>new Date(at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})});
export const activityDateTime=(at:string)=>new Date(at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'});
export const activityStamp=(at:string,date:string,seconds=false)=>new Date(Date.parse(at)+10800000).toISOString().slice(0,10)===date?activityClock(at,seconds):activityDateTime(at);
export const timesWord=(n:number)=>n%10===1&&n%100!==11?'раз':n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?'раза':'раз';

export function scheduleActivityResult(item:ProcessItem){
 const dates=item.scheduleDates;
 if(!dates?.length)return null;
 const day=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC',day:'numeric',month:'long'});
 const contiguous=dates.every((date,i)=>!i||Date.parse(date)-Date.parse(dates[i-1])===86400000);
 const range=dates.length===1?day(dates[0]):contiguous?`${Number(dates[0].slice(-2))}–${day(dates.at(-1)!)}`:null;
 const word=dates.length%10===1&&dates.length%100!==11?'дату':dates.length%10>=2&&dates.length%10<=4&&(dates.length%100<12||dates.length%100>14)?'даты':'дат';
 return `Сохранены изменения на ${dates.length} ${word}${range?' · '+range:''}`;
}

/** Human labels change presentation only. Exact original labels remain in raw evidence. */
export function humanActivityLabel(s:AuditStep,title:string){
 if(s.stage==='sent'&&s.target==='notification')return 'Сообщение добавлено в кабинет';
 if(s.opened==='notification')return 'Открыл сообщение';
 if(s.stage==='shown'&&s.target==='notification')return 'Сообщение показано в приложении';
 if(s.target==='push_delivery')return ({received:'Устройство сообщило о получении push',display_requested:'Браузер принял запрос показа push',display_failed:'Браузер сообщил об ошибке показа push',clicked:'Нажал push-уведомление',closed:'Браузер сообщил о закрытии push'} as Record<string,string>)[s.stage||'']||s.label;
 if(s.target==='notification'&&s.stage==='close')return 'Закрыл сообщение';
 if(s.target?.endsWith('_view'))return `Открыл ${s.target==='payroll_view'?'зарплату':'график'}${s.period?' за '+new Date(s.period.slice(0,7)+'-01T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'UTC',month:'long',year:'numeric'}):''}`;
 if(s.target?.endsWith('_load')){
  const subject=s.target==='payroll_load'?'зарплату':'график';
  return s.stage==='started'?`Началась загрузка ${subject==='зарплату'?'зарплаты':'графика'}`:s.stage==='completed'?(s.target==='payroll_load'?'Данные зарплаты загрузились':'График загрузился'):`Не удалось загрузить ${subject}`;
 }
 if(s.target==='guide')return s.label;
 if(s.target==='workflow'&&s.stage==='validation')return 'Форма попросила проверить заполнение';
 if(s.action==='learning'&&s.stage==='confirmed_choice')return 'Выбрал ответ; сохранение проверяется отдельно';
 if(s.action==='learning'&&s.stage==='next_question')return 'Перешёл к другому вопросу';
 if(s.action==='learning'&&s.stage==='completed_view')return 'Открыл сохранённый результат аттестации';
 if(s.target==='workflow'&&s.stage==='opened'){if(s.operation==='learning_load')return 'Открыл аттестацию';if(s.operation==='payment_load')return 'Открыл заявку на оплату';if(s.operation==='receipt_load')return 'Открыл документы оплаты';}
 if(s.action==='learning'&&s.stage==='finish_requested')return 'Нажал «Завершить аттестацию»';
 if(s.action==='learning'&&s.stage==='auto_finish')return 'Время истекло; приложение начало завершение аттестации';
 if(s.target==='workflow'&&s.operation&&Object.hasOwn(workflowOperations,s.operation)){
  const name=workflowOperations[s.operation as keyof typeof workflowOperations];
  return s.stage==='submitted'?'Отправил запрос · '+name:s.stage==='response_received'?'Получен ответ · '+name:s.stage==='request_failed'?'Запрос не выполнен · '+name:s.label;
 }
 if(s.target==='workflow'&&s.action){
  const subject:Record<string,string>={schedule_bulk:'заполнение графика',schedule_editor:'выбор дня в графике',cash_form:'форму кассовой операции',cash_photo:'выбор фото',handover_form:'сдачу смены',task_form:'проверку кассы',vacation_editor:'отпуск',procurement_payment:'платёж в закупках',procurement_receipt:'чек по оплате',procurement_delivery:'доставку',salary_review:'уточнение рабочего дня',learning:'обучение',notification_list:'список уведомлений'};
  const name=subject[s.action];
  if(name&&s.stage==='opened')return 'Открыл '+name;
  if(name&&s.stage==='closed')return 'Закрыл '+name;
  if(name&&s.stage==='cancelled')return s.action?.startsWith('schedule')?'Закрыл редактор графика без нового сохранения':'Вышел без сохранения · '+name;
  if(s.stage==='request_failed')return 'Не удалось завершить запрос · '+(name||title);
  if(s.stage==='response_received')return 'Портал ответил на запрос · '+(name||title);
  if(s.action==='app')return s.stage==='background'?'Приложение ушло в фон':s.stage==='returned'?'Вернулся в приложение':s.label;
 }
 return s.label;
}

/** Pair only adjacent observations of the same gesture on an exactly known connection. */
export function humanActivityHistory(steps:AuditStep[],context:{id:string;title:string;section:ProcessItem['section'];unresolved:boolean}):HumanActivity[]{
 const rows:HumanActivity[]=[];
 for(const step of [...steps].sort(auditStepOrder)){
  const last=rows.at(-1),previous=last?.raw.length===1?last.raw[0]:undefined;
  const near=previous&&sameSource(previous,step)&&Math.abs(Date.parse(step.at)-Date.parse(previous.at))<2000;
  const opening=near&&((previous.opened==='notification'&&step.opened==='card')||(previous.opened==='card'&&step.opened==='notification'));
  const acknowledgement=near&&previous.target==='guide'&&previous.stage==='acknowledge_clicked'&&step.target==='guide'&&step.stage==='acknowledged';
  const load=near&&previous.attemptId&&previous.attemptId===step.attemptId&&previous.target===step.target&&previous.period===step.period&&previous.target?.endsWith('_load')&&previous.stage==='started'&&['completed','failed'].includes(step.stage||'');
  const workflowReply=previous&&sameSource(previous,step)&&previous.target==='workflow'&&step.target==='workflow'&&previous.stage==='submitted'&&['response_received','request_failed'].includes(step.stage||'')&&Boolean(previous.attemptId&&previous.attemptId===step.attemptId&&previous.action===step.action&&previous.ref===step.ref&&previous.operation===step.operation);
  if(last&&(opening||acknowledgement||load||workflowReply)){
   last.raw.push(step);last.at=step.at;last.label=opening?'Открыл сообщение':acknowledgement?'Нажал «Понятно» · подтверждение сохранено':humanActivityLabel(step,context.title);continue;
  }
  rows.push({id:step.id,at:step.at,from:step.at,label:humanActivityLabel(step,context.title),title:context.title,section:context.section,itemId:context.id,unresolved:context.unresolved,raw:[step]});
 }
 return rows;
}

function pushEvidence(item:ProcessItem):ManagerActivity['push']{
 const receipts=item.steps.filter(s=>s.target==='push_delivery').sort(descending);
 const received=receipts.find(s=>s.stage==='clicked')||receipts.find(s=>['received','display_requested','display_failed','closed'].includes(s.stage||''));
 if(received){
  const source=received.source;
  const display=receipts.find(s=>['display_requested','display_failed'].includes(s.stage||'')&&s.source?.id===source?.id);
  return {label:received.stage==='clicked'?'Есть нажатие на push':display?.stage==='display_failed'?'Получен устройством; ошибка показа':'Получен устройством',source,at:received.at,
   explanation:display?.stage==='display_failed'?'Это подключение сообщило об ошибке показа. Причина ОС не передана.':display?.stage==='display_requested'?'Это подключение сообщило о получении push, браузер принял запрос показа. Видимость баннера ОС и прочтение не установлены.':'Есть сообщение от этого подключения. Фактический баннер ОС и прочтение не установлены.'};
 }
 const accepted=item.steps.flatMap(s=>s.pushAcceptedAt?[s.pushAcceptedAt]:[]).sort().at(-1);
 return accepted?{label:'Отправка принята; получение неизвестно',at:accepted,explanation:'Сервис доставки принял отправку. Подтверждения получения от устройства нет; это не означает, что push не пришёл.'}:{label:'Получение не подтверждено',explanation:'Нет подтверждения получения с устройства или приёма отправки сервисом. По этим данным нельзя ответить, пришло ли уведомление на телефон.'};
}

function difficultyAdvice(item:ProcessItem){
 const p=[...item.steps].reverse().find(s=>['error','warning'].includes(s.tone)&&!['confirmation','kkm_question'].includes(s.stage||''));
 if(item.currentProblem)return {reason:'Состояние операции требует отдельной проверки; успешный ответ приложения не подтверждает проведение в 1С.',nextStep:'Проверьте сохранённую операцию и её состояние в 1С перед повторной отправкой.'};
 if(p?.target==='push_delivery')return {reason:'Устройство сообщило об ошибке показа push. Точная причина не передана.',nextStep:'Проверьте разрешение уведомлений и последующие попытки на этом подключении.'};
 if(p?.stage==='permission_denied')return {reason:'Браузер сообщил о запрете уведомлений. Кто и когда его установил, неизвестно.',nextStep:'Нужно проверить разрешение уведомлений в настройках этого устройства.'};
 if(p?.target==='workflow'&&p.reason&&Object.hasOwn(workflowFailures,p.reason))return {reason:workflowFailures[p.reason as keyof typeof workflowFailures],nextStep:p.reason==='validation'?'Посмотрите пояснение в форме: проверьте заполнение и доступность необходимых данных.':p.reason==='conflict'?'Обновите состояние этой записи и проверьте, какие изменения уже сохранены.':p.reason==='access'?'Проверьте доступ к этому разделу; повторный вход нужен только при истёкшем входе.':p.reason==='missing'?'Проверьте, доступна ли эта запись в соответствующем разделе.':'Проверьте сохранённый результат и следующую попытку по этой же операции.'};
 if(p?.stage==='permission_default')return {reason:'Браузер не выдал разрешение. Нажатие «Отказать» не установлено.',nextStep:'Посмотрите, было ли нажатие «Включить» и открытие инструкции.'};
 if(p?.reason==='network'||p?.stage==='network_error')return {reason:'Приложение сообщило об отсутствии сети.',nextStep:'Проверьте следующую попытку после восстановления связи и сохранённый результат.'};
 if(p?.reason==='prerequisite'||p?.note?.includes('обязательные действия'))return {reason:'Для завершения рабочего дня остались обязательные действия.',nextStep:'Откройте незавершённые задания рабочего дня.'};
 if(p?.reason==='unavailable')return {reason:'Приложение сообщило, что расчёт пока недоступен.',nextStep:'Проверьте доступность расчёта; это не свидетельство ошибки сотрудника.'};
 return {reason:p?.note||'Записано затруднение. Точная причина не установлена.',nextStep:'Проверьте повторные попытки ниже. Если затруднение повторяется, нужна проверка приложения.'};
}

/** Use the persisted relation, never a guessed keyword in a notification title. */
function obligationAdvice(item:ProcessItem){
 if(item.id.startsWith('review:'))return 'Проверьте, появился ли чек в 1С по этой операции. Открытие сообщения не подтверждает пробитие чека.';
 if(item.id.startsWith('cash:'))return 'Проверьте исполнение этой выдачи денег в 1С. Открытие сообщения не подтверждает выдачу.';
 if(item.id.startsWith('handover:'))return `Проверьте сохранённый результат задания «${item.title}». Открытие сообщения не означает выполнения задания.`;
 return `Проверьте результат по вопросу «${item.title}». Открытие сообщения само по себе не подтверждает выполнение.`;
}

function present(item:ProcessItem,data:EmployeeActivityReport):ManagerActivity{
 const obligation=data.obligations.find(o=>o.auditKey===item.id||item.id===`notification:${o.id}`);
 const openings=item.steps.filter(s=>s.opened==='notification'),shown=item.steps.filter(s=>s.target==='notification'&&s.stage==='shown');
 const meaningful=[...item.steps].reverse().find(s=>!['hidden','returned','page_left','background'].includes(s.stage||''));
 const last=meaningful||item.steps.at(-1);
 const ownerCheck=item.steps.some(s=>s.source?.kind==='owner_check'||s.note?.includes('проверка владельцем')||s.label.includes('при проверке владельцем'));
 let status:ActivityStatus='unknown',result=item.outcome,time={at:item.end,label:'событие'},reason:string|undefined,nextStep:string|undefined,resultCheck:ManagerActivity['resultCheck'];
 if(item.unresolved){
  status='difficulty';result=item.attentionReason||item.outcome;
  const problem=[...item.steps].reverse().find(s=>['error','warning'].includes(s.tone)&&!['confirmation','kkm_question'].includes(s.stage||''));
  time={at:problem?.at||item.end,label:'затруднение'};({reason,nextStep}=difficultyAdvice(item));
  if(item.workflowOutcome)result+=`. Также есть сохранённый результат: ${item.workflowOutcome.label}`;
 }else if(!item.workflowOutcome&&item.workflowContext?.priorResult&&item.steps.some(s=>s.stage==='completed_view')){
  status='observed';result='Открыл сохранённый результат. '+item.workflowContext.priorResult;time={at:[...item.steps].reverse().find(s=>s.stage==='completed_view')!.at,label:'открыто'};
 }else if(item.workflowOutcome){
  const saved=item.workflowOutcome;status=saved.status;result=saved.label;time={at:saved.at,label:'сохранено'};
  if(item.workflowContext?.pending){status='question';result+=`. ${item.workflowContext.pending}`;}
  if(last?.stage==='validation'&&last.at>=saved.at){result+=saved.action==='learning'&&last.operation==='learning_finish'?'. Для завершения нужно ответить на все вопросы':'. Форма попросила проверить заполнение';time={at:last.at,label:'проверка'};nextStep=saved.action==='learning'?'Ответьте на оставшиеся вопросы и повторите завершение. Уже сохранённый прогресс остаётся в истории.':'Проверьте пояснение в форме и повторите сохранение.';}
  if(status==='question'&&!nextStep)nextStep=saved.section==='learning'?'Откройте результат аттестации: итог «не сдал» не означает ошибку приложения.':saved.section==='payroll'?'Проверьте решение по этому запросу выходов. Отправка запроса не означает подтверждения дней.':saved.section==='day'?'Проверьте решение по этому запросу в «Контроле дня». Запрос разрешения сам по себе не завершает рабочий день.':'Проверьте следующий этап этой заявки в закупках. Сохранение и согласование не подтверждают оплату или выдачу денег.';
 }else if(item.confirmed&&item.verification){
  status=item.verification==='unavailable'?'unknown':'question';
  result=item.verification==='unavailable'?'Результат сохранён; сверка с 1С недоступна':'Результат сохранён; при проверке есть расхождение';
  time={at:item.outcomeAt||item.end,label:'сохранено'};
  nextStep=item.verification==='unavailable'?'Проверьте сверку в «Контроле дня». Повторно вводить уже сохранённый результат не требуется.':'Проверьте отмеченное расхождение в «Контроле дня». Сохранение ответа не означает, что расхождение устранено.';
 }else if(item.confirmed){
  status='result';result=scheduleActivityResult(item)||item.outcome;
  if(item.outcome===item.title)result='Отметка сохранена в портале';
  time={at:item.outcomeAt||item.end,label:!item.outcomeAt?'результат':item.scheduleDates||item.steps.some(s=>s.id.startsWith('fact:'))?'сохранено':'результат'};
 }else if(obligation&&obligation.result==='Выполнение не подтверждено'){
  const checked=Date.parse(obligation.sourceAt||''),snapshot=Date.parse(data.checkedAt);
  const lastOpened=openings.at(-1)?.at;
  const opened=Date.parse(lastOpened||'');
  const validCheck=Number.isFinite(checked)&&checked<=snapshot;
  resultCheck=lastOpened? !validCheck?'unknown':checked<opened?'before_opening':checked===opened?'same_time':'after_opening':undefined;
  const needsCheck=Boolean(lastOpened&&resultCheck!=='after_opening');
  status=needsCheck||obligation.attention==='unknown'||!obligation.attention?'unknown':'question';
  result=needsCheck?resultCheck==='same_time'?'Проверка и открытие записаны одновременно; результат после открытия не подтверждён':'После последнего открытия проверка результата не записана':status==='unknown'?'Свежих подтверждений результата пока нет':lastOpened?'После последнего открытия вопрос оставался открытым':'По последней проверке вопрос открыт';
  // Shift state remains in source evidence, but is not a recommendation or proof of inaction.
  nextStep=(needsCheck||status==='unknown'?'Нужны свежие сведения о результате. ':'')+obligationAdvice(item);
 }else if(item.message!==undefined){
  status='observed';result=openings.length?`Сообщение открывали ${openings.length} ${timesWord(openings.length)}`:shown.length?'Сообщение показано в приложении; открытие не записано':'Сообщение есть в кабинете; показ и открытие не записаны';
 }else if(item.id.startsWith('experience:guide:')){
  status='observed';result=last?.stage==='acknowledge_clicked'?'Нажал «Понятно»; сохранение не подтверждено':last?.stage?.startsWith('close_')?`${last.label}; подтверждение не записано`:last?.stage==='schedule_clicked'?'Перешёл к графику; подтверждение справки не записано':'Справка показана; подтверждение «Понятно» не записано';
 }else if(item.id.startsWith('experience:push_setup:')){
  status='observed';const click=item.steps.some(s=>s.stage==='enable_clicked');
  result=click?'Нажал «Включить»; подключение не подтверждено':'Предложение включить уведомления показано; нажатие не записано';
 }else if(item.steps.some(s=>s.target?.endsWith('_view')||s.target?.endsWith('_load'))&&!item.steps.some(s=>s.target?.endsWith('_save')||s.target==='vacation_cancel')){
  status='observed';result=item.steps.some(s=>s.target?.endsWith('_load')&&s.stage==='completed')?'Данные загрузились; сохранённых изменений за день нет':'Раздел открывали; результат загрузки не записан';
 }else if(last?.stage==='validation'){
  status='observed';result='Форма не отправлена: нужно проверить заполнение';nextStep='Нужно заполнить обязательные поля и повторить сохранение.';
 }else if(last?.stage==='cancelled'||last?.stage==='closed'){
  status='observed';result=last.stage==='cancelled'?'Вышел из формы без сохранения':'Закрыл окно; сохранение не записано';
 }else if(last?.stage==='opened'){
  status='observed';result=last.operation==='learning_load'?'Открыл аттестацию; новый результат не записан':last.operation==='payment_load'?'Открыл заявку на оплату; изменений не записано':'Открыл форму; сохранение не записано';
 }else if(last?.stage==='response_received'||last?.stage==='completed'||last?.stage==='accepted'){
  result='Приложение получило ответ; итог операции не подтверждён';nextStep='Проверьте сохранённый результат операции; ответ запроса сам по себе его не доказывает.';
 }else if(last?.target==='workflow'){
  status='observed';
  const recorded:Record<string,string>={submit_clicked:'Нажал сохранение / отправку; результат не записан',submitted:'Запрос отправлен; ответ не записан',photo_selected:'Выбрал фото; сохранение проверяется отдельно',photo_cancelled:'Выбор фото отменён',confirmed_choice:'Изменил выбор в форме',cancel_requested:'Нажал отмену запроса; результат не записан',finish_requested:'Нажал завершение аттестации; результат не записан',auto_finish:'Приложение начало завершение по таймеру',reset_by_app:'Приложение сбросило незавершённую форму',retry:'Повторил попытку'};
  result=recorded[last.stage||'']||humanActivityLabel(last,item.title);
 }
 if(item.message!==undefined&&!item.unresolved&&!item.confirmed&&!item.workflowOutcome){
  if(openings.length)time={at:openings.at(-1)!.at,label:'открыто'};
  else if(shown.length)time={at:shown.at(-1)!.at,label:'показано'};
  else time={at:item.at,label:'в кабинете'};
 }else if(!item.unresolved&&!item.confirmed&&!item.workflowOutcome&&last){time={at:last.at,label:last.stage?.startsWith('close')||last.stage==='cancelled'?'закрыто':last.stage==='shown'||last.stage==='automatic_shown'?'показано':last.stage==='opened'||last.stage==='manual_shown'||last.target?.endsWith('_view')?'открыто':last.target?.endsWith('_load')&&last.stage==='completed'?'загружено':last.stage==='validation'?'проверка':['submit_clicked','submitted'].includes(last.stage||'')?'отправка':last.stage==='photo_selected'?'выбрано':last.stage==='confirmed_choice'?'выбор':last.stage==='reset_by_app'?'сброс':'событие'};}
 if(status==='observed'&&item.workflowContext?.priorResult){const viewed=[...item.steps].reverse().find(s=>s.stage==='completed_view');if(viewed)time={at:viewed.at,label:'открыто'};}
 return {item,status,result,time,reason,nextStep,resultCheck,obligation,openings,shown,push:pushEvidence(item),ownerCheck,history:humanActivityHistory(item.steps,{...item})};
}

/** Keep a case's shared saved outcome, but recompute difficulties from the chosen connection. */
export function managerActivity(data:EmployeeActivityReport,connection='all'){
 const all=buildProcessView(data);
 let items=all;
 if(connection!=='all'){
  const ids=new Set(all.filter(i=>i.steps.some(s=>s.source?.id===connection)).map(i=>i.id));
  const scoped={...data,audit:data.audit?.map(e=>({...e,steps:e.steps.filter(s=>s.source?.id===connection||!s.source&&s.origin==='system')})).filter(e=>e.steps.length)};
  items=buildProcessView(scoped).filter(i=>ids.has(i.id));
 }
 const rows=items.map(item=>present(item,data));
 const chronology:HumanActivity[]=rows.flatMap(r=>r.history);
 for(const episode of data.audit||[])if(episode.visits){const steps=episode.steps.filter(s=>connection==='all'||s.source?.id===connection);chronology.push(...humanActivityHistory(steps,{id:episode.id,title:episode.title,section:viewSection(episode.title),unresolved:false}));}
 chronology.sort((a,b)=>a.at.localeCompare(b.at));
 const userRelevant=chronology.filter(h=>h.raw.some(s=>s.action!=='app'&&!s.target?.endsWith('_load')&&s.stage!=='response_received'&&!(s.origin==='app'&&s.stage==='completed')));
 const detailsBySource=new Map<string,number>();
 for(const h of userRelevant)if(!h.itemId.startsWith('visit:')){const id=h.raw.find(s=>s.source)?.source?.id;if(id)detailsBySource.set(`${id}:${h.section}`,Date.parse(h.at));}
 const latest=userRelevant.filter(h=>{if(!h.itemId.startsWith('visit:'))return true;const id=h.raw.find(s=>s.source)?.source?.id;const detailed=id?detailsBySource.get(`${id}:${h.section}`):undefined;return detailed===undefined||Math.abs(Date.parse(h.at)-detailed)>2000;}).at(-1);
 const counts={result:0,question:0,difficulty:0,observed:0,unknown:0};rows.forEach(r=>counts[r.status]++);
 const rank:Record<ActivityStatus,number>={difficulty:0,question:1,unknown:2,result:3,observed:4};
 rows.sort((a,b)=>rank[a.status]-rank[b.status]||b.time.at.localeCompare(a.time.at));
 return {rows,chronology,latest,counts};
}

export function matchesActivity(row:ManagerActivity,query:string,section:string,difficultiesOnly:boolean){
 const q=query.trim().toLocaleLowerCase('ru-RU');
 return (section==='all'||row.item.section===section)&&(!difficultiesOnly||row.status==='difficulty')&&`${row.item.title} ${row.item.message||''} ${row.result} ${row.reason||''} ${row.item.steps.map(s=>s.label).join(' ')}`.toLocaleLowerCase('ru-RU').includes(q);
}
export function latestActivityText(h:HumanActivity){
 if(h.raw.some(s=>s.opened==='notification'))return `Открыл сообщение «${h.title}»`;
 if(h.raw.some(s=>s.id.startsWith('workflow-fact:')))return `${h.title}: ${h.raw.at(-1)!.label}`;
 if(h.raw.some(isSaved))return h.raw.at(-1)!.label;
 return h.label===h.title||h.label.includes(h.title)?h.label:`${h.title}: ${h.label}`;
}
