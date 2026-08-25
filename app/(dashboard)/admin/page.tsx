import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, Clock3, CreditCard, FileText, ShieldAlert, UserCheck } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminMetricCard } from '@/components/admin/AdminMetricCard';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Card } from '@/components/ui/card';
import { summarizeAdminToday } from '@/lib/admin-operations-view';
import { getCurrentUser } from '@/lib/auth';
import { expenseRequestCurrentWhere } from '@/lib/expense-request-admin-lifecycle';
import { prisma } from '@/lib/prisma';
import { getTerminalFiscalWorkdaySummary, presentTerminalFiscalWorkdaySummary } from '@/lib/terminal-fiscal-summary';
import { getMoscowDateKey } from '@/lib/workday';
import { cashEncashmentExceptionPrefix, isCashEncashmentException } from '@/lib/workday-cash-encashment-exception';

export const dynamic = 'force-dynamic';

type ActionItem = { key: string; title: string; detail: string; href: string; occurredAt: Date; kind: 'decision' | 'message' | 'request' };

function money(value: { toString(): string } | null) {
  return value ? `${Number(value.toString()).toLocaleString('ru-RU')} ₽` : '';
}

function time(value: Date) {
  return new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(value);
}

function moscowDayRange(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
  return { from: new Date(`${dateKey}T00:00:00+03:00`), to: new Date(`${next}T00:00:00+03:00`) };
}

