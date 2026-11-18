import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import { processRetailCash } from '@/lib/retail-cash-handover-server';
import { prisma } from '@/lib/prisma';
import { readExperience } from '@/lib/employee-experience-policy';

const money = (amount: number) => amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
const clock = (date: Date) => date.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' });

type Props = { employeeId: number; workDayId?: number; endedAt?: Date | null; taskId?: number };

export async function RetailCashHandoverControl({ employeeId, workDayId, endedAt, taskId }: Props) {
  if (!workDayId) return null;
  const [handover, interactions] = await Promise.all([
    prisma.retailCashHandover.findUnique({ where: { workDayEntryId: workDayId } }),
    taskId ? prisma.portalActivityEvent.findMany({
      where: { userId: employeeId, kind: 'experience', AND: [
        { context: { path: ['action'], equals: 'retail_cash_count' } },
        { context: { path: ['taskId'], equals: taskId } },
      ] },
      select: { context: true, createdAt: true }, orderBy: { createdAt: 'asc' },
    }) : [],
  ]);
  const history: Array<{ at: Date; label: string }> = [];
  const recorded = new Set<string>();
  for (const event of interactions) {
    const context = readExperience(event.context);
    if (context?.target !== 'workflow') continue;
    const key = context.attemptId + ':' + context.stage;
    if (recorded.has(key)) continue;
    recorded.add(key);
    if (context.stage === 'opened') history.push({ at: event.createdAt, label: 'Открыл пересчёт' });
    if (context.stage === 'cancelled') history.push({ at: event.createdAt, label: 'Закрыл без подтверждения' });
  }
  if (Array.isArray(handover?.countHistory)) {
    for (const entry of handover.countHistory) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      if (typeof entry.actual === 'number' && typeof entry.capturedAt === 'string') {
        history.push({ at: new Date(entry.capturedAt), label: 'Сохранён пересчёт · ' + money(entry.actual) });
      }
    }
  }
  if (handover?.handedAt) history.push({ at: handover.handedAt, label: 'Подтвердил передачу · ' + money(Number(handover.actual)) });
  if (handover?.status === 'zero' && endedAt) history.push({ at: endedAt, label: 'Завершил день с нулевым остатком' });
  history.sort((a, b) => +a.at - +b.at);
  const actual = Number(handover?.actual);
  const expected = handover?.expected == null ? null : Number(handover.expected);
  const difference = expected === null ? null : Math.round((actual - expected) * 100) / 100;
  const posted = handover?.status === 'posted';
  const review = handover?.status === 'review';
  async function retry() {
    'use server';
    const admin = await getCurrentUser();
    if (admin?.role !== 'ADMIN' || !workDayId) throw new Error('Нет доступа.');
    await processRetailCash(prisma, employeeId, workDayId);
    revalidatePath('/admin/workday');
  }
  const canRetry = handover?.status === 'error' || handover?.status === 'confirmed' ||
    (handover?.status === 'posting' && handover.processingStartedAt && Date.now() - +handover.processingStartedAt >= 120000);
  return <section id={taskId ? `shift-task-${taskId}` : undefined} className="px-4 pb-3">
    <h4 className="team-card-heading">Передача кассы</h4>
    {handover ? <table className="team-handover-table"><tbody>
      <tr><th scope="row">Пересчёт · {clock(handover.countedAt)}</th><td>Фактически {money(actual)} · {expected === null ? 'Остаток 1С не получен' : 'По 1С ' + money(expected)}</td></tr>
      <tr><th scope="row">Расхождение</th><td><span className={difference ? 'team-status amber' : ''}>{difference === null ? 'Не проверено' : difference === 0 ? 'Нет' : (difference > 0 ? 'Излишек ' : 'Недостача ') + money(Math.abs(difference))}</span></td></tr>
      <tr><th scope="row">Передача{handover.handedAt && ' · ' + clock(handover.handedAt)}</th><td>{handover.handedAt
        ? <>{money(actual)} · Получатель: {handover.recipientName}</>
        : handover.status === 'zero' ? 'При остатке 0 ₽ передача не требуется' : 'Ещё не подтверждена'}</td></tr>
      {handover.handedAt && <tr><th scope="row">Документы 1С</th><td>{posted
        ? <details><summary className="cursor-pointer"><span className="team-status green">Проведено в 1С</span></summary><p className="mt-1">РКО {handover.expenseNumber} → ПКО {handover.receiptNumber}</p></details>
        : <><span className="team-status amber">{review || handover.status === 'error' ? 'Требуется проверка передачи' : 'Оформляется в 1С'}</span>{canRetry && <form action={retry}><button className="team-cash-action" type="submit">Повторить проведение</button></form>}{(review || handover.status === 'error') && handover.error && <p>{handover.error}</p>}</>}</td></tr>}
    </tbody></table> : <p className="team-card-note">Пересчёт ещё не сохранён.</p>}
    {history.length > 0 && <details className="team-card-checks"><summary>История действий</summary><ol className="team-cash-evidence">{history.map((event, index) =>
      <li key={index}>{clock(event.at)} · {event.label}</li>)}</ol></details>}
  </section>;
}
