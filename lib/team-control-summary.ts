import { formatTime } from './workday';
export type ControlSummaryRow = {
 id:number; detailAvailable?:boolean; sourceUnavailable?:boolean; planState:string; missing:boolean; needsReview:boolean; review:string;
 alerts:string[]; alertTargets:Record<string,string>;
 issues:Array<{id:number;title:string;state?:string;originDate?:string;meta:string;href:string}>;
 timing:string[];
};
export function teamControlSummary(row:ControlSummaryRow,date:string,ownerActions:OwnerQueueAction[]=[]){
 const detail=(focus?:string)=>row.detailAvailable===false?`/admin/attendance?date=${date}`:`/admin/workday?date=${date}&control=all&employee=${row.id}${focus?`&focus=${encodeURIComponent(focus)}`:''}#employees-control`;
 const items:Array<{key:string;label:string;context?:string;originDate?:string;href:string;kind:'decision'|'check'|'employee'}>=[];
 for(const action of ownerActions.filter(action=>action.employeeId===row.id))items.push({key:action.key,label:action.label,context:action.context,originDate:action.originDate,href:action.href,kind:action.kind});
 const inheritedCount=items.length;
 const seen=new Set<string>();
 for(const alert of row.alerts){
  if(row.issues.some(issue=>alert===issue.title||alert.startsWith(`${issue.title} ·`)))continue;
  if(seen.has(alert))continue;seen.add(alert);
  items.push({key:`alert-${items.length}`,label:alert,href:detail(row.alertTargets[alert]),kind:alert.startsWith('Завершить рабочий день')?'decision':'check'});
 }
 for(const issue of row.issues){
  const key=`issue-${issue.id}`;if(items.some(item=>item.key===key))continue;
  items.push({key,label:issue.title,originDate:issue.originDate||date,context:[issue.meta,issue.state??'Открыто'].filter(Boolean).join(' · '),href:issue.href,kind:['Не удалось проверить','Нужна помощь'].includes(issue.state??'')?'check':'employee'});
 }
 if(row.missing)items.push({key:'missing',label:'По плану нет отметки начала',href:detail('shift-start'),kind:'check'});
 if(row.planState==='unknown')items.push({key:'schedule',label:'Нет записи графика',href:`/admin/attendance?date=${date}`,kind:'check'});
 if(row.needsReview&&items.length===inheritedCount)items.push({key:'review',label:row.review,href:detail(),kind:'check'});
 const kind=items.some(item=>item.kind==='decision')?'decision':items.some(item=>item.kind==='check')?'check':items.length?'employee':(row.planState==='unavailable'||row.sourceUnavailable)?'unavailable':row.timing.length?'timing':'normal';
 const breakdown={decision:items.filter(item=>item.kind==='decision').length,check:items.filter(item=>item.kind==='check').length,employee:items.filter(item=>item.kind==='employee').length};
 const label={decision:'Ждёт разрешения',check:'Нужна проверка',employee:'Есть замечания',unavailable:'Нет данных',timing:'Сроки',normal:'—'}[kind];
 const count=kind==='decision'||kind==='check'||kind==='employee'?breakdown[kind]:kind==='timing'?row.timing.length:0;
 const ordered=items.sort((a,b)=>['decision','check','employee'].indexOf(a.kind)-['decision','check','employee'].indexOf(b.kind));
 return {kind,label,breakdown,count,totalCount:items.length,originDates:[...new Set(items.map(item=>item.originDate??date))],items:ordered,timing:row.timing.map((text,index)=>({key:`timing-${index}`,label:text,href:detail(row.alertTargets[text])})),unavailable:row.planState==='unavailable'||Boolean(row.sourceUnavailable)};
}