export default async function AdminPage() {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');

  const today = getMoscowDateKey();
  const range = moscowDayRange(today);
  const [employees, schedules, workdays, issues, reviews, closeRequests, expenseCases, cashOperationErrors, terminalSummary] = await Promise.all([
    prisma.user.findMany({ where: { role: 'EMPLOYEE', isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.workScheduleEntry.findMany({ where: { date: today }, select: { userId: true, status: true } }),
    prisma.workDayEntry.findMany({ where: { date: today }, select: { userId: true, status: true, endedAt: true, user: { select: { name: true } } } }),
    prisma.workdayControlIssue.findMany({
      where: { status: 'open', employeeActionRequired: true },
      select: { id: true, title: true, lastDetectedAt: true, user: { select: { name: true } }, messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true, author: { select: { role: true } } } } },
      orderBy: { lastDetectedAt: 'desc' }, take: 40,
    }),
    prisma.terminalFiscalEmployeeReview.findMany({
      where: { status: { in: ['open', 'admin_review'] } },
      select: { id: true, status: true, amountKopecks: true, bankOperationAt: true, updatedAt: true, employee: { select: { name: true } }, messages: { take: 1, orderBy: { createdAt: 'desc' }, select: { createdAt: true, author: { select: { role: true } } } } },
      orderBy: { updatedAt: 'desc' }, take: 40,
    }),
    prisma.workdayCloseExceptionRequest.findMany({ where: { consumedAt: null, OR: [{ status: 'pending' }, { status: 'approved', reasonCode: { startsWith: cashEncashmentExceptionPrefix } }] }, select: { id: true, comment: true, reasonCode: true, status: true, requestedAt: true, employee: { select: { name: true } } }, orderBy: { requestedAt: 'desc' } }),
    prisma.expenseRequestAdminCase.findMany({
      where: { ...expenseRequestCurrentWhere, seenAt: null },
      select: { id: true, oneCNumber: true, requestedByName: true, amount: true, businessOperationName: true, enteredNotApprovedAt: true, updatedAt: true },
      orderBy: [{ enteredNotApprovedAt: 'desc' }, { updatedAt: 'desc' }], take: 20,
    }),
    prisma.cashOperation.findMany({
      where: { status: { in: ['one_c_error', 'manual_in_progress', 'retrying_1c'] } },
      select: { id: true, date: true, amount: true, status: true, oneCError: true, updatedAt: true, user: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),
    getTerminalFiscalWorkdaySummary({ periodFrom: range.from, periodTo: range.to }),
  ]);

  const todaySummary = summarizeAdminToday({ employees, schedules, workdays });
  const employeeById = new Map(employees.map((employee) => [employee.id, employee.name]));
  const workingNames = workdays.filter((entry) => !entry.endedAt && entry.status !== 'completed').map((entry) => entry.user.name);
  const completedNames = workdays.filter((entry) => entry.endedAt || entry.status === 'completed').map((entry) => entry.user.name);
  const scheduledIds = new Set(schedules.filter((entry) => entry.status === 'working').map((entry) => entry.userId));
  const startedIds = new Set(workdays.map((entry) => entry.userId));
  const notStartedNames = [...scheduledIds].filter((id) => !startedIds.has(id)).map((id) => employeeById.get(id)).filter(Boolean) as string[];

  const actions: ActionItem[] = [
    ...closeRequests.map((item) => ({ key: `close-${item.id}`, title: isCashEncashmentException(item.reasonCode) ? `Инкассация не выполнена · ${item.employee.name}` : `Разрешение завершить день · ${item.employee.name}`, detail: item.status === 'approved' && isCashEncashmentException(item.reasonCode) ? 'Разрешено без РКО и ПКО; требуется фактическое устранение.' : item.comment || 'Сотрудник указал техническую причину.', href: `/admin/workday/close-exceptions/${item.id}`, occurredAt: item.requestedAt, kind: 'decision' as const })),
    ...expenseCases.map((item) => ({ key: `expense-${item.id}`, title: `Новая заявка ${item.oneCNumber || ''}`.trim(), detail: [item.requestedByName, money(item.amount), item.businessOperationName].filter(Boolean).join(' · '), href: `/admin/expense-requests/${item.id}`, occurredAt: item.enteredNotApprovedAt ?? item.updatedAt, kind: 'request' as const })),
    ...cashOperationErrors.map((item) => ({ key: `cash-operation-${item.id}`, title: `Инкассация не проведена · ${item.user.name}`, detail: `${item.amount.toLocaleString('ru-RU')} ₽ · ${item.status === 'manual_in_progress' ? 'Взято в ручную' : item.status === 'retrying_1c' ? 'Повторное проведение' : item.oneCError || 'Можно повторить автоматически или взять в ручную'}`, href: `/admin/workday?date=${item.date}&employee=${item.user.id}`, occurredAt: item.updatedAt, kind: 'decision' as const })),
    ...issues.filter((item) => item.messages[0]?.author.role === 'EMPLOYEE').map((item) => ({ key: `issue-${item.id}`, title: `Сообщение от ${item.user.name}`, detail: item.title, href: `/admin/workday/issues/${item.id}`, occurredAt: item.messages[0]?.createdAt ?? item.lastDetectedAt, kind: 'message' as const })),
    ...reviews.filter((item) => item.status === 'admin_review' || item.messages[0]?.author.role === 'EMPLOYEE').map((item) => ({ key: `review-${item.id}`, title: item.status === 'admin_review' ? `Нужна проверка администратора · ${item.employee.name}` : `Сообщение от ${item.employee.name}`, detail: `Продажа ${time(item.bankOperationAt)} · ${(item.amountKopecks / 100).toLocaleString('ru-RU')} ₽`, href: `/admin/workday/payment-checks/${item.id}`, occurredAt: item.messages[0]?.createdAt ?? item.updatedAt, kind: item.status === 'admin_review' ? 'decision' as const : 'message' as const })),
  ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());

  const actionHrefs = new Set(actions.map((item) => item.href));
  const employeeProblems = [
    ...issues.map((item) => ({ key: `issue-${item.id}`, title: item.title, detail: item.user.name, href: `/admin/workday/issues/${item.id}`, occurredAt: item.lastDetectedAt })),
    ...reviews.filter((item) => item.status === 'open').map((item) => ({ key: `review-${item.id}`, title: 'Проверить продажу', detail: `${item.employee.name} · ${time(item.bankOperationAt)} · ${(item.amountKopecks / 100).toLocaleString('ru-RU')} ₽`, href: `/admin/workday/payment-checks/${item.id}`, occurredAt: item.updatedAt })),
  ].filter((item) => !actionHrefs.has(item.href)).sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());

  const terminal = presentTerminalFiscalWorkdaySummary(terminalSummary);
  const terminalAttention = terminal.status !== 'confirmed' && terminal.status !== 'not_run';

  return (
    <AdminShell>
      <AdminPageHeader eyebrow='Операционная сводка' title='Сегодня' description='Кто работает, что требует исправления и где необходимо именно ваше решение.' />

      <section className='mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <AdminMetricCard icon={UserCheck} label='Работают сейчас' value={todaySummary.working} detail={workingNames.join(', ') || 'Никто не начал день'} tone='green' />
        <AdminMetricCard icon={AlertTriangle} label='Нужно моё решение' value={actions.length} detail={actions.length ? 'Откройте карточки ниже' : 'Моих действий сейчас нет'} tone={actions.length ? 'red' : 'slate'} />
        <AdminMetricCard icon={ShieldAlert} label='Исправляют сотрудники' value={issues.length + reviews.filter((item) => item.status === 'open').length} detail={employeeProblems.length ? 'Проблемы остаются активными до исправления' : 'Активных проблем нет'} tone={employeeProblems.length ? 'amber' : 'slate'} />
        <AdminMetricCard icon={Clock3} label='Запланированы, ещё не начали' value={todaySummary.notStarted} detail={notStartedNames.join(', ') || 'Все запланированные сотрудники уже начали'} tone='slate' />
      </section>

      <section className='mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]'>
        <Card className='admin-material-surface overflow-hidden p-0'>
          <SectionHeader title='Нужно моё решение' count={actions.length} />
          {actions.length ? <div className='divide-y divide-slate-100'>{actions.slice(0, 6).map((item) => <ActionRow key={item.key} item={item} />)}</div> : <Empty title='Моих действий сейчас нет' text='Новые сообщения, запросы на решение и заявки появятся здесь.' compact />}
        </Card>
        <Card className='admin-material-surface overflow-hidden p-0'>
          <SectionHeader title='Сотрудникам нужно исправить' count={issues.length + reviews.filter((item) => item.status === 'open').length} href='/admin/workday' />
          {employeeProblems.length ? <div className='divide-y divide-slate-100'>{employeeProblems.slice(0, 5).map((item) => <Link key={item.key} href={item.href} className='flex items-center gap-3 px-5 py-4 hover:bg-slate-50'><ShieldAlert className='h-5 w-5 shrink-0 text-amber-600' /><span className='min-w-0 flex-1'><span className='block truncate text-sm font-extrabold text-slate-950'>{item.title}</span><span className='block truncate text-xs font-medium text-slate-500'>{item.detail}</span></span><ArrowRight className='h-4 w-4 text-slate-400' /></Link>)}</div> : <Empty title='Активных исправлений нет' text='Прочтение уведомления не влияет на этот список: проблема исчезнет только после исправления.' />}
        </Card>
      </section>

      <section className='mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]'>
        <Card className={`admin-material-surface overflow-hidden p-0 ${terminalAttention ? '' : 'xl:col-span-2'}`}>
          <SectionHeader title='Команда сегодня' count={todaySummary.working + todaySummary.completed + todaySummary.notStarted} href='/admin/workday' actionLabel='Контроль дня' />
          <div className='grid gap-0 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0'>
            <TeamState label='Работают' names={workingNames} empty='Никто не работает' tone='green' />
            <TeamState label='Ещё не начали' names={notStartedNames} empty='Все запланированные сотрудники уже начали' tone='slate' />
            <TeamState label='Завершили' names={completedNames} empty='Пока никто' tone='slate' />
          </div>
        </Card>
        {terminalAttention && (
        <Link href='/admin/workday' className={`flex items-start gap-4 rounded-2xl p-5 shadow-sm ring-1 transition hover:-translate-y-0.5 ${terminalAttention ? 'bg-amber-50 ring-amber-200' : 'bg-white ring-slate-200'}`}>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${terminalAttention ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}><CreditCard className='h-5 w-5' /></div>
          <div className='min-w-0 flex-1'><p className='text-xs font-extrabold uppercase tracking-wide text-slate-500'>Состояние сверки оплат</p><p className='mt-1 font-extrabold text-slate-950'>{terminal.label}</p><p className='mt-1 text-sm font-medium leading-relaxed text-slate-600'>{terminal.detail}</p></div>
          <ArrowRight className='mt-3 h-4 w-4 shrink-0 text-slate-400' />
        </Link>
        )}
      </section>
    </AdminShell>
  );
}

function SectionHeader({ title, count, href, actionLabel = 'Открыть всё' }: { title: string; count: number; href?: string; actionLabel?: string }) {
  return <div className='flex items-center justify-between border-b border-slate-200 px-5 py-4'><div className='flex items-center gap-2'><h2 className='text-lg font-extrabold text-slate-950'>{title}</h2>{count > 0 && <span className='rounded-full bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800'>{count}</span>}</div>{href && <Link href={href} className='text-xs font-bold text-green-700 hover:text-green-800'>{actionLabel}</Link>}</div>;
}

function ActionRow({ item }: { item: ActionItem }) {
  const Icon = item.kind === 'request' ? FileText : item.kind === 'decision' ? AlertTriangle : Bell;
  return <Link href={item.href} className='flex items-start gap-3 px-5 py-4 hover:bg-slate-50'><div className='mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700'><Icon className='h-4 w-4' /></div><span className='min-w-0 flex-1'><span className='block text-sm font-extrabold text-slate-950'>{item.title}</span><span className='mt-0.5 block text-xs font-medium leading-relaxed text-slate-600'>{item.detail}</span><span className='mt-1 block text-[11px] font-semibold text-slate-400'>{time(item.occurredAt)}</span></span><ArrowRight className='mt-2 h-4 w-4 shrink-0 text-slate-400' /></Link>;
}

function Empty({ title, text, compact = false }: { title: string; text: string; compact?: boolean }) {
  if (compact) {
    return <div className='flex items-start gap-3 px-5 py-4'><CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-green-500' /><div><p className='text-sm font-extrabold text-slate-950'>{title}</p><p className='mt-0.5 text-xs font-medium leading-relaxed text-slate-500'>{text}</p></div></div>;
  }
  return <div className='px-6 py-10 text-center'><CheckCircle2 className='mx-auto h-9 w-9 text-green-500' /><p className='mt-3 font-extrabold text-slate-950'>{title}</p><p className='mx-auto mt-1 max-w-md text-sm font-medium text-slate-500'>{text}</p></div>;
}

function TeamState({ label, names, empty, tone }: { label: string; names: string[]; empty: string; tone: 'green' | 'amber' | 'slate' }) {
  const color = tone === 'green' ? 'text-green-700' : tone === 'amber' ? 'text-amber-700' : 'text-slate-500';
  return <div className='px-5 py-4'><p className={`text-xs font-extrabold uppercase tracking-wide ${color}`}>{label} · {names.length}</p><p className='mt-2 text-sm font-semibold leading-relaxed text-slate-700'>{names.join(', ') || empty}</p></div>;
}
