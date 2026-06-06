import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Clock, ClipboardList, UserCheck, Users } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { departmentLabel, formatDateLabel, formatTime, getMoscowDateKey, getMoscowMinutes, scheduleStatusLabel, workDayStatusLabel } from '@/lib/workday';
import { AdminShiftControlDetails } from './AdminShiftControlDetails';
import { DevCreateTestShiftButtons } from './DevCreateTestShiftButtons';
import { DevMakeShiftTasksAvailableButton } from './DevMakeShiftTasksAvailableButton';
import { DevResetTodayButton } from './DevResetTodayButton';

export const dynamic = 'force-dynamic';

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

export default async function AdminWorkdayPage({ searchParams }: { searchParams?: { date?: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const today = getMoscowDateKey();
  const selectedDate = isDateKey(searchParams?.date) ? searchParams.date : today;
  const previousDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);
  const [employees, schedules, workDays, shiftControlRuns, unfinishedWorkDays] = await Promise.all([
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
                <th className='px-4 py-3'>Начало</th>
                <th className='px-4 py-3'>Окончание</th>
                <th className='px-4 py-3'>Опоздание</th>
                <th className='px-4 py-3'>Статус дня</th>
                <th className='px-4 py-3'>Контроль смены</th>
                <th className='px-4 py-3'>Флаги</th>
                <th className='px-4 py-3'>Комментарий</th>
                <th className='px-4 py-3'>Dev/Test</th>
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
                    <td className='px-4 py-3 text-slate-700'>{formatTime(workDay?.startedAt)}</td>
                    <td className='px-4 py-3 text-slate-700'>{formatTime(workDay?.endedAt)}</td>
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
