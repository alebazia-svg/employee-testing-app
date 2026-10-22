import 'server-only';
import { EMPLOYEE_EXPENSE_KIND } from './employee-expense-policy';
import { loadEmployeeExpenses } from './employee-expense-snapshot';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { employeeReviewState, orderEmployeeAttention, type EmployeeAttentionItem } from '@/lib/employee-attention';
export async function loadEmployeeAttention(user: { id: number }) {
  const now = new Date();
  const [issues, reviews, cash, requests, expenses] = await Promise.all([
    prisma.workdayControlIssue.findMany({ where: { userId: user.id, status: 'open', employeeActionRequired: true }, include: { messages: { orderBy: { createdAt: 'desc' }, include: { author: { select: { role: true } } } } } }),
    prisma.terminalFiscalEmployeeReview.findMany({ where: { status: 'open', OR: [{ employeeId: user.id }, { participants: { some: { userId: user.id } } }] }, include: { participants: { include: { user: { select: { name: true } } } }, messages: { orderBy: { createdAt: 'desc' }, include: { author: { select: { role: true } } } } } }),
    prisma.cashOperation.findMany({ where: { userId: user.id, status: { notIn: ['posted_1c_pair', 'resolved_manual'] } }, orderBy: { createdAt: 'asc' } }),
    prisma.workdayCloseExceptionRequest.findMany({ where: { employeeId: user.id, consumedAt: null, workDayEntry: { endedAt: null, status: { in: ['active', 'missing_checkout'] } } }, include: { workDayEntry: { select: { date: true } } }, orderBy: { requestedAt: 'desc' } }),
    loadEmployeeExpenses(user.id).catch(() => ({ state: 'unavailable' as const, checkedAt: null, payable: [], pending: [] })),
  ]);
  const events = issues.length ? await prisma.adminInboxEvent.findMany({ where: { sourceType: 'workday_control_issue', sourceId: { in: issues.map(i => String(i.id)) }, eventKey: { startsWith: 'credit_issue:' } }, select: { sourceId: true, eventKey: true, occurredAt: true }, orderBy: { occurredAt: 'desc' } }) : [];
  const items: EmployeeAttentionItem[] = issues.map(issue => {
    const view = workdayIssueView(issue);
    const reply = issue.messages.find(m => m.author.role === 'ADMIN');
    const response = events.find(e => e.sourceId === String(issue.id) && e.eventKey.endsWith(`:${user.id}`));
    const waiting = response && (!reply || reply.createdAt <= response.occurredAt);
    return { id: `issue:${issue.id}`, kind: issue.ruleKey === 'kkm_shift_not_closed' ? 'closing' : 'receipt', title: `${view.summaryTitle}${view.amount ? ` · ${view.amount}` : ''}`, date: issue.originDate || issue.detectedAt.toISOString().slice(0,10), priority: issue.severity === 'error' ? 0 : 1,
      state: waiting ? 'waiting' : 'action', status: reply && !waiting ? 'Есть ответ администратора' : waiting ? 'У администратора' : 'Нужно проверить', detail: view.instruction, reply: reply?.body,
      facts: view.documentNumber ? [['Документ', view.documentNumber], ['Сумма', view.amount]] : [],
      ...(issue.ruleKey === 'credit_realization_mismatch' && !waiting ? { endpoint: `/api/employee/workday-issues/${issue.id}/actions`, actions: [{ label: view.notFoundLabel, action: 'not_found' }, { label: 'Продажа не моя', action: 'not_mine' }] } : {}),
    };
  });
  for (const review of reviews) {
    const own = review.participants.find(p => p.userId === user.id);
    const reply = review.messages.find(m => m.author.role === 'ADMIN');
    const handler = review.participants.find(p => p.userId !== user.id && p.response === 'pending' && p.handlingUntil && p.handlingUntil > now);
    const state = employeeReviewState({ response: own?.response, handler: handler?.user.name, adminRepliedAfterResponse: Boolean(reply && (!own?.respondedAt || reply.createdAt > own.respondedAt)) });
    const shared = ['retail_shift', 'retail_day'].includes(review.assignmentScope);
    items.push({ id: `review:${review.id}`, kind: 'receipt', title: `Чек по оплате · ${(review.amountKopecks/100).toLocaleString('ru-RU')} ₽`, date: review.bankOperationAt.toISOString(), priority: 1, ...state, shared, reply: reply?.body,
      detail: 'Оплата по терминалу найдена, чек в 1С пока не подтверждён. Проверьте оформление продажи.',
      facts: [['Оплата', new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(review.bankOperationAt)]],
      endpoint: `/api/employee/payment-checks/${review.id}/actions`, actions: state.state === 'action' ? [{ label: 'Нужна помощь', action: 'help' }, { label: 'Оплата не моя', action: 'not_mine' }] : own?.response === 'not_mine' ? [{ label: 'Это моя оплата', action: 'undo_not_mine' }] : [],
    });
  }
  for (const operation of cash) items.push({ id: `cash:${operation.id}`, kind: 'encashment', title: `Инкассация ${operation.amount.toLocaleString('ru-RU')} ₽`, date: operation.createdAt.toISOString(), priority: 2, state: 'waiting', status: ['one_c_error','manual_in_progress'].includes(operation.status) ? 'У администратора' : 'Проверяется в 1С', detail: 'Операция сохранена. Не вносите деньги повторно.', facts: [['Назначение', operation.direction === 'deposit_safe' ? 'Депозитный сейф' : 'Резерв под телефоны'], ['Время',new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(operation.createdAt)]] });
  const seen = new Set<string>();
  for (const request of requests) {
    const scope = request.reasonCode.startsWith('cash_encashment_') ? 'encashment' : 'closing';
    if (seen.has(scope)) continue;
    seen.add(scope);
    if (request.status === 'approved') continue; // Existing handover owns the next step.
    if (!['pending','rejected'].includes(request.status)) continue;
    const relatedIds = Array.isArray(request.issueIds) ? request.issueIds.map(Number).filter(Number.isInteger) : [];
    const related = items.filter(item => relatedIds.some(id => item.id === `issue:${id}`));
    // One closing decision replaces the same blocking issues, rather than repeating them.
    for (const item of related) items.splice(items.indexOf(item), 1);
    items.push({ id: `close:${request.id}`, kind: 'closing', closingScope: scope, title: scope === 'encashment' ? 'Закрыть смену без инкассации' : 'Закрытие смены', date: request.workDayEntry.date, priority: 0, state: request.status === 'pending' ? 'waiting' : 'action', status: request.status === 'pending' ? 'Ждём решения администратора' : 'Не согласовано', detail: request.decisionComment || (request.status === 'pending' ? 'Запрос отправлен. Смена пока открыта.' : 'Продолжите сдачу смены и устраните замечания.'), facts: related.map(item => ['На контроле', item.title] as [string,string]) });
  }
  if (expenses.state === 'ready' && expenses.payable.length) items.push({
    id: 'expense:payable', kind: 'cash', title: 'Заявки к оплате', priority: 1, state: 'action',
    status: 'Оформите расходники в 1С', date: expenses.checkedAt ?? now.toISOString(),
    detail: 'Оформите расходники в 1С — уведомление исчезнет само.',
    facts: expenses.payable.map(row => [`№${row.number} · ${row.purpose}`, `${row.remaining.toLocaleString('ru-RU')} ₽`]),
  });
  const unread = await prisma.workdayNotification.findMany({ where: { userId: user.id, status: 'sent', readAt: null }, select: { id: true, kind: true, issueId: true, reviewId: true } });
  for (const item of items) item.notificationIds = unread.filter(row => row.issueId && item.id === `issue:${row.issueId}` || row.reviewId && item.id === `review:${row.reviewId}` || item.id === 'expense:payable' && row.kind === EMPLOYEE_EXPENSE_KIND).map(row => row.id);
  return { items: orderEmployeeAttention(items), expenses, checkedAt: now.toISOString() };
}
