import { redirect } from 'next/navigation';
import { MessageCircle, SearchCheck } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { terminalFiscalEmployeeReviewText } from '@/lib/terminal-fiscal-employee-review';

export const dynamic = 'force-dynamic';

export default async function AdminPaymentCheckPage({ params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const review = await prisma.terminalFiscalEmployeeReview.findUnique({
    where: { id: params.id },
    include: {
      employee: { select: { name: true } },
      messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } },
    },
  });
  if (!review) redirect('/admin/workday');
  const open = review.status === 'open';
  return (
    <AdminShell>
      <AdminBreadcrumbs current='Проверка продажи' />
      <div className='grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]'>
        <Card className='border-amber-200 bg-amber-50'>
          <div className='flex gap-3'><SearchCheck className='mt-0.5 h-6 w-6 shrink-0 text-amber-700' /><div><p className='text-xs font-extrabold uppercase tracking-wide text-amber-700'>{open ? 'Требуется проверка' : review.status === 'admin_review' ? 'Только для ADMIN' : 'Закрыто автоматически'}</p><h1 className='mt-1 text-2xl font-black text-amber-950'>Проверка продажи</h1><p className='mt-3 text-base font-bold leading-relaxed text-amber-950'>{terminalFiscalEmployeeReviewText({ operationAt: review.bankOperationAt, amountKopecks: review.amountKopecks })}</p></div></div>
          <dl className='mt-5 grid gap-3 border-t border-amber-200 pt-4 text-sm sm:grid-cols-2'><div><dt className='font-semibold text-amber-700'>Сотрудник</dt><dd className='mt-1 font-extrabold text-amber-950'>{review.employee.name}</dd></div><div><dt className='font-semibold text-amber-700'>Основание адресации</dt><dd className='mt-1 font-extrabold text-amber-950'>Единственный кассир рядом по этой ККМ</dd></div></dl>
          <p className='mt-4 text-xs font-semibold leading-relaxed text-amber-800'>Это нейтральная проверка, а не ошибка сотрудника. Рабочее место и оператор ОФД для определения сотрудника не используются.</p>
        </Card>
        <Card>
          <div className='mb-4 flex items-center gap-2'><MessageCircle className='h-5 w-5 text-green-700' /><h2 className='text-lg font-extrabold'>Обсуждение</h2></div>
          <TerminalFiscalReviewConversation
            initialMessages={review.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))}
            currentUserId={admin.id}
            endpoint={`/api/admin/terminal-fiscal/reviews/${review.id}/messages`}
            disabled={!open}
          />
        </Card>
      </div>
    </AdminShell>
  );
}
