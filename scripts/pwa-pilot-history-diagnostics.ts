import { prisma } from '@/lib/prisma';
import { getMoscowDateKey } from '@/lib/workday';

function dateDaysAgo(days: number) {
  const value = new Date(Date.now() - days * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
}

function moscowTime(value: Date | null) {
  return value?.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) ?? null;
}

async function main() {
  const from = dateDaysAgo(14);
  const today = getMoscowDateKey();
  const [workdays, schedules, issues, activePush] = await Promise.all([
    prisma.workDayEntry.findMany({
      where: { date: { gte: from, lte: today } },
      include: {
        user: { select: { id: true, name: true, role: true, department: true, isActive: true } },
        shiftControlRun: { include: { tasks: { select: { status: true, required: true } } } },
        cashOperations: { select: { status: true } },
      },
      orderBy: [{ date: 'asc' }, { user: { name: 'asc' } }],
    }),
    prisma.workScheduleEntry.findMany({
      where: { date: { gte: from, lte: today } },
      select: { userId: true, date: true, status: true },
    }),
    prisma.workdayControlIssue.findMany({
      where: { originDate: { gte: from, lte: today } },
      select: { userId: true, originDate: true, status: true, employeeActionRequired: true, ruleKey: true },
    }),
    prisma.workdayPushSubscription.groupBy({
      by: ['userId'], where: { disabledAt: null }, _count: { _all: true },
    }),
  ]);
  const schedule = new Map(schedules.map((row) => [`${row.userId}:${row.date}`, row.status]));
  const push = new Map(activePush.map((row) => [row.userId, row._count._all]));
  const rows = workdays.map((day) => {
    const tasks = day.shiftControlRun?.tasks ?? [];
    const dayIssues = issues.filter((issue) => issue.userId === day.userId && issue.originDate === day.date);
    return {
      workdayId: day.id,
      employee: day.user.name,
      account: { role: day.user.role, department: day.user.department, active: day.user.isActive },
      date: day.date,
      schedule: schedule.get(`${day.userId}:${day.date}`) ?? 'missing',
      shift: day.shiftCode,
      startedAtMoscow: moscowTime(day.startedAt),
      endedAtMoscow: moscowTime(day.endedAt),
      lateMinutes: day.lateMinutes,
      status: day.status,
      shiftControl: day.shiftControlRun ? {
        status: day.shiftControlRun.status,
        required: tasks.filter((task) => task.required).length,
        done: tasks.filter((task) => task.status === 'done').length,
        missed: tasks.filter((task) => task.status === 'missed').length,
        pending: tasks.filter((task) => task.status === 'pending').length,
      } : null,
      cashOperations: {
        total: day.cashOperations.length,
        unresolved: day.cashOperations.filter((item) => !['posted_1c_pair', 'resolved_manual'].includes(item.status)).length,
      },
      issues: {
        total: dayIssues.length,
        open: dayIssues.filter((item) => item.status === 'open').length,
        employeeAction: dayIssues.filter((item) => item.status === 'open' && item.employeeActionRequired).length,
        ruleKeys: [...new Set(dayIssues.map((item) => item.ruleKey))],
      },
      activePushSubscriptions: push.get(day.userId) ?? 0,
    };
  });
  const scheduledWithoutWorkday = schedules
    .filter((entry) => entry.status === 'working' && !workdays.some((day) => day.userId === entry.userId && day.date === entry.date))
    .map((entry) => ({ userId: entry.userId, date: entry.date }));
  console.log(JSON.stringify({ mode: 'read_only', range: { from, to: today }, workdays: rows, scheduledWithoutWorkdayCount: scheduledWithoutWorkday.length }, null, 2));
}

main().finally(() => prisma.$disconnect());
