import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { EmployeePaymentCheckActionCard } from '@/components/EmployeePaymentCheckActionCard';
import { LogoutButton } from '@/components/LogoutButton';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function EmployeePaymentCheckPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE') redirect('/admin');
  const review = await prisma.terminalFiscalEmployeeReview.findFirst({
    where: { id: params.id, OR: [{ employeeId: user.id }, { participants: { some: { userId: user.id } } }] },
    include: { participants: true, messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { role: true } } } } },
  });
  if (!review) redirect('/employee');
  const open = review.status === 'open';
  const latestAdminMessage = [...review.messages].reverse().find((message) => message.author.role === 'ADMIN')?.body ?? null;
  return <main className='employee-material-ui min-h-screen bg-[#151a1d] text-slate-950 md:px-6 md:py-6'>
    <div className='employee-material-shell relative mx-auto min-h-screen w-full max-w-[520px] shadow-2xl md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[28px]'>
      <header className='employee-material-header flex items-center justify-between px-4 py-4'><BrandBlock size='employee' /><LogoutButton iconOnly title='Выйти' className='employee-material-header-action h-10 w-10 px-0 text-white' /></header>
      <div className='px-4 py-5'><Link href='/employee' className='inline-flex items-center gap-2 text-sm font-extrabold text-green-700'><ArrowLeft className='h-4 w-4' />Назад</Link>
        <div className='mt-4'>{open ? <EmployeePaymentCheckActionCard reviewId={review.id} amountKopecks={review.amountKopecks} bankOperationAt={review.bankOperationAt.toISOString()} initialResponse={review.participants.find((item) => item.userId === user.id)?.response ?? 'pending'} latestAdminMessage={latestAdminMessage} /> : <Card className='rounded-[24px] border-green-200 bg-green-50'><div className='flex gap-3'><span className='employee-material-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-green-700'><CheckCircle2 className='h-6 w-6' /></span><div><p className='text-xs font-extrabold uppercase tracking-wide text-green-700'>Исправлено</p><h1 className='mt-1 text-xl font-black leading-snug'>Чек найден в 1С</h1><p className='mt-2 text-sm font-bold text-slate-700'>Проверка закрыта автоматически.</p></div></div></Card>}</div>
      </div>
    </div>
  </main>;
}
