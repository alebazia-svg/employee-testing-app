import type { EmployeeActivityReport, ActivityObligation } from './employee-activity-report';
import type { AuditEpisode, AuditStep } from './employee-audit-timeline';

export type ActivityRow = { id: string; at: string; title: string; action: string; place: string; origin: 'app' | 'system'; tone: AuditStep['tone']; note?: string; visit: boolean; followUp?: { at: string; label: string } };
export type NoticeSummary = {
  id: string; title: string; body: string; sent: string[]; shown: string[]; opened: string[]; firstSentAt: string | null;
  pushAccepted: string[]; result: string; resultAt: string | null; completed: boolean;
  attention: ActivityObligation['attention']; reason: string; note: string; rows: ActivityRow[];
};
const unique = (items: string[]) => [...new Set(items)].sort();
const completed = (result?: string) => Boolean(result && !['Выполнение не подтверждено', 'Информационное сообщение'].includes(result));

export function activityPlace(item: AuditEpisode, step: AuditStep) {
  if (item.visits) return item.title;
  if (step.target === 'notification' || step.opened === 'notification' || step.id.startsWith('sent:')) return 'Уведомления';
  if (item.id.startsWith('cash:')) return 'Выдача денег';
  // A task ID does not imply handover: cash acceptance uses the same task relation.
  if (item.id.startsWith('handover:')) return 'Рабочий день';
  if (item.id.startsWith('notification:')) return 'Уведомления';
  return 'Проверка чека';
}

/** Read-only projection. Never treat readAt, visits or client acknowledgements as completion. */
export function buildActivityView(data: EmployeeActivityReport) {
  const audit = data.audit || [];
  const rows: ActivityRow[] = audit.flatMap(item => item.steps.map(step => ({
    id: `${item.id}:${step.id}`, at: step.at, title: item.visits ? '' : item.title,
    action: step.label, place: activityPlace(item, step), origin: step.origin, tone: step.tone,
    note: step.note, visit: item.visits,
  })));
  // The old screen omitted these already queried, saved business facts.
  const facts = data.sections.flatMap(section => section.events.filter(f => /^(start|end|task|schedule|cash):/.test(f.id)).map(f => ({ f, section })));
  for (const { f, section } of facts) {
    const taskKey = f.id.startsWith('task:') ? `handover:${f.id.slice(5)}` : null;
    if (taskKey && audit.some(item => item.id === taskKey && item.steps.some(s => s.id === `result:${taskKey}` && s.at === f.at))) continue;
    rows.push({ id: `saved:${f.id}`, at: f.at, title: '', action: f.id.startsWith('task:') ? `Выполнено: ${f.title}` : f.title,
      place: section.label, origin: 'system', tone: 'success', note: `${f.note} Автор действия может быть не установлен.`, visit: false });
  }
  // Preserve source order at equal timestamps; lexical IDs are not chronology.
  rows.sort((a,b) => a.at.localeCompare(b.at));
  const notices: NoticeSummary[] = audit.filter(item => item.notice !== undefined || item.steps.some(s => s.target === 'notification' || s.opened === 'notification' || s.id.startsWith('sent:'))).map(item => {
    const obligation = data.obligations.find(n => n.auditKey === item.id || item.id === `notification:${n.id}` || item.steps.some(s => s.id === `sent:${n.id}`));
    const steps = item.steps;
    return {
      id: item.id, title: obligation?.title || item.title, body: obligation?.body || item.notice || '',
      firstSentAt: obligation?.sentAt || null,
      sent: unique(steps.filter(s => s.id.startsWith('sent:')).map(s => s.at)),
      shown: unique(steps.filter(s => s.stage === 'shown' && s.target === 'notification').map(s => s.at)),
      opened: unique(steps.filter(s => s.opened === 'notification').map(s => s.at)),
      pushAccepted: unique(steps.flatMap(s => s.pushAcceptedAt ? [s.pushAcceptedAt] : [])),
      result: obligation?.result || item.result || 'Выполнение не подтверждено',
      resultAt: obligation?.resultAt || steps.find(s => s.id === `result:${item.id}`)?.at || null,
      completed: completed(obligation?.result || item.result), attention: obligation?.attention || null,
      reason: obligation?.reason || '', note: obligation?.note || '', rows: rows.filter(r => r.id.startsWith(`${item.id}:`)),
    };
  }).sort((a,b) => Number(a.completed) - Number(b.completed) || (b.sent.at(-1) || b.rows.at(-1)?.at || '').localeCompare(a.sent.at(-1) || a.rows.at(-1)?.at || ''));
  const problems = rows.filter(row => row.tone === 'error' || row.tone === 'warning');
  for (const row of problems) {
    const episode = audit.find(e => e.steps.some(s => `${e.id}:${s.id}` === row.id));
    const later = episode?.steps.find(s => s.at > row.at && (s.stage === 'accepted' || s.id.startsWith('result:')));
    if (later) row.followUp = { at: later.at, label: later.stage === 'accepted' ? 'Ответ сохранён' : later.label };
  }
  const visits = rows.filter(row => row.visit);
  const saved = rows.filter(row => row.origin === 'system' && row.tone === 'success' && !row.id.includes(':sent:'));
  const sections = [...new Set(rows.map(r => r.place))].map(label => {
    const sectionRows = rows.filter(r => r.place === label);
    return { label, visits: sectionRows.filter(r => r.visit).length,
      lastAt: sectionRows.at(-1)?.at || null };
  });
  const pending = notices.filter(n => !n.completed && n.result !== 'Информационное сообщение');
  const completedNotices = notices.filter(n => n.completed);
  const unresolvedProblems = problems.filter(r => !r.followUp);
  const recoveredProblems = problems.filter(r => r.followUp);
  // Only describe recorded evidence, never infer absence of work or current outages.
  const overview = pending.length || unresolvedProblems.length
    ? { title: 'Есть события для проверки', text: [
      pending.length ? `Поручения без подтверждённого результата: ${pending.length}.` : '',
      unresolvedProblems.length ? `Ошибки без записи о последующем сохранении: ${unresolvedProblems.length}.` : '',
    ].filter(Boolean).join(' '), attention: true }
    : completedNotices.length
      ? { title: 'По поручениям есть результат', text: `Подтверждён результат: ${completedNotices.length}.${recoveredProblems.length ? ' После зафиксированных ошибок есть успешное сохранение.' : ''}`, attention: false }
      : { title: rows.length ? 'Действия за день записаны' : 'За день пока нет записей', text: rows.length ? 'Уведомления и сохранённые действия можно проверить ниже.' : 'По отсутствию записей нельзя судить, работал ли сотрудник.', attention: false };
  return { rows, notices, problems, visits, saved, sections, pending, completedNotices, unresolvedProblems, recoveredProblems, overview,
    firstContact: rows.find(r => r.origin === 'app')?.at || null,
    lastContact: rows.filter(r => r.origin === 'app').at(-1)?.at || null,
  };
}
