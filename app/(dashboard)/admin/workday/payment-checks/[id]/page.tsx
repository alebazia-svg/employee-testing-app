import { redirect } from 'next/navigation';
import { MessageCircle, SearchCheck } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { terminalFiscalAdminReviewView } from '@/lib/terminal-fiscal-employee-review-view';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentCheckPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const review = await prisma.terminalFiscalEmployeeReview.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { name: true } },
      participants: { include: { user: { select: { name: true } } }, orderBy: { user: { name: 'asc' } } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } },
    },
  });
  if (!review) redirect('/admin/workday');
  const open = review.status === 'open';
  const match = await prisma.terminalFiscalMatch.findUnique({
    where: { matchingId: review.matchingHash },
    select: { status: true, reasonCode: true, bankOperationRawType: true, oneCSourceRef: true, timeDifferenceSeconds: true },
  });
  const view = terminalFiscalAdminReviewView({
    status: review.status,
    bankOperationAt: review.bankOperationAt,
    amountKopecks: review.amountKopecks,
    match,
  });
  const resolved = view.tone === 'resolved';
  return (
    <AdminShell>
      <AdminBreadcrumbs current='Проверка продажи' />
      <div className='grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]'>
        <Card className={resolved ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}>
          <div className='flex gap-3'><SearchCheck className={`mt-0.5 h-6 w-6 shrink-0 ${resolved ? 'text-green-700' : 'text-amber-700'}`} /><div><p className={`text-xs font-extrabold uppercase tracking-wide ${resolved ? 'text-green-700' : 'text-amber-700'}`}>{view.statusLabel}</p><h1 className={`mt-1 text-2xl font-black ${resolved ? 'text-green-950' : 'text-amber-950'}`}>{view.title}</h1><p className={`mt-2 text-sm font-extrabold ${resolved ? 'text-green-800' : 'text-amber-800'}`}>{view.operationMeta}</p><p className={`mt-3 text-base font-bold leading-relaxed ${resolved ? 'text-green-950' : 'text-amber-950'}`}>{view.message}</p></div></div>
          <dl className={`mt-5 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2 ${resolved ? 'border-green-200' : 'border-amber-200'}`}><div><dt className={`font-semibold ${resolved ? 'text-green-700' : 'text-amber-700'}`}>{review.assignmentScope === 'retail_shift' ? 'Ответственные за смену' : 'Сотрудник'}</dt><dd className={`mt-1 font-extrabold ${resolved ? 'text-green-950' : 'text-amber-950'}`}>{review.assignmentScope === 'retail_shift' ? review.participants.map((item) => item.user.name).join(', ') : review.employee.name}</dd></div><div><dt className={`font-semibold ${resolved ? 'text-green-700' : 'text-amber-700'}`}>Основание адресации</dt><dd className={`mt-1 font-extrabold ${resolved ? 'text-green-950' : 'text-amber-950'}`}>{review.assignmentScope === 'retail_shift' ? 'Работали в Рознице в момент оплаты' : 'Кассир по данным 1С'}</dd></div></dl>
          {!resolved && <p className='mt-4 text-xs font-semibold leading-relaxed text-amber-800'>{review.assignmentScope === 'retail_shift' ? 'Это общая задача смене, а не персональное обвинение. Она закроется у всех после появления чека в 1С.' : 'Это нейтральная проверка, а не подтверждённая ошибка сотрудника.'}</p>}
          {match?.reasonCode === 'BANK_OPERATION_UNSUPPORTED' && match.bankOperationRawType ? <p className='mt-3 text-xs font-semibold text-slate-600'>Исходный тип операции Т-Банка: {match.bankOperationRawType}</p> : null}
        </Card>
        <Card>
          <div className='mb-4 flex items-center gap-2'><MessageCircle className='h-5 w-5 text-green-700' /><h2 className='text-lg font-extrabold'>Обсуждение</h2></div>
          <TerminalFiscalReviewConversation
            initialMessages={review.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))}
            currentUserId={admin.id}
            endpoint={`/api/admin/terminal-fiscal/reviews/${review.id}/messages`}
            disabled={!open}
            disabledMessage={view.discussionMessage}
            disabledTone={view.tone === 'admin' ? 'admin' : 'resolved'}
          />
        </Card>
      </div>
    </AdminShell>
  );
}
