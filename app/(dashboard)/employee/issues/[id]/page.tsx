import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowLeft, MessageCircle } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { TerminalFiscalReviewConversation } from '@/components/TerminalFiscalReviewConversation';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { workdayIssueView } from '@/lib/workday-control-issue-view';

export const dynamic = 'force-dynamic';

export default async function EmployeeWorkdayIssuePage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'EMPLOYEE') redirect('/admin');
  const issueId = Number(params.id);
  const issue = Number.isInteger(issueId) ? await prisma.workdayControlIssue.findFirst({
    where: { id: issueId, userId: user.id },
    include: { messages: { orderBy: { createdAt: 'asc' }, include: { author: { select: { id: true, name: true, role: true } } } } },
  }) : null;
  if (!issue) redirect('/employee');
  const open = issue.status === 'open' && issue.employeeActionRequired;
  const view = workdayIssueView(issue);
  return (
    <main className='min-h-screen bg-[#111821] text-slate-950 md:px-6 md:py-6'>
      <div className='mx-auto min-h-screen w-full max-w-[520px] bg-[#f7faf8] shadow-2xl md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[24px]'>
        <header className='flex items-center justify-between bg-[#111821] px-4 py-4 text-white'><BrandBlock size='header' /><LogoutButton iconOnly title='Выйти' className='h-10 w-10 bg-white/[0.08] px-0 text-white ring-1 ring-white/10' /></header>
        <div className='px-4 py-5'>
          <Link href='/employee' className='inline-flex items-center gap-2 text-sm font-extrabold text-green-700'><ArrowLeft className='h-4 w-4' />Вернуться к рабочему дню</Link>
          <Card className={`mt-4 ${open ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
            <div className='flex gap-3'><AlertTriangle className={`mt-0.5 h-6 w-6 shrink-0 ${open ? 'text-amber-700' : 'text-green-700'}`} /><div><p className={`text-xs font-extrabold uppercase tracking-wide ${open ? 'text-amber-700' : 'text-green-700'}`}>{open ? 'Нужно исправить' : 'Исправлено'}</p><h1 className='mt-1 text-xl font-black leading-snug text-slate-950'>Чек по кредитной продаже</h1><p className='mt-2 text-sm font-extrabold text-slate-700'>{[view.documentNumber && `Реализация ${view.documentNumber}`, view.amount].filter(Boolean).join(' · ')}</p><p className='mt-3 text-base font-bold leading-relaxed text-slate-800'>{open ? view.instruction : 'Портал подтвердил исправление. История сохранена.'}</p></div></div>
          </Card>
          <Card className='mt-4'>
            <div className='mb-4 flex items-center gap-2'><MessageCircle className='h-5 w-5 text-green-700' /><h2 className='text-lg font-extrabold'>Сообщения администратору</h2></div>
            <TerminalFiscalReviewConversation initialMessages={issue.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))} currentUserId={user.id} endpoint={`/api/employee/workday-issues/${issue.id}/messages`} disabled={!open} />
          </Card>
        </div>
      </div>
    </main>
  );
}
