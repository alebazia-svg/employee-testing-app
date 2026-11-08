export const employeeScreenSections={day:'Рабочий день',schedule:'График',payroll:'Моя зарплата',notifications:'Уведомления',cash:'Заявки и выдача денег',receipts:'Проверка чеков',learning:'Обучение',procurement:'Закупки'} as const;
export type EmployeeScreenState={section:keyof typeof employeeScreenSections;dialog?:'guide'|'notification'|'inbox'|'push_settings'|'form'|'attention'|'cash_issue';form?:'qr'|'task'|'handover'|'cash'|'schedule'|'vacation'|'schedule_bulk';taskId?:number;date?:string;direction?:'phone_reserve'|'deposit_safe';attentionId?:string;ref?:string;noticeState?:'loading'|'ready'|'error';guideError?:boolean;guideBusy?:boolean;guideReason?:'today'|'tomorrow'|'both'|'none';notificationId?:number;guideMode?:'automatic'|'manual'};
export function parseEmployeeScreen(value:unknown):EmployeeScreenState|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const p=value as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['section','dialog','notificationId','guideMode','form','taskId','date','direction','attentionId','ref','noticeState','guideError','guideBusy','guideReason'].includes(k))||typeof p.section!=='string'||!Object.hasOwn(employeeScreenSections,p.section))return null;
 if(p.dialog!==undefined&&!['guide','notification','inbox','push_settings','form','attention','cash_issue'].includes(String(p.dialog)))return null;
 if(p.notificationId!==undefined&&(p.dialog!=='notification'||!Number.isSafeInteger(p.notificationId)||Number(p.notificationId)<=0))return null;
 if(p.guideMode!==undefined&&(p.dialog!=='guide'||!['automatic','manual'].includes(String(p.guideMode))))return null;
 if(p.noticeState!==undefined&&(p.dialog!=='notification'||!['loading','ready','error'].includes(String(p.noticeState))))return null;
 if((p.guideError!==undefined&&(p.dialog!=='guide'||typeof p.guideError!=='boolean'))||(p.guideBusy!==undefined&&(p.dialog!=='guide'||typeof p.guideBusy!=='boolean'))||(p.guideReason!==undefined&&(p.dialog!=='guide'||!['today','tomorrow','both','none'].includes(String(p.guideReason)))))return null;
 if(p.form!==undefined&&(p.dialog!=='form'||!['qr','task','handover','cash','schedule','vacation','schedule_bulk'].includes(String(p.form))))return null;
 if(p.taskId!==undefined&&(p.dialog!=='form'||!['task','handover'].includes(String(p.form))||!Number.isSafeInteger(p.taskId)||Number(p.taskId)<=0))return null;
 if(p.date!==undefined&&(p.form!=='schedule'||typeof p.date!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date))||new Date(p.date).toISOString().slice(0,10)!==p.date))return null;
 if(p.direction!==undefined&&(p.form!=='cash'||!['phone_reserve','deposit_safe'].includes(String(p.direction))))return null;
 if(p.attentionId!==undefined&&(p.dialog!=='attention'||typeof p.attentionId!=='string'||! /^(issue:[1-9]\d*|review:[a-zA-Z0-9_-]{1,80}|expense:[a-zA-Z0-9_:-]{1,80})$/.test(p.attentionId)))return null;
 if(p.ref!==undefined&&(p.dialog!=='cash_issue'||typeof p.ref!=='string'||! /^[-a-zA-Z0-9_]{1,80}$/.test(p.ref)))return null;
 return p as EmployeeScreenState;
}
export function employeeScreenLabel(screen:EmployeeScreenState) {
 return screen.dialog==='guide'?'Открыта справка':screen.dialog==='notification'?'Открыто сообщение':screen.dialog==='inbox'?'Открыт список уведомлений':screen.dialog==='push_settings'?'Открыта инструкция по уведомлениям':screen.dialog==='attention'?'Открыт вопрос, требующий действий':screen.dialog==='cash_issue'?'Открыто поручение на выдачу денег':screen.dialog==='form'?({qr:'Открыт сканер QR',task:'Открыта проверка кассы',handover:'Открыта сдача смены',cash:'Открыта кассовая операция',schedule:'Открыт день в графике',vacation:'Открыт отпуск',schedule_bulk:'Открыто заполнение графика'}[screen.form||'task']):employeeScreenSections[screen.section];
}
