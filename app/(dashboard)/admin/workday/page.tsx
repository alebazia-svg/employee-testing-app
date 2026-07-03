import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Banknote, CheckCircle2, Clock, ClipboardList, UserCheck, Users } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { getCurrentUser } from '@/lib/auth';
import { getCashStatementDimensions, getCashStatementSummary, type OneCCashStatementSummaryResult } from '@/lib/one-c';
import { prisma } from '@/lib/prisma';
import { departmentLabel, formatDateLabel, formatTime, getMoscowDateKey, getMoscowMinutes, scheduleStatusLabel, workDayStatusLabel } from '@/lib/workday';
import { AdminShiftControlDetails } from './AdminShiftControlDetails';
import { DevCreateTestShiftButtons } from './DevCreateTestShiftButtons';
import { DevMakeShiftTasksAvailableButton } from './DevMakeShiftTasksAvailableButton';
import { DevResetTodayButton } from './DevResetTodayButton';
import { WorkdayQrCodes } from './WorkdayQrCodes';

export const dynamic = 'force-dynamic';

const devWorkdayToolsEnabled = process.env.ENABLE_DEV_WORKDAY_TOOLS === 'true';

function statusClass(status: string) {
  if (status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'active') return 'bg-blue-100 text-blue-800';
  if (status === 'missing_checkout') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-700';
}

function scheduleClass(status: string | undefined) {
  if (status === 'working') return 'bg-green-100 text-green-800';
  if (status === 'off') return 'bg-slate-100 text-slate-700';
  return 'bg-amber-100 text-amber-800';
}

