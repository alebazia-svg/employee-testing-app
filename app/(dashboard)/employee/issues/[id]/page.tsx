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
import { formatDateLabel, getMoscowDateKey } from '@/lib/workday';

export const dynamic = 'force-dynamic';

export default async function EmployeeWorkdayIssuePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
  const isKkmCloseIssue = issue.ruleKey === 'kkm_shift_not_closed';
  const showConversation = !isKkmCloseIssue || issue.messages.length > 0;
  const today = getMoscowDateKey();
  const originLabel = issue.originDate === today ? 'сегодня' : formatDateLabel(issue.originDate);
  return (
    <main className='employee-material-ui min-h-screen bg-[#151a1d] text-slate-950 md:px-6 md:py-6'>
      <div className='employee-material-shell relative mx-auto min-h-screen w-full max-w-[520px] shadow-2xl md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[28px]'>
        <header className='employee-material-header flex items-center justify-between px-4 py-4'><BrandBlock size='employee' /><LogoutButton iconOnly title='Выйти' className='employee-material-header-action h-10 w-10 px-0 text-white' /></header>
        <div className='px-4 py-5'>
          <Link href='/employee' className='inline-flex items-center gap-2 text-sm font-extrabold text-green-700'><ArrowLeft className='h-4 w-4' />Вернуться к рабочему дню</Link>
          <Card className={`mt-4 ${open ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}>
            <div className='flex gap-3'><span className={`employee-material-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${open ? 'text-amber-700' : 'text-green-700'}`}><AlertTriangle className='h-6 w-6' /></span><div><p className={`text-xs font-extrabold uppercase tracking-wide ${open ? 'text-amber-700' : 'text-green-700'}`}>{open ? 'Нужно исправить' : 'Исправлено'}</p><h1 className='mt-1 text-xl font-black leading-snug text-slate-950'>{view.summaryTitle}</h1>{view.summaryMeta && <p className='mt-2 text-sm font-extrabold text-slate-700'>{view.summaryMeta}</p>}<p className='mt-3 text-base font-bold leading-relaxed text-slate-800'>{open ? view.instruction : 'Портал подтвердил исправление. История сохранена.'}</p>{open && <p className='mt-3 border-t border-amber-200 pt-3 text-xs font-semibold leading-relaxed text-slate-500'>Проблема возникла {originLabel}. {isKkmCloseIssue ? 'Портал продолжит проверять закрытие автоматически.' : 'После исправления в 1С она исчезнет автоматически.'}</p>}</div></div>
          </Card>
          {isKkmCloseIssue && open && !showConversation && (
            <Card className='employee-material-form mt-4 space-y-3'>
              <h2 className='text-lg font-extrabold'>Что делать дальше</h2>
              <p className='text-sm font-semibold leading-relaxed text-slate-600'>Вернитесь к рабочему дню: там можно сфотографировать чек или сообщить администратору.</p>
              <Link href='/employee#employee-close-exception' className='employee-material-primary-action flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-extrabold text-white'>Вернуться и сообщить</Link>
            </Card>
          )}
          {showConversation && <Card className='employee-material-form mt-4'>
            <div className='mb-4 flex items-center gap-2'><span className='employee-material-heading-icon'><MessageCircle className='h-5 w-5 text-green-700' /></span><h2 className='text-lg font-extrabold'>Сообщение администратору</h2></div>
            <TerminalFiscalReviewConversation initialMessages={issue.messages.map((message) => ({ ...message, createdAt: message.createdAt.toISOString() }))} currentUserId={user.id} endpoint={`/api/employee/workday-issues/${issue.id}/messages`} disabled={!open} />
          </Card>}
        </div>
      </div>
    </main>
  );
}
