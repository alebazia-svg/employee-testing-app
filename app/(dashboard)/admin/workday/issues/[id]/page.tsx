import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { formatDateLabel, formatTime, getMoscowDateKey } from '@/lib/workday';

export const dynamic = 'force-dynamic';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function zReportPhotoPath(value: unknown) {
  const photos = record(record(value)?.photos);
  const photo = record(photos?.zReport);
  return typeof photo?.storagePath === 'string' ? photo.storagePath : '';
}

export default async function AdminWorkdayIssuePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const issueId = Number(params.id);
  const issue = Number.isInteger(issueId) ? await prisma.workdayControlIssue.findUnique({
    where: { id: issueId },
    include: { user: { select: { name: true } }, task: { select: { handoverData: true } }, notifications: { where: { kind: 'workday_issue_reply' }, orderBy: { createdAt: 'desc' }, take: 5 }, messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } } },
  }) : null;
  if (!issue) redirect('/admin/workday');
  const open = issue.status === 'open' && issue.employeeActionRequired;
  const view = workdayIssueView(issue);
  const isKkmCloseIssue = issue.ruleKey === 'kkm_shift_not_closed';
  const evidence = record(issue.sourceData);
  const zReportPath = zReportPhotoPath(issue.task?.handoverData);
  const zReportHref = zReportPath ? `/api/admin/workday/shift-control-photo?path=${encodeURIComponent(zReportPath)}` : '';
  const today = getMoscowDateKey();
  const originLabel = issue.originDate === today ? 'Сегодня' : formatDateLabel(issue.originDate);
  const lastDetectedDate = getMoscowDateKey(issue.lastDetectedAt);
  const lastDetectedLabel = lastDetectedDate === today
    ? `сегодня в ${formatTime(issue.lastDetectedAt)}`
    : `${formatDateLabel(lastDetectedDate)} в ${formatTime(issue.lastDetectedAt)}`;
  const employeeIssues = await prisma.workdayControlIssue.findMany({
    where: { userId: issue.userId, status: 'open', employeeActionRequired: true },
    orderBy: [{ severity: 'desc' }, { detectedAt: 'asc' }],
  });
  const deliveryLabel = (notification: typeof issue.notifications[number]) => {
    if (notification.readAt) return 'Прочитано';
    if (notification.pushStatus === 'delivered') return 'Доставлено на устройство';
    if (notification.pushStatus === 'no_subscription') return 'Push не подключён — увидит при входе';
    if (notification.status === 'pending') return 'Ожидает отправки';
    if (notification.pushStatus === 'retry_pending') return 'Повторная отправка';
    return 'Сохранено в портале';
  };
  return (
    <AdminShell>
      <AdminBreadcrumbs current='Обязательная ошибка' />
      {employeeIssues.length > 1 && (
        <nav aria-label={`Активные ошибки сотрудника ${issue.user.name}`} className='mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3'>
          <div className='flex items-center justify-between gap-3 px-1 pb-2'>
            <p className='text-sm font-black text-slate-950'>{issue.user.name} · активные ошибки</p>
            <span className='rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800'>{employeeIssues.length}</span>
          </div>
          <div className='grid gap-2 sm:grid-cols-2 xl:grid-cols-3'>
            {employeeIssues.map((employeeIssue) => {
              const employeeIssueView = workdayIssueView(employeeIssue);
              const selected = employeeIssue.id === issue.id;
              return (
                <Link
                  key={employeeIssue.id}
                  href={`/admin/workday/issues/${employeeIssue.id}`}
                  aria-current={selected ? 'page' : undefined}
                  className={`rounded-xl px-3 py-2.5 ring-1 transition ${selected ? 'bg-slate-950 text-white ring-slate-950' : 'bg-white text-slate-950 ring-amber-200 hover:ring-amber-400'}`}
                >
                  <span className='block text-sm font-extrabold'>{employeeIssueView.summaryTitle}</span>
                  <span className={`mt-0.5 block text-xs font-bold ${selected ? 'text-slate-300' : 'text-slate-500'}`}>{employeeIssueView.summaryMeta || 'Открыть подробности'}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <div className='grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]'>
        <Card className={open ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <div className='flex gap-3'><AlertTriangle className={`mt-0.5 h-6 w-6 shrink-0 ${open ? 'text-amber-700' : 'text-green-700'}`} /><div><p className={`text-xs font-extrabold uppercase tracking-wide ${open ? 'text-amber-700' : 'text-green-700'}`}>{open ? 'Действие требуется' : 'Активное действие закрыто'}</p><h1 className='mt-1 text-2xl font-black text-slate-950'>{isKkmCloseIssue ? issue.title : 'Чек по кредитной продаже'}</h1><p className='mt-3 text-base font-bold leading-relaxed text-slate-800'>{isKkmCloseIssue ? issue.detail : view.instruction}</p></div></div>
          <dl className='mt-5 grid gap-3 border-t border-amber-200 pt-4 text-sm sm:grid-cols-2'><div><dt className='font-semibold text-slate-500'>Сотрудник</dt><dd className='mt-1 font-extrabold text-slate-950'>{issue.user.name}</dd></div>{isKkmCloseIssue ? <><div><dt className='font-semibold text-slate-500'>Касса 1С</dt><dd className='mt-1 font-extrabold text-slate-950'>{String(evidence?.cashRegisterName || 'не определена')}</dd></div><div><dt className='font-semibold text-slate-500'>ККТ</dt><dd className='mt-1 break-all font-extrabold text-slate-950'>{String(evidence?.kktRegistrationNumber || 'не определена')}</dd></div><div><dt className='font-semibold text-slate-500'>Состояние источников</dt><dd className='mt-1 font-extrabold text-slate-950'>{String(evidence?.sourceError || issue.detail)}</dd></div></> : <div><dt className='font-semibold text-slate-500'>Реализация</dt><dd className='mt-1 font-extrabold text-slate-950'>{[view.documentNumber, view.amount].filter(Boolean).join(' · ')}</dd></div>}<div><dt className='font-semibold text-slate-500'>Проблема возникла</dt><dd className='mt-1 font-extrabold text-slate-950'>{originLabel}</dd></div><div><dt className='font-semibold text-slate-500'>Последняя автопроверка</dt><dd className='mt-1 font-extrabold text-slate-950'>{lastDetectedLabel}</dd></div>{!isKkmCloseIssue && !open && view.receiptDelayMinutes !== null && <div><dt className='font-semibold text-slate-500'>Чек пробит позже</dt><dd className='mt-1 font-extrabold text-slate-950'>на {view.receiptDelayMinutes} мин.</dd></div>}{!isKkmCloseIssue && view.receiptCashierName && <div><dt className='font-semibold text-slate-500'>Кассир чека 1С</dt><dd className='mt-1 font-extrabold text-slate-950'>{view.receiptCashierName}</dd></div>}</dl>
          {isKkmCloseIssue && <div className='mt-5 rounded-xl bg-white p-4 ring-1 ring-amber-200'><p className='text-sm font-black text-slate-950'>Фото чека закрытия</p>{zReportHref ? <a href={zReportHref} target='_blank' rel='noreferrer' className='mt-3 block overflow-hidden rounded-xl ring-1 ring-slate-200'><img src={zReportHref} alt='Фото чека закрытия смены' className='max-h-[32rem] w-full object-contain' /></a> : <p className='mt-2 text-sm font-semibold text-slate-600'>Фото не приложено. Возможно, чек не распечатался.</p>}</div>}
          {!open && view.receiptDelayMinutes !== null && view.receiptDelayMinutes > 15 && <p className='mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700'>Правильный чек появился, поэтому действие сотрудника закрыто. Опоздание сохранено в audit.</p>}
          {open && issue.ruleKey === 'credit_realization_mismatch' && <form action={`/api/admin/workday/issues/${issue.id}/dismiss`} method='post' className='mt-5 border-t border-amber-200 pt-4'><button type='submit' className='rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-extrabold text-white'>Снять как тестовую проверку</button><p className='mt-2 text-xs font-semibold text-slate-500'>Только эта реализация больше не будет возвращаться. Новые ошибки продолжат создаваться.</p></form>}
        </Card>
        <Card><div className='mb-4 flex items-center gap-2'><MessageCircle className='h-5 w-5 text-green-700' /><h2 className='text-lg font-extrabold'>Обсуждение</h2></div><TerminalFiscalReviewConversation initialMessages={issue.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))} currentUserId={admin.id} endpoint={`/api/admin/workday/issues/${issue.id}/messages`} disabled={!open} />{issue.notifications.length > 0 && <div className='mt-4 border-t border-slate-200 pt-3'><p className='text-xs font-black uppercase tracking-wide text-slate-500'>Доставка сообщений</p>{issue.notifications.map((notification) => <p key={notification.id} className='mt-1 text-xs font-bold text-slate-700'>{deliveryLabel(notification)}</p>)}</div>}</Card>
      </div>
    </AdminShell>
  );
}
