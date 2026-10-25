import { buildAuditTimeline } from '@/lib/employee-audit-timeline';
import type { EmployeeActivityReport } from '@/lib/employee-activity-report';
export function demoReport(scenario: string): EmployeeActivityReport {
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
