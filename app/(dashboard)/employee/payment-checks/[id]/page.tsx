import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, MessageCircle, SearchCheck } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { terminalFiscalEmployeeReviewText } from '@/lib/terminal-fiscal-employee-review';

export const dynamic = 'force-dynamic';

export default async function EmployeePaymentCheckPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE') redirect('/admin');
  const review = await prisma.terminalFiscalEmployeeReview.findFirst({
    where: { id: params.id, employeeId: user.id },
    include: { messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } } },
  });
  if (!review) redirect('/employee');
  const open = review.status === 'open';
  return (
    <main className='employee-material-ui min-h-screen bg-[#151a1d] text-slate-950 md:px-6 md:py-6'>
      <div className='employee-material-shell relative mx-auto min-h-screen w-full max-w-[520px] shadow-2xl md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[28px]'>
        <header className='employee-material-header flex items-center justify-between px-4 py-4'>
          <BrandBlock size='employee' />
          <LogoutButton iconOnly title='Выйти' className='employee-material-header-action h-10 w-10 px-0 text-white' />
        </header>
        <div className='px-4 py-5'>
          <Link href='/employee' className='inline-flex items-center gap-2 text-sm font-extrabold text-green-700'><ArrowLeft className='h-4 w-4' />Назад</Link>
          <Card className='mt-4 border-amber-200 bg-amber-50'>
            <div className='flex gap-3'><SearchCheck className='mt-0.5 h-6 w-6 shrink-0 text-amber-700' /><div><p className='text-xs font-extrabold uppercase tracking-wide text-amber-700'>{open ? 'Требуется проверка' : 'Проверка закрыта'}</p><h1 className='mt-1 text-xl font-black leading-snug text-amber-950'>Проверьте продажу</h1><p className='mt-2 text-base font-bold leading-relaxed text-amber-950'>{terminalFiscalEmployeeReviewText({ operationAt: review.bankOperationAt, amountKopecks: review.amountKopecks })}</p></div></div>
          </Card>
          <Card className='employee-material-form mt-4'>
            <div className='mb-4 flex items-center gap-2'><MessageCircle className='h-5 w-5 text-green-700' /><h2 className='text-lg font-extrabold'>Сообщение администратору</h2></div>
            <TerminalFiscalReviewConversation
              initialMessages={review.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))}
              currentUserId={user.id}
              endpoint={`/api/employee/payment-checks/${review.id}/messages`}
              disabled={!open}
            />
          </Card>
        </div>
      </div>
    </main>
  );
}
