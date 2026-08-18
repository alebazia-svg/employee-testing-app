import { redirect } from 'next/navigation';
import { AlertTriangle, MessageCircle } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';

export const dynamic = 'force-dynamic';

export default async function AdminWorkdayIssuePage({ params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const issueId = Number(params.id);
  const issue = Number.isInteger(issueId) ? await prisma.workdayControlIssue.findUnique({
    where: { id: issueId },
    include: { user: { select: { name: true } }, messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } } },
  }) : null;
  if (!issue) redirect('/admin/workday');
  const open = issue.status === 'open' && issue.employeeActionRequired;
  const view = workdayIssueView(issue);
  return (
    <AdminShell>
      <AdminBreadcrumbs current='Обязательная ошибка' />
      <div className='grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)]'>
        <Card className={open ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
          <div className='flex gap-3'><AlertTriangle className={`mt-0.5 h-6 w-6 shrink-0 ${open ? 'text-amber-700' : 'text-green-700'}`} /><div><p className={`text-xs font-extrabold uppercase tracking-wide ${open ? 'text-amber-700' : 'text-green-700'}`}>{open ? 'Действие сотрудника требуется' : 'Активное действие закрыто'}</p><h1 className='mt-1 text-2xl font-black text-slate-950'>Чек по кредитной продаже</h1><p className='mt-3 text-base font-bold leading-relaxed text-slate-800'>{view.instruction}</p></div></div>
          <dl className='mt-5 grid gap-3 border-t border-amber-200 pt-4 text-sm sm:grid-cols-2'><div><dt className='font-semibold text-slate-500'>Сотрудник</dt><dd className='mt-1 font-extrabold text-slate-950'>{issue.user.name}</dd></div><div><dt className='font-semibold text-slate-500'>Реализация</dt><dd className='mt-1 font-extrabold text-slate-950'>{[view.documentNumber, view.amount].filter(Boolean).join(' · ')}</dd></div>{view.receiptDelayMinutes !== null && <div><dt className='font-semibold text-slate-500'>Чек пробит позже</dt><dd className='mt-1 font-extrabold text-slate-950'>на {view.receiptDelayMinutes} мин.</dd></div>}{view.receiptCashierName && <div><dt className='font-semibold text-slate-500'>Кассир чека 1С</dt><dd className='mt-1 font-extrabold text-slate-950'>{view.receiptCashierName}</dd></div>}</dl>
          {!open && view.receiptDelayMinutes !== null && view.receiptDelayMinutes > 15 && <p className='mt-4 rounded-xl bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700'>Правильный чек появился, поэтому действие сотрудника закрыто. Опоздание сохранено в audit.</p>}
        </Card>
        <Card><div className='mb-4 flex items-center gap-2'><MessageCircle className='h-5 w-5 text-green-700' /><h2 className='text-lg font-extrabold'>Обсуждение</h2></div><TerminalFiscalReviewConversation initialMessages={issue.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))} currentUserId={admin.id} endpoint={`/api/admin/workday/issues/${issue.id}/messages`} disabled={!open} /></Card>
      </div>
    </AdminShell>
  );
}