export type DepartmentControlAction = {
 key:string; department:string; label:string; context:string; href:string;
 kind:'decision'|'check'|'employee';
};
// Use persisted workflow state, never notification-read state or the ADMIN recipient as an employee.
export function fiscalControlAction(review:{id:string;status:string;amountKopecks:number;participants:Array<{response:string}>},
 match:{status:string;oneCSourceRef:string|null}|undefined,adminFirst:boolean,recipientCount?:number):DepartmentControlAction|null {
 if(!['admin_review','open'].includes(review.status)||match?.status==='confirmed')return null;
 const kind=review.status==='admin_review'
  ? adminFirst&&!match?.oneCSourceRef&&recipientCount!==0?'decision':'check'
  : review.participants.some(p=>p.response==='help')||review.participants.length>0&&review.participants.every(p=>p.response==='not_mine')?'check':'employee';
 return {key:`fiscal-${review.id}`,department:'retail',kind,
  label:review.status==='admin_review'?kind==='decision'?'Передать проверку чека':'Проверить сопоставление чека':kind==='check'?'Сотруднику нужна помощь с чеком':'Проверка чека у сотрудника',
  context:`${(review.amountKopecks/100).toLocaleString('ru-RU')} ₽`,href:`/admin/workday/payment-checks/${encodeURIComponent(review.id)}`};
}

export function controlCountLabel(count:number,kind:string,mixed=false){
 if(!count)return '';
 const forms=kind==='employee'&&!mixed?['замечание','замечания','замечаний']:kind==='decision'&&!mixed?['запрос','запроса','запросов']:kind==='timing'?['отклонение','отклонения','отклонений']:['вопрос','вопроса','вопросов'];
 const mod100=count%100,mod10=count%10;
 const word=forms[mod100>=11&&mod100<=14?2:mod10===1?0:mod10>=2&&mod10<=4?1:2];
 return `${mixed?'Всего ':''}${count} ${word}`;
}

export type OwnerQueueAction = DepartmentControlAction & {name:string;employeeId:number;originDate:string};
export function openCashControl(status:string){return !['posted_1c_pair','resolved_manual','cancelled'].includes(status);}
export function pastOwnerActions(requests:Array<{id:string;employeeId:number;status:string;reasonCode:string;requestedAt:Date;employee:{name:string;department:string};workDayEntry:{date:string;status:string;endedAt:Date|null}}>,
 operations:Array<{id:number;userId:number;date:string;status:string;amount:number;createdAt:Date;user:{name:string;department:string}}>,selectedDate:string,today:string):OwnerQueueAction[]{
 if(selectedDate!==today)return [];
 const href=(date:string,userId:number,focus:string)=>`/admin/workday?date=${date}&control=all&employee=${userId}&focus=${encodeURIComponent(focus)}#employees-control`;
 const requestsToDecide=requests.filter(request=>request.status==='pending'&&request.workDayEntry.date<today&&!request.workDayEntry.endedAt&&['active','missing_checkout'].includes(request.workDayEntry.status));
 return [
  ...requestsToDecide.map(request=>({key:`past-request-${request.id}`,name:request.employee.name,employeeId:request.employeeId,department:request.employee.department,originDate:request.workDayEntry.date,kind:'decision' as const,label:request.reasonCode.startsWith('cash_encashment_')?'Разрешить день без инкассации':'Разрешить завершение дня',context:`${request.workDayEntry.date} · ${formatTime(request.requestedAt)}`,href:href(request.workDayEntry.date,request.employeeId,`shift-request-${request.id}`)})),
  ...operations.filter(operation=>operation.date<today&&openCashControl(operation.status)).map(operation=>({key:`past-cash-${operation.id}`,name:operation.user.name,employeeId:operation.userId,department:operation.user.department,originDate:operation.date,kind:'check' as const,label:`Инкассация ${operation.amount.toLocaleString('ru-RU')} ₽`,context:`${operation.date} · ${formatTime(operation.createdAt)} · нет подтверждения 1С`,href:href(operation.date,operation.userId,`shift-cash-${operation.id}`)})),
 ];
}

export function controlCompositionLabel(breakdown:{decision:number;check:number;employee:number}):string|null {
 const kinds=Object.values(breakdown).filter(count=>count>0).length;
 if(kinds<2)return null;
 const owner=breakdown.decision+breakdown.check;
 if(breakdown.employee>0)return `Вам: ${owner} · сотруднику: ${breakdown.employee}`;
 const plural=(count:number,forms:string[])=>{const mod=count%100,last=count%10;return forms[mod>=11&&mod<=14?2:last===1?0:last>=2&&last<=4?1:2]};
 return `${breakdown.decision} ${plural(breakdown.decision,['разрешение','разрешения','разрешений'])} · ${breakdown.check} ${plural(breakdown.check,['проверка','проверки','проверок'])}`;
}
