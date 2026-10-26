import { buildAuditTimeline } from '@/lib/employee-audit-timeline';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
export function demoReport(scenario: string): EmployeeActivityReport {
  if(scenario==='process')return processDemo();
  const d = (time: string) => new Date(`2026-10-25T${time}:00+03:00`);
  const notice = { id: 11, title: 'Чек по продаже · 2 400 ₽', body: 'Проверьте чек по продаже на 2 400 ₽.', kind: 'receipt', fingerprint: 'demo:11', sentAt: d('10:15'), taskId: null, issueId: 3, reviewId: null, pushDeliveredAt: d('10:15') };
  const ev = (id: string, stage: string, time: string, target = 'issue', ref = '3') => ({ id, kind: 'interaction', section: 'receipts', notificationId: null, createdAt: d(time), context: { target, ref, stage } });
  const events = [
    { ...ev('v1', 'open', '09:01'), kind: 'visit', section: 'day' },
    { ...ev('v2', 'open', '09:04'), kind: 'visit', section: 'schedule' },
    ev('shown', 'shown', '10:15', 'notification', '11'),
    ev('opened', 'open', '10:16', 'notification', '11'),
    ev('card', 'open', '10:16'),
    ev('help', 'not_found', '10:16'),
    { ...ev('err', 'error', '10:16'), context: { target: 'issue', ref: '3', stage: 'error', message: 'send_failed' } },
    ev('retry', 'not_found', '10:17'),
    ev('ok', 'accepted', '10:17'),
    ev('close', 'close', '10:18'),
    { ...ev('v3', 'open', '12:20'), kind: 'visit', section: 'payroll' },
    { ...ev('v4', 'open', '17:50'), kind: 'visit', section: 'day' },
  ];
  if (scenario === 'working') events.splice(6);
  if (scenario === 'stale') events.splice(3);
  const audit = scenario === 'empty' ? [] : buildAuditTimeline(events, [notice], '2026-10-25', scenario === 'resolved' ? [{ id: 'issue:3', title: notice.title, result: 'Вопрос закрыт системой', at: d('10:25').toISOString() }] : []);
  return { audit, date: '2026-10-25', checkedAt: d('18:10').toISOString(), startedAt: d('08:00').toISOString(), retentionDays: 90, truncated: false, shift: { status: 'unknown', startedAt: null, endedAt: null }, obligations: [], sections: [], episodes: [] };
}

function processDemo():EmployeeActivityReport {
 const date='2026-10-25',at=(t:string)=>new Date(`${date}T${t}+03:00`);
 const operation=(action:string,stage:string,t:string,attemptId:string,extra:Record<string,unknown>={})=>({id:`${attemptId}-${stage}`,kind:'operation',section:'day',notificationId:null,createdAt:at(t),context:{action,stage,attemptId,...extra}});
 const notice={id:11,title:'Проверить чек по продаже',body:'Проверьте, появился ли чек по продаже.',kind:'receipt',fingerprint:'demo:11',sentAt:at('11:00:00'),taskId:null,issueId:3,reviewId:null,pushDeliveredAt:at('11:00:00')};
 const interaction=(stage:string,t:string)=>({id:`notice-${stage}`,kind:'interaction',section:'notifications',notificationId:11,createdAt:at(t),context:{target:'notification',ref:'11',stage}});
 const events=[
  operation('schedule_view','started','09:05:00','schedule-view-1',{period:'2026-10'}),
  operation('schedule_save','started','09:06:00','schedule-save-1',{period:'2026-10-27'}),
  operation('schedule_save','completed','09:06:01','schedule-save-1',{period:'2026-10-27',durationMs:800}),
  interaction('shown','11:03:00'),interaction('open','11:07:00'),
  operation('payroll_view','started','12:20:00','payroll-view-1',{period:'2026-10'}),
  operation('payroll_load','started','12:20:00','payroll-load-1',{period:'2026-10'}),
  operation('payroll_load','failed','12:20:15','payroll-load-1',{period:'2026-10',durationMs:15000,reason:'request'}),
  operation('payroll_load','started','12:20:30','payroll-load-2',{period:'2026-10'}),
  operation('payroll_load','completed','12:20:32','payroll-load-2',{period:'2026-10',durationMs:2100}),
  operation('payroll_view','started','15:10:00','payroll-view-2',{period:'2026-10'}),
  operation('cash_send','started','18:42:00','cash-send-1',{ref:'demo-cash-key'}),
  operation('cash_send','queued','18:42:24','cash-send-1',{ref:'demo-cash-key',durationMs:24000,reason:'network'}),
  operation('cash_send','started','18:45:00','cash-send-2',{ref:'demo-cash-key'}),
  operation('cash_send','completed','18:45:03','cash-send-2',{ref:'demo-cash-key',durationMs:3000}),
 ];
 return {date,checkedAt:at('19:00:00').toISOString(),startedAt:at('08:00:00').toISOString(),retentionDays:90,truncated:false,
  shift:{status:'active',startedAt:at('09:00:00').toISOString(),endedAt:null},
  audit:buildAuditTimeline(events,[notice],date,[{id:'issue:3',title:notice.title,result:'Вопрос закрыт системой',at:at('11:19:00').toISOString()}]),
  sections:[{id:'schedule',label:'График',visits:1,actions:1,lastAt:at('09:06:01').toISOString(),events:[{id:'schedule:1',section:'schedule',period:'2026-10',at:at('09:06:01').toISOString(),title:'27 октября: выходной → рабочий день',note:'Изменение сохранено сотрудником.',visit:false}]}],
  cashEvidence:[{key:'demo-cash-key',at:at('18:45:02').toISOString(),postedAt:at('18:45:03').toISOString(),document:'демо-001',status:'posted'}],obligations:[],episodes:[]};
}