function StatCard({
  title,
  value,
  tone,
  icon: Icon,
}: {
  title: string;
  value: number;
  tone: 'green' | 'blue' | 'amber' | 'slate';
  icon: typeof Users;
}) {
  const colors = {
    green: 'text-green-700 bg-green-50',
    blue: 'text-blue-700 bg-blue-50',
    amber: 'text-amber-700 bg-amber-50',
    slate: 'text-slate-700 bg-slate-50',
  };
  return (
    <Card className='p-4'>
      <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${colors[tone]}`}>
        <Icon className='h-5 w-5' />
      </div>
      <p className='text-2xl font-extrabold text-slate-950'>{value}</p>
      <p className='text-sm font-semibold text-slate-500'>{title}</p>
    </Card>
  );
}

function serializeShiftControlRun(run: any) {
  if (!run) return null;
  return {
    id: run.id,
    status: run.status,
    submittedAt: run.submittedAt?.toISOString() ?? null,
    completedAt: run.completedAt?.toISOString() ?? null,
    tasks: (run.tasks ?? []).map((task: any) => ({
      id: task.id,
      title: task.title,
      category: task.category,
      plannedTimeMinutes: task.plannedTimeMinutes,
      status: task.status,
      completedAt: task.completedAt?.toISOString() ?? null,
      numericValue: task.numericValue,
      integerValue: task.integerValue,
      booleanValue: task.booleanValue,
      textValue: task.textValue,
      comment: task.comment,
      handoverData: task.handoverData,
    })),
  };
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function addDays(dateKey: string, offset: number) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + offset));
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^а-яa-z0-9]+/g, ' ')
    .trim();
}

function employeeCashboxSearchKey(employeeName: string) {
  const normalized = normalizeSearchText(employeeName);
  if (
    normalized.includes('магомед')
    || normalized.includes('стажер')
    || normalized.includes('костеренко')
    || normalized.includes('костаренко')
    || normalized.includes('косторенко')
  ) {
    return 'костеренко';
  }

  return normalized.split(/\s+/).find(Boolean) ?? '';
}

function hasStaleCloseViolation(workDay: { comment: string } | null | undefined, shiftControlRun: { closingComment?: string | null } | null | undefined) {
  const text = `${workDay?.comment ?? ''}\n${shiftControlRun?.closingComment ?? ''}`.toLowerCase();
  return text.includes('закрыт без сдачи смены') || text.includes('закрыт позже без сдачи смены');
}

function cashStatementStatus(result: OneCCashStatementSummaryResult | null) {
  if (!result) return { label: 'не проверено', className: 'bg-slate-100 text-slate-700' };
  if (!result.ok) return { label: 'ошибка 1С', className: 'bg-rose-100 text-rose-800' };
  return { label: 'получено', className: 'bg-green-100 text-green-800' };
}

export default async function AdminWorkdayPage({ searchParams }: { searchParams?: { date?: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const today = getMoscowDateKey();
  const selectedDate = isDateKey(searchParams?.date) ? searchParams.date : today;
  const previousDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);
  const [employees, schedules, workDays, shiftControlRuns, unfinishedWorkDays, cashStatementDimensions] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, department: true },
    }),
    prisma.workScheduleEntry.findMany({ where: { date: selectedDate } }),
    prisma.workDayEntry.findMany({ where: { date: selectedDate } }),
    prisma.shiftControlRun.findMany({
      where: { date: selectedDate },
      include: { tasks: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] } },
    }),
    prisma.workDayEntry.findMany({
      where: { status: { in: ['active', 'missing_checkout'] }, endedAt: null, date: { lt: selectedDate } },
      include: { user: { select: { name: true, department: true } } },
      orderBy: { startedAt: 'desc' },
    }),
    getCashStatementDimensions(),
  ]);

  const scheduleByUser = new Map(schedules.map((entry) => [entry.userId, entry]));
  const workDayByUser = new Map(workDays.map((entry) => [entry.userId, entry]));
  const shiftControlRunByUser = new Map(shiftControlRuns.map((run) => [run.userId, run]));
  const nowMinutes = selectedDate === today ? getMoscowMinutes() : selectedDate < today ? 24 * 60 : 0;
  const scheduledWorking = employees.filter((employee) => scheduleByUser.get(employee.id)?.status === 'working').length;
  const scheduledOff = employees.filter((employee) => scheduleByUser.get(employee.id)?.status === 'off').length;
  const scheduleMissing = employees.length - scheduledWorking - scheduledOff;
  const activeCount = workDays.filter((entry) => entry.status === 'active').length;
  const completedCount = workDays.filter((entry) => entry.status === 'completed').length;
  const startedCount = workDays.length;
  const lateCount = workDays.filter((entry) => entry.lateMinutes > 0).length;
  const missingCheckoutSelectedDate = workDays.filter((entry) => entry.status === 'active' && !entry.endedAt).length;
  const missingCheckoutCount = unfinishedWorkDays.length + missingCheckoutSelectedDate;
  const cashStatementOrganization =
    cashStatementDimensions.organizations.find((organization) => normalizeSearchText(organization.name).includes('оффоника'))
    ?? cashStatementDimensions.organizations[0]
    ?? null;
  const cashStatementScheduledEmployees = employees.filter((employee) => {
    if (employee.department !== 'retail' && employee.department !== 'wholesale') return false;
    const schedule = scheduleByUser.get(employee.id);
    const workDay = workDayByUser.get(employee.id);
    return schedule?.status === 'working' || Boolean(workDay);
  });
  const cashStatementFallbackEmployees = employees.filter((employee) => employee.department === 'retail' || employee.department === 'wholesale');
  const cashStatementUsesFallbackEmployees = cashStatementScheduledEmployees.length === 0 && cashStatementFallbackEmployees.length > 0;
  const cashStatementEmployees = cashStatementUsesFallbackEmployees ? cashStatementFallbackEmployees : cashStatementScheduledEmployees;
  const cashStatementRows = await Promise.all(cashStatementEmployees.map(async (employee) => {
    const searchKey = employeeCashboxSearchKey(employee.name);
    const cashbox = searchKey
      ? cashStatementDimensions.cashboxes.find((item) => normalizeSearchText(item.name).includes(searchKey)) ?? null
      : null;

    if (!cashStatementDimensions.ok || !cashStatementOrganization || !cashbox) {
      return {
        employee,
        cashbox,
        result: null,
        note: !cashStatementDimensions.ok
          ? cashStatementDimensions.error ?? cashStatementDimensions.diagnostics.join('; ') ?? '1С не вернула список касс'
          : !cashStatementOrganization
            ? 'Организация 1С не найдена'
            : 'Касса сотрудника не найдена по фамилии',
      };
    }

    const result = await getCashStatementSummary({
      date: selectedDate,
      organizationRef: cashStatementOrganization.ref,
      cashboxRef: cashbox.ref,
    });

    return {
      employee,
      cashbox,
      result,
      note: result.ok ? '' : result.error ?? result.diagnostics.join('; ') ?? 'Не удалось получить ведомость 1С',
    };
  }));
  const cashStatementLoadedCount = cashStatementRows.filter((row) => row.result?.ok).length;
  const cashStatementMissingCashboxCount = cashStatementRows.filter((row) => !row.cashbox).length;

  return (
    <AdminShell>
      <div className='space-y-6'>
        <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <p className='text-sm font-semibold text-primary'>Рабочий день</p>
            <h1 className='mt-1 text-3xl font-extrabold text-slate-950'>Контроль рабочего дня</h1>
            <p className='mt-2 text-sm font-medium text-slate-500'>
              Новый модуль отметок внутри портала. Старая посещаемость Google Sheets остаётся отдельной страницей.
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Link
              href={`/admin/workday?date=${previousDate}`}
              className='rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50'
            >
              ← предыдущий день
            </Link>
            <Badge className='w-fit bg-white px-3 py-2 text-slate-700 ring-1 ring-slate-200'>{formatDateLabel(selectedDate)}</Badge>
            <Link
              href={`/admin/workday?date=${nextDate}`}
              className='rounded-lg bg-white px-3 py-2 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50'
            >
              следующий день →
            </Link>
            <Link
              href='/admin/workday'
              className='rounded-lg bg-primary px-3 py-2 text-sm font-extrabold text-white transition hover:bg-primary/90'
            >
              Сегодня
            </Link>
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7'>
          <StatCard title='Работают по графику' value={scheduledWorking} tone='green' icon={ClipboardList} />
          <StatCard title='Выходной' value={scheduledOff} tone='slate' icon={Users} />
          <StatCard title='Не заполнили график' value={scheduleMissing} tone='amber' icon={AlertTriangle} />
          <StatCard title='Начали день' value={startedCount} tone='blue' icon={Clock} />
          <StatCard title='Завершили' value={completedCount} tone='green' icon={CheckCircle2} />
          <StatCard title='Опоздали' value={lateCount} tone='amber' icon={AlertTriangle} />
          <StatCard title='Не завершили' value={missingCheckoutCount} tone='amber' icon={UserCheck} />
        </div>

        <WorkdayQrCodes />

        <Card className='p-0'>
          <div className='flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between'>
            <div>
              <div className='flex items-center gap-2'>
                <span className='flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-green-700'>
                  <Banknote className='h-5 w-5' />
                </span>
                <div>
                  <h2 className='text-lg font-extrabold text-slate-950'>Наличные по 1С</h2>
                  <p className='mt-1 text-sm font-medium text-slate-500'>
                    Read-only сверка с ведомостью денежных средств. На чек-листы и БД не влияет.
                  </p>
                </div>
              </div>
            </div>
            <div className='flex flex-wrap gap-2 text-xs font-bold'>
              <Badge className={cashStatementDimensions.ok ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}>
                1С: {cashStatementDimensions.ok ? 'подключена' : 'ошибка'}
              </Badge>
              <Badge className='bg-slate-100 text-slate-700'>организация: {cashStatementOrganization?.name ?? 'не найдена'}</Badge>
              <Badge className='bg-slate-100 text-slate-700'>касс найдено: {cashStatementDimensions.cashboxes.length}</Badge>
              <Badge className='bg-slate-100 text-slate-700'>ведомостей получено: {cashStatementLoadedCount}/{cashStatementRows.length}</Badge>
            </div>
          </div>
          {cashStatementUsesFallbackEmployees && (
            <div className='border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900'>
              График на выбранный день не заполнен, поэтому для диагностики кассы показаны все активные сотрудники розницы и опта.
            </div>
          )}
          {cashStatementRows.length === 0 ? (
            <div className='px-5 py-4 text-sm font-semibold text-slate-500'>За выбранный день нет розничных или оптовых сотрудников для проверки кассы.</div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <thead>
                  <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                    <th className='px-4 py-3'>Сотрудник</th>
                    <th className='px-4 py-3'>Касса 1С</th>
                    <th className='px-4 py-3'>Начало</th>
                    <th className='px-4 py-3'>Приход</th>
                    <th className='px-4 py-3'>Расход</th>
                    <th className='px-4 py-3'>Конец</th>
                    <th className='px-4 py-3'>Движения</th>
                    <th className='px-4 py-3'>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {cashStatementRows.map((row) => {
                    const status = cashStatementStatus(row.result);
                    return (
                      <tr key={row.employee.id} className='border-t border-slate-100 align-top'>
                        <td className='px-4 py-3'>
                          <p className='font-bold text-slate-950'>{row.employee.name}</p>
                          <p className='text-xs font-semibold text-slate-500'>{departmentLabel(row.employee.department)}</p>
                        </td>
                        <td className='px-4 py-3 text-sm font-semibold text-slate-700'>{row.cashbox?.name ?? 'касса не найдена'}</td>
                        <td className='px-4 py-3 font-semibold text-slate-700'>{formatMoney(row.result?.openingBalance)}</td>
                        <td className='px-4 py-3 font-semibold text-green-700'>{formatMoney(row.result?.incomingTotal)}</td>
                        <td className='px-4 py-3 font-semibold text-rose-700'>{formatMoney(row.result?.outgoingTotal)}</td>
                        <td className='px-4 py-3 font-extrabold text-slate-950'>{formatMoney(row.result?.closingBalance)}</td>
                        <td className='px-4 py-3 text-sm font-semibold text-slate-700'>{row.result?.movementsCount ?? '—'}</td>
                        <td className='px-4 py-3'>
                          <div className='grid gap-1'>
                            <Badge className={status.className}>{status.label}</Badge>
                            {row.note && <span className='max-w-[260px] text-xs font-semibold text-slate-500'>{row.note}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
          {cashStatementMissingCashboxCount > 0 && (
            <div className='border-t border-amber-100 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900'>
              Для {cashStatementMissingCashboxCount} сотрудника касса не найдена автоматически по фамилии. Это диагностика: позже можно добавить явную привязку сотрудник → касса 1С.
            </div>
          )}
        </Card>

        {unfinishedWorkDays.length > 0 && (
          <Card className='border-amber-200 bg-amber-50'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
              <div>
                <p className='font-extrabold text-amber-950'>Есть незавершённые рабочие дни раньше выбранной даты</p>
                <div className='mt-2 flex flex-wrap gap-2 text-sm font-semibold text-amber-900'>
                  {unfinishedWorkDays.map((entry) => (
                    <span key={entry.id} className='rounded-full bg-white px-3 py-1 ring-1 ring-amber-200'>
                      {entry.user.name} · {entry.date} · начал {formatTime(entry.startedAt)}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className='p-0'>
          <div className='border-b border-slate-200 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Сотрудники за выбранный день</h2>
            <p className='mt-1 text-sm font-medium text-slate-500'>
              План из нового графика, факт начала/окончания дня, опоздание и комментарий к поздней отметке.
            </p>
          </div>
          <Table>
            <thead>
              <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                <th className='px-4 py-3'>Сотрудник</th>
                <th className='px-4 py-3'>Отдел</th>
                <th className='px-4 py-3'>График</th>
                <th className='px-4 py-3'>Смена</th>
                <th className='px-4 py-3'>Факт</th>
                <th className='px-4 py-3'>Опоздание</th>
                <th className='px-4 py-3'>Статус дня</th>
                <th className='px-4 py-3'>Контроль смены</th>
                <th className='px-4 py-3'>Флаги</th>
                <th className='px-4 py-3'>Комментарий</th>
                {devWorkdayToolsEnabled && <th className='px-4 py-3'>Dev/Test</th>}
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const schedule = scheduleByUser.get(employee.id);
                const workDay = workDayByUser.get(employee.id);
                const shiftControlRun = shiftControlRunByUser.get(employee.id);
                const status = workDay?.status ?? 'not_started';
                const flags = [
                  schedule?.status === 'working' && !workDay ? 'ещё не начал' : null,
                  workDay?.status === 'active' && !workDay.endedAt ? 'не завершил' : null,
                  hasStaleCloseViolation(workDay, shiftControlRun) ? 'закрыто без сдачи смены' : null,
                  workDay?.lateMinutes ? 'опоздал' : null,
                ].filter(Boolean);
                return (
                  <tr key={employee.id} className='border-t border-slate-100 align-top'>
                    <td className='px-4 py-3 font-bold text-slate-950'>{employee.name}</td>
                    <td className='px-4 py-3 text-slate-600'>{departmentLabel(employee.department)}</td>
                    <td className='px-4 py-3'>
                      <Badge className={scheduleClass(schedule?.status)}>{scheduleStatusLabel(schedule?.status)}</Badge>
                    </td>
                    <td className='px-4 py-3 text-slate-700'>{workDay?.shiftLabel ?? '—'}</td>
                    <td className='px-4 py-3 text-slate-700'>
                      <div className='grid gap-0.5 leading-tight'>
                        <span>{formatTime(workDay?.startedAt)}</span>
                        <span className='text-xs text-slate-400'>{formatTime(workDay?.endedAt)}</span>
                      </div>
                    </td>
                    <td className='px-4 py-3 font-semibold text-slate-700'>
                      {workDay?.lateMinutes ? `${workDay.lateMinutes} мин` : '—'}
                    </td>
                    <td className='px-4 py-3'>
                      <Badge className={statusClass(status)}>{workDayStatusLabel(status)}</Badge>
                    </td>
                    <td className='px-4 py-3'>
                      <AdminShiftControlDetails
                        department={employee.department}
                        run={serializeShiftControlRun(shiftControlRun)}
                        workDay={workDay ? { status: workDay.status, endedAt: workDay.endedAt?.toISOString() ?? null } : null}
                        nowMinutes={nowMinutes}
                      />
                    </td>
                    <td className='px-4 py-3'>
                      {flags.length ? (
                        <div className='flex flex-wrap gap-1.5'>
                          {flags.map((flag) => (
                            <Badge key={flag} className='bg-amber-100 text-amber-800'>{flag}</Badge>
                          ))}
                        </div>
                      ) : (
                        <span className='text-slate-400'>—</span>
                      )}
                    </td>
                    <td className='max-w-[280px] px-4 py-3 text-sm text-slate-600'>{workDay?.comment || '—'}</td>
                    {devWorkdayToolsEnabled && (
                      <td className='px-4 py-3'>
                        <div className='flex flex-col gap-2'>
                          {!workDay && (employee.department === 'retail' || employee.department === 'wholesale') && (
                            <DevCreateTestShiftButtons
                              userId={employee.id}
                              userName={employee.name}
                              department={employee.department}
                              date={selectedDate}
                            />
                          )}
                          {(employee.department === 'retail' || employee.department === 'wholesale') && shiftControlRun && (
                            <DevMakeShiftTasksAvailableButton userId={employee.id} userName={employee.name} date={selectedDate} />
                          )}
                          <DevResetTodayButton userId={employee.id} userName={employee.name} date={selectedDate} />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      </div>
    </AdminShell>
  );
}
