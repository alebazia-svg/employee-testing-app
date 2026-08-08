import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Banknote, CheckCircle2, ClipboardList, CreditCard, UserCheck, Users } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { getAdminWorkdayRevision } from '@/lib/admin-workday-revision';
import { getCurrentUser } from '@/lib/auth';
import {
  DEFAULT_SALES_REALIZATIONS_PARAMS,
  getCashStatementDimensions,
  getCashStatementSummary,
  getKkmEquipmentDiagnostics,
  getSalesRealizations,
  type OneCCashStatementSummaryResult,
  type OneCKkmEquipmentDiagnosticsResult,
  type OneCSalesRealizationDocument,
} from '@/lib/one-c';
import { prisma } from '@/lib/prisma';
import { shiftControlOneCAuditKey } from '@/lib/shift-control-one-c-audit';
import { evaluateWorkdayTiming } from '@/lib/workday-timing';
import { departmentLabel, formatDateLabel, formatTime, getMoscowDateKey, getMoscowMinutes, scheduleStatusLabel, usesWorkdayShiftControl, workDayStatusLabel } from '@/lib/workday';
import { AdminWorkdayAutoRefresh } from './AdminWorkdayAutoRefresh';
import { AdminShiftControlDetails, type ShiftAutoCheck, type ShiftAutoCheckManualReview } from './AdminShiftControlDetails';
import { DevCreateTestShiftButtons } from './DevCreateTestShiftButtons';
import { DevMakeShiftTasksAvailableButton } from './DevMakeShiftTasksAvailableButton';
import { DevResetTodayButton } from './DevResetTodayButton';
import { WorkdayQrCodes } from './WorkdayQrCodes';

export const dynamic = 'force-dynamic';

const devWorkdayToolsEnabled = process.env.ENABLE_DEV_WORKDAY_TOOLS === 'true';
const reserveCashboxSearchName = 'резерв под телефоны';
const oneCMoneyTolerance = 1;

type AutoCheckTask = {
  id: number;
  title: string;
  category: string;
  plannedTimeMinutes: number | null;
  status: string;
  completedAt: Date | null;
  numericValue: number | null;
  integerValue: number | null;
  handoverData: unknown;
};

type TbankSalesForDate = {
  ok: boolean;
  documents: OneCSalesRealizationDocument[];
  error?: string;
};

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
  caption,
  icon: Icon,
}: {
  title: string;
  value: number;
  tone: 'green' | 'blue' | 'amber' | 'rose';
  caption: string;
  icon: typeof Users;
}) {
  const colors = {
    green: {
      card: 'border-t-green-500',
      icon: 'bg-green-100 text-green-800',
      caption: 'text-green-700',
    },
    blue: {
      card: 'border-t-blue-500',
      icon: 'bg-blue-100 text-blue-800',
      caption: 'text-blue-700',
    },
    amber: {
      card: 'border-t-amber-500',
      icon: 'bg-amber-100 text-amber-800',
      caption: 'text-amber-700',
    },
    rose: {
      card: 'border-t-rose-500',
      icon: 'bg-rose-100 text-rose-800',
      caption: 'text-rose-700',
    },
  };
  const color = colors[tone];
  return (
    <Card className={`border-t-4 p-4 ${color.card}`}>
      <div className='flex items-start justify-between gap-3'>
        <div>
          <p className='text-sm font-extrabold text-slate-700'>{title}</p>
          <p className='mt-2 text-3xl font-extrabold text-slate-950'>{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${color.icon}`}>
          <Icon className='h-5 w-5' />
        </div>
      </div>
      <p className={`mt-2 text-xs font-bold ${color.caption}`}>{caption}</p>
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

type ControlFilter = 'all' | 'attention' | 'unverified' | 'normal';

function controlFilter(value: string | undefined): ControlFilter {
  if (value === 'attention' || value === 'unverified' || value === 'normal') return value;
  return 'all';
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : null;
}

function readText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function readTaskCashAudit(task: AutoCheckTask, key: 'personalCash' | 'reserveCash') {
  const handoverData = isRecord(task.handoverData) ? task.handoverData : null;
  const audit = handoverData && isRecord(handoverData[shiftControlOneCAuditKey])
    ? handoverData[shiftControlOneCAuditKey]
    : null;
  const snapshot = audit && isRecord(audit[key]) ? audit[key] : null;
  if (!audit || !snapshot) return null;
  return {
    capturedAt: readText(audit.capturedAt),
    status: readText(snapshot.status),
    balance: readNumber(snapshot.balance),
    cashboxName: readText(snapshot.cashboxName),
    error: readText(snapshot.error),
  };
}

function parseOneCDateTime(value: string | null | undefined) {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(' ', 'T')}+03:00`
    : value;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function taskCutoff(task: AutoCheckTask) {
  if (task.completedAt) return task.completedAt;
  if (!isRecord(task.handoverData)) return null;
  const updatedAt = readText(task.handoverData.updatedAt);
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function moneyAutoCheck({
  id,
  taskId,
  label,
  actual,
  expected,
  evidence,
}: {
  id: string;
  taskId: number;
  label: string;
  actual: number | null;
  expected: number | null;
  evidence?: string;
}): ShiftAutoCheck {
  if (actual === null) {
    return { id, taskId, label, status: 'waiting', summary: 'Сотрудник ещё не указал фактическую сумму.', evidence };
  }
  if (expected === null) {
    return { id, taskId, label, status: 'unavailable', summary: 'Остаток 1С для этой проверки не получен.', evidence };
  }

  const difference = actual - expected;
  return {
    id,
    taskId,
    label,
    status: Math.abs(difference) <= oneCMoneyTolerance ? 'matched' : 'mismatch',
    summary: `Факт ${formatMoney(actual)} · 1С ${formatMoney(expected)} · разница ${formatMoney(difference)}.`,
    evidence,
  };
}

function employeeOneCSearchKey(employeeName: string) {
  return employeeCashboxSearchKey(employeeName);
}

function matchesExplicitCashbox(cashboxName: string, cashRegisterName: string) {
  const cashbox = normalizeSearchText(cashboxName);
  const cashRegister = normalizeSearchText(cashRegisterName);
  return Boolean(cashbox) && (cashRegister === cashbox || cashRegister.includes(cashbox));
}

function matchesEmployeeManager(employeeName: string, managerName: string) {
  const employeeKey = employeeOneCSearchKey(employeeName);
  return Boolean(employeeKey) && normalizeSearchText(managerName).includes(employeeKey);
}

async function getTbankSalesForDate(date: string): Promise<TbankSalesForDate> {
  const limit = 100;
  const documents: OneCSalesRealizationDocument[] = [];

  for (let offset = 0; offset < 1000; offset += limit) {
    const result = await getSalesRealizations({
      ...DEFAULT_SALES_REALIZATIONS_PARAMS,
      dateFrom: date,
      dateTo: date,
      posted: 'true',
      limit,
      offset,
      includeLines: false,
    });
    if (!result.ok) return { ok: false, documents, error: result.error ?? result.diagnostics.join('; ') };

    documents.push(...result.documents);
    if (result.responseDocumentCount < limit) break;
  }

  return { ok: true, documents };
}

function kkmUsageForEmployee(result: OneCKkmEquipmentDiagnosticsResult, cashboxName: string) {
  return result.cashRegisterUsage.filter((row) => matchesExplicitCashbox(cashboxName, row.cashRegister.name));
}

function findEncashmentPair({
  personal,
  reserve,
  amount,
  cutoff,
}: {
  personal: OneCCashStatementSummaryResult | null;
  reserve: OneCCashStatementSummaryResult | null;
  amount: number;
  cutoff: Date | null;
}) {
  if (!personal?.ok || !reserve?.ok) return null;
  const cutoffTimestamp = cutoff?.getTime() ?? Number.POSITIVE_INFINITY;
  const outgoing = personal.movements.filter((movement) => {
    const timestamp = parseOneCDateTime(movement.period);
    return timestamp !== null && timestamp <= cutoffTimestamp && Math.abs((movement.outgoing ?? 0) - amount) <= oneCMoneyTolerance;
  });
  const incoming = reserve.movements.filter((movement) => {
    const timestamp = parseOneCDateTime(movement.period);
    return timestamp !== null && timestamp <= cutoffTimestamp && Math.abs((movement.incoming ?? 0) - amount) <= oneCMoneyTolerance;
  });

  let timeMatched = false;
  for (const expense of outgoing) {
    for (const receipt of incoming) {
      if (expense.document.ref && receipt.document.ref && expense.document.ref === receipt.document.ref) return 'exact';
      const expenseTimestamp = parseOneCDateTime(expense.period);
      const receiptTimestamp = parseOneCDateTime(receipt.period);
      if (expenseTimestamp !== null && receiptTimestamp !== null && Math.abs(expenseTimestamp - receiptTimestamp) <= 10 * 60 * 1000) {
        timeMatched = true;
      }
    }
  }
  return timeMatched ? 'time' : null;
}

function findExactEncashmentAmounts({
  personal,
  reserve,
}: {
  personal: OneCCashStatementSummaryResult;
  reserve: OneCCashStatementSummaryResult;
}) {
  const amounts = personal.movements.flatMap((outgoingMovement) => {
    const amount = outgoingMovement.outgoing ?? 0;
    if (amount <= oneCMoneyTolerance || !outgoingMovement.document.ref) return [];
    const matchingIncoming = reserve.movements.some((incomingMovement) => (
      incomingMovement.document.ref === outgoingMovement.document.ref
      && Math.abs((incomingMovement.incoming ?? 0) - amount) <= oneCMoneyTolerance
    ));
    return matchingIncoming ? [amount] : [];
  });
  return [...new Set(amounts)];
}

function readHandoverCashBalance(run: { tasks?: Array<{ category: string; handoverData: unknown }> } | null | undefined) {
  const handoverTask = run?.tasks?.find((task) => task.category === 'handover') ?? null;
  if (!handoverTask || !isRecord(handoverTask.handoverData)) return { value: null, isDraft: false };

  const personalCash = isRecord(handoverTask.handoverData.personalCash) ? handoverTask.handoverData.personalCash : null;
  return {
    value: personalCash ? readNumber(personalCash.cashBalance) : null,
    isDraft: handoverTask.handoverData.draft !== false,
  };
}

function cashDifferenceStatus(employeeCashBalance: number | null, oneCClosingBalance: number | null | undefined) {
  if (employeeCashBalance === null) return { label: 'факт не введён', className: 'bg-slate-100 text-slate-700' };
  if (oneCClosingBalance === null || oneCClosingBalance === undefined || !Number.isFinite(oneCClosingBalance)) {
    return { label: 'ждёт 1С', className: 'bg-slate-100 text-slate-700' };
  }

  const difference = Math.abs(employeeCashBalance - oneCClosingBalance);
  if (difference <= 1) return { label: 'совпало', className: 'bg-green-100 text-green-800' };
  return { label: 'расхождение', className: 'bg-amber-100 text-amber-800' };
}

function cashBusinessStatus({
  hasCashbox,
  result,
  employeeCashBalance,
}: {
  hasCashbox: boolean;
  result: OneCCashStatementSummaryResult | null;
  employeeCashBalance: number | null;
}) {
  if (!hasCashbox) return { label: 'касса не привязана', className: 'bg-amber-100 text-amber-800' };
  if (!result) return { label: 'не получено', className: 'bg-slate-100 text-slate-700' };
  if (!result.ok) return { label: 'ошибка 1С', className: 'bg-rose-100 text-rose-800' };
  return cashDifferenceStatus(employeeCashBalance, result.closingBalance);
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
  if (!result) return { label: 'не получено', className: 'bg-slate-100 text-slate-700' };
  if (!result.ok) return { label: 'ошибка 1С', className: 'bg-rose-100 text-rose-800' };
  return { label: 'получено', className: 'bg-green-100 text-green-800' };
}

function cashStatementScheduleLabel(status: string | undefined) {
  if (status === 'working') return { label: 'работает сегодня', className: 'bg-green-100 text-green-800' };
  if (status === 'off') return { label: 'не по графику', className: 'bg-slate-100 text-slate-700' };
  return { label: 'график не заполнен', className: 'bg-amber-100 text-amber-800' };
}

function acquiringControlStatus(task: { status: string; integerValue: number | null; numericValue: number | null } | null | undefined) {
  if (!task) return { label: 'нет задачи', className: 'bg-slate-100 text-slate-700', problem: false };
  if (task.status !== 'done') return { label: 'не выполнено', className: 'bg-amber-100 text-amber-800', problem: true };
  if (task.integerValue === 0) return { label: 'новых операций не было', className: 'bg-slate-100 text-slate-700', problem: false };
  if (task.integerValue === 1) return { label: 'всё совпадает', className: 'bg-green-100 text-green-800', problem: false };
  if (task.integerValue === 2) return { label: 'есть расхождение', className: 'bg-rose-100 text-rose-800', problem: true };
  if (task.numericValue !== null) return { label: 'старая версия', className: 'bg-blue-100 text-blue-800', problem: false };
  return { label: 'нет результата', className: 'bg-amber-100 text-amber-800', problem: true };
}

function cashboxMappingStatusMessage(status?: string, error?: string) {
  if (status === 'saved') return { tone: 'green', text: 'Привязка кассы 1С сохранена.' };
  if (status === 'cleared') return { tone: 'amber', text: 'Привязка кассы 1С очищена.' };
  if (error === 'invalid-user') return { tone: 'rose', text: 'Не удалось сохранить: сотрудник не найден.' };
  if (error === 'unsupported-user') return { tone: 'rose', text: 'Кассы 1С привязываются только для розницы и опта.' };
  if (error === 'cashbox-not-found') return { tone: 'rose', text: 'Не удалось сохранить: касса 1С не найдена в текущем списке.' };
  return null;
}

function buildEmployeeAutoChecks({
  employeeName,
  tasks,
  cashboxName,
  cashStatement,
  reserveCashboxName,
  reserveStatement,
  kkmDiagnostics,
  tbankSales,
}: {
  employeeName: string;
  tasks: AutoCheckTask[];
  cashboxName: string | null;
  cashStatement: OneCCashStatementSummaryResult | null;
  reserveCashboxName: string | null;
  reserveStatement: OneCCashStatementSummaryResult | null;
  kkmDiagnostics: OneCKkmEquipmentDiagnosticsResult;
  tbankSales: TbankSalesForDate;
}) {
  const checks: ShiftAutoCheck[] = [];
  const handoverHasStoreClosing = tasks.some((task) => (
    task.category === 'handover'
    && isRecord(task.handoverData)
    && isRecord(task.handoverData.storeClosing)
  ));
  const employeeTbankDocuments = tbankSales.documents.filter((document) => matchesEmployeeManager(employeeName, document.managerName));
  const kkmUsage = cashboxName && kkmDiagnostics.ok
    ? kkmUsageForEmployee(kkmDiagnostics, cashboxName)
    : [];

  for (const task of tasks) {
    const cutoff = taskCutoff(task);

    if (task.category === 'cash') {
      if (task.status !== 'done') {
        checks.push({
          id: `cash-${task.id}`,
          taskId: task.id,
          label: 'Наличные в кассе',
          status: 'waiting',
          summary: 'Сотрудник ещё не указал фактическую сумму.',
        });
        continue;
      }
      const snapshot = readTaskCashAudit(task, 'personalCash');
      if (!snapshot || snapshot.status !== 'captured' || snapshot.balance === null) {
        checks.push({
          id: `cash-${task.id}`,
          taskId: task.id,
          label: 'Наличные в кассе',
          status: 'unavailable',
          summary: snapshot?.error || 'Снимок текущего остатка 1С не был сохранён в момент выполнения этого шага.',
          evidence: 'Исторический остаток не реконструируется по движениям задним числом.',
        });
        continue;
      }
      checks.push(moneyAutoCheck({
        id: `cash-${task.id}`,
        taskId: task.id,
        label: 'Наличные в кассе',
        actual: task.numericValue,
        expected: snapshot.balance,
        evidence: `Текущий остаток кассы 1С сохранён при отправке шага${snapshot.capturedAt ? ` в ${formatTime(new Date(snapshot.capturedAt))}` : ''}.`,
      }));
      continue;
    }

    if (task.category === 'credit') {
      if (task.status !== 'done') {
        checks.push({
          id: `credit-${task.id}`,
          taskId: task.id,
          label: 'Операции Т-Банка',
          status: 'waiting',
          summary: 'Сотрудник ещё не завершил проверку.',
        });
        continue;
      }
      if (!tbankSales.ok) {
        checks.push({
          id: `credit-${task.id}`,
          taskId: task.id,
          label: 'Операции Т-Банка',
          status: 'unavailable',
          summary: tbankSales.error || 'Реализации 1С не получены.',
        });
        continue;
      }

      const cutoffTimestamp = cutoff?.getTime() ?? Number.POSITIVE_INFINITY;
      const matchedDocuments = employeeTbankDocuments.filter((document) => {
        const timestamp = parseOneCDateTime(document.date);
        return timestamp !== null && timestamp <= cutoffTimestamp;
      });
      const declaredOperations = task.integerValue === 1 || task.integerValue === 2;
      const oneCHasOperations = matchedDocuments.length > 0;

      if (!oneCHasOperations && tbankSales.documents.length > 0) {
        checks.push({
          id: `credit-${task.id}`,
          taskId: task.id,
          label: 'Операции Т-Банка',
          status: 'unavailable',
          summary: `По имени сотрудника документы не найдены; всего по партнёру Т-Банка за день: ${tbankSales.documents.length}.`,
          evidence: 'Сопоставление выполняется по имени менеджера в реализации 1С.',
        });
        continue;
      }

      const matchedAmount = matchedDocuments.reduce((sum, document) => sum + (document.amount ?? 0), 0);
      checks.push({
        id: `credit-${task.id}`,
        taskId: task.id,
        label: 'Операции Т-Банка',
        status: declaredOperations === oneCHasOperations ? 'matched' : 'mismatch',
        summary: oneCHasOperations
          ? `1С: ${matchedDocuments.length} реализаций на ${formatMoney(matchedAmount)}; сотрудник ${declaredOperations ? 'подтвердил операции' : 'указал, что операций не было'}.`
          : `В 1С операций до момента проверки нет; сотрудник ${declaredOperations ? 'подтвердил операции' : 'указал, что операций не было'}.`,
        evidence: 'Сопоставление по партнёру Т-Банка, дате и имени менеджера 1С.',
      });
      continue;
    }

    if (task.category === 'acquiring') {
      if (task.status !== 'done') {
        checks.push({
          id: `acquiring-${task.id}`,
          taskId: task.id,
          label: 'Операции терминала',
          status: 'waiting',
          summary: 'Сотрудник ещё не завершил проверку операций терминала.',
        });
      } else {
        const terminalCheck = isRecord(task.handoverData) && isRecord(task.handoverData.terminalCheck) ? task.handoverData.terminalCheck : null;
        const hadOperations = task.integerValue === 1 || task.integerValue === 2;
        const intervalFrom = terminalCheck ? readText(terminalCheck.intervalFrom) : '';
        checks.push({
          id: `acquiring-${task.id}`,
          taskId: task.id,
          label: 'Операции терминала',
          status: 'unavailable',
          summary: hadOperations
            ? `Сотрудник указал, что новые операции были и сверка ${task.integerValue === 2 ? 'выявила расхождение' : 'совпала'}.`
            : 'Сотрудник указал, что новых операций не было.',
          evidence: intervalFrom
            ? `Проверяемый интервал начинается ${formatTime(new Date(intervalFrom))}. Источник всех операций единого терминала пока не подключён к этой автопроверке.`
            : 'Источник всех операций единого терминала пока не подключён к этой автопроверке.',
        });
      }
      continue;
    }

    if (task.category === 'opening' || task.category === 'closing') {
      if (task.category === 'closing' && handoverHasStoreClosing) continue;
      const label = task.category === 'opening' ? 'Открытие смены ККМ' : 'Закрытие смены ККМ';
      if (task.status !== 'done') {
        checks.push({
          id: `${task.category}-${task.id}`,
          taskId: task.id,
          label,
          status: 'waiting',
          summary: task.category === 'opening'
            ? 'Сотрудник ещё не завершил открытие смены.'
            : 'Сотрудник ещё не завершил закрытие смены.',
        });
      } else if (!kkmDiagnostics.ok || !cashboxName) {
        checks.push({
          id: `${task.category}-${task.id}`,
          taskId: task.id,
          label,
          status: 'unavailable',
          summary: !cashboxName ? 'Касса сотрудника не привязана.' : kkmDiagnostics.error || 'Данные ККМ 1С не получены.',
        });
      } else {
        const checksCount = kkmUsage.reduce((sum, row) => sum + (row.checks ?? 0), 0);
        checks.push({
          id: `${task.category}-${task.id}`,
          taskId: task.id,
          label,
          status: 'unavailable',
          summary: checksCount > 0
            ? `ККМ активна: в 1С за день найдено чеков ${checksCount}. Сам X/Z-отчёт текущий endpoint не подтверждает.`
            : 'Чеки ККМ за день не найдены. Сам X/Z-отчёт текущий endpoint не подтверждает.',
        });
      }
      continue;
    }

    if (task.category !== 'handover') continue;

    const handoverData = isRecord(task.handoverData) ? task.handoverData : null;
    const personalCash = handoverData && isRecord(handoverData.personalCash) ? handoverData.personalCash : null;
    const reserveCash = handoverData && isRecord(handoverData.reserveCash) ? handoverData.reserveCash : null;
    const storeClosing = handoverData && isRecord(handoverData.storeClosing) ? handoverData.storeClosing : null;
    const personalCashBalance = personalCash ? readNumber(personalCash.cashBalance) : null;
    const personalCashAudit = readTaskCashAudit(task, 'personalCash');
    const reserveCashAudit = readTaskCashAudit(task, 'reserveCash');
    const expectedPersonalCash = personalCashAudit?.status === 'captured' && personalCashAudit.balance !== null
      ? personalCashAudit.balance
      : cashStatement?.ok ? cashStatement.closingBalance : null;
    const expectedReserveCash = reserveCashAudit?.status === 'captured' && reserveCashAudit.balance !== null
      ? reserveCashAudit.balance
      : reserveStatement?.ok ? reserveStatement.closingBalance : null;

    checks.push(moneyAutoCheck({
      id: `handover-cash-${task.id}`,
      taskId: task.id,
      label: 'Пересчёт своей кассы',
      actual: personalCashBalance,
      expected: expectedPersonalCash,
      evidence: personalCashAudit?.status === 'captured'
        ? `Текущий остаток кассы 1С сохранён при сдаче смены${personalCashAudit.capturedAt ? ` в ${formatTime(new Date(personalCashAudit.capturedAt))}` : ''}.`
        : 'Снимок при сдаче смены отсутствует; используется конечный остаток 1С за день.',
    }));
    checks.push(moneyAutoCheck({
      id: `handover-reserve-${task.id}`,
      taskId: task.id,
      label: 'Пересчёт резерва',
      actual: reserveCash ? readNumber(reserveCash.cashBalance) : null,
      expected: expectedReserveCash,
      evidence: reserveCashAudit?.status === 'captured'
        ? `Текущий полный остаток резерва 1С сохранён при сдаче смены${reserveCashAudit.capturedAt ? ` в ${formatTime(new Date(reserveCashAudit.capturedAt))}` : ''}.`
        : reserveCashboxName
          ? `Снимок при сдаче смены отсутствует; используется конечный остаток кассы 1С «${reserveCashboxName}» за день.`
        : 'Касса резерва 1С не найдена.',
    }));

    const discrepancyType = personalCash ? readText(personalCash.discrepancyType) : '';
    const discrepancyAmount = personalCash ? readNumber(personalCash.discrepancyAmount) : null;
    if (personalCashBalance === null) {
      checks.push({
        id: `handover-discrepancy-${task.id}`,
        taskId: task.id,
        label: 'Расхождение по кассе',
        status: 'waiting',
        summary: 'Сначала нужен фактический пересчёт кассы.',
      });
    } else if (expectedPersonalCash === null) {
      checks.push({
        id: `handover-discrepancy-${task.id}`,
        taskId: task.id,
        label: 'Расхождение по кассе',
        status: 'unavailable',
        summary: 'Остаток 1С для расчёта расхождения не получен.',
      });
    } else {
      const difference = personalCashBalance - expectedPersonalCash;
      const expectedType = Math.abs(difference) <= oneCMoneyTolerance ? 'none' : difference > 0 ? 'surplus' : 'shortage';
      const typeMatches = discrepancyType === expectedType;
      const amountMatches = expectedType === 'none'
        ? discrepancyAmount === null || Math.abs(discrepancyAmount) <= oneCMoneyTolerance
        : discrepancyAmount !== null && Math.abs(discrepancyAmount - Math.abs(difference)) <= oneCMoneyTolerance;
      checks.push({
        id: `handover-discrepancy-${task.id}`,
        taskId: task.id,
        label: 'Расхождение по кассе',
        status: typeMatches && amountMatches ? 'matched' : 'mismatch',
        summary: `Расчёт 1С: ${formatMoney(difference)}; заявление сотрудника: ${discrepancyType || 'не заполнено'}${discrepancyAmount === null ? '' : `, ${formatMoney(discrepancyAmount)}`}.`,
      });
    }

    const terminalCheck = handoverData && isRecord(handoverData.terminalCheck) ? handoverData.terminalCheck : null;
    const declaredTerminalOperations = terminalCheck ? readBoolean(terminalCheck.hadOperations) : null;
    if (declaredTerminalOperations === null) {
      checks.push({
        id: `handover-terminal-${task.id}`,
        taskId: task.id,
        label: 'Операции терминала при сдаче',
        status: 'waiting',
        summary: 'Сотрудник ещё не указал, были ли новые операции терминала.',
      });
    } else {
      checks.push({
        id: `handover-terminal-${task.id}`,
        taskId: task.id,
        label: 'Операции терминала при сдаче',
        status: 'unavailable',
        summary: declaredTerminalOperations
          ? `Сотрудник указал, что новые операции были; результат сверки: ${readText(terminalCheck?.reconciliation) === 'discrepancy' ? 'есть расхождение' : 'всё совпадает'}.`
          : 'Сотрудник указал, что новых операций не было.',
        evidence: 'Источник всех операций единого терминала пока не подключён к этой автопроверке.',
      });
    }

    const declaredTbank = personalCash
      ? readBoolean(personalCash.hasTbankCredit)
      : storeClosing
        ? readBoolean(storeClosing.hasTbankCredit)
        : null;
    if (!tbankSales.ok) {
      checks.push({
        id: `handover-tbank-${task.id}`,
        taskId: task.id,
        label: 'Операции Т-Банка',
        status: 'unavailable',
        summary: tbankSales.error || 'Реализации 1С не получены.',
      });
    } else if (declaredTbank === null) {
      checks.push({
        id: `handover-tbank-${task.id}`,
        taskId: task.id,
        label: 'Операции Т-Банка',
        status: 'waiting',
        summary: 'Сотрудник ещё не указал, были ли операции.',
      });
    } else if (employeeTbankDocuments.length === 0 && tbankSales.documents.length > 0) {
      checks.push({
        id: `handover-tbank-${task.id}`,
        taskId: task.id,
        label: 'Операции Т-Банка',
        status: 'unavailable',
        summary: `По имени сотрудника документы не найдены; всего по партнёру Т-Банка за день: ${tbankSales.documents.length}.`,
        evidence: 'Сумма терминального отчёта не сравнивается: реализации 1С и операции терминала имеют разный состав.',
      });
    } else {
      const oneCHasTbank = employeeTbankDocuments.length > 0;
      const amount = employeeTbankDocuments.reduce((sum, document) => sum + (document.amount ?? 0), 0);
      checks.push({
        id: `handover-tbank-${task.id}`,
        taskId: task.id,
        label: 'Операции Т-Банка',
        status: declaredTbank === oneCHasTbank ? 'matched' : 'mismatch',
        summary: oneCHasTbank
          ? `1С: ${employeeTbankDocuments.length} реализаций на ${formatMoney(amount)}; сотрудник указал ${declaredTbank ? 'операции были' : 'операций не было'}.`
          : `В 1С операций по сотруднику нет; сотрудник указал ${declaredTbank ? 'операции были' : 'операций не было'}.`,
        evidence: 'Сумма терминального отчёта не сравнивается: реализации 1С и операции терминала имеют разный состав.',
      });
    }

    const requiresEncashment = personalCash ? readBoolean(personalCash.requiresEncashment) : null;
    const encashmentAmount = personalCash ? readNumber(personalCash.encashmentAmount) : null;
    if (requiresEncashment === false) {
      if (!cashStatement?.ok || !reserveStatement?.ok) {
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: 'Инкассация в резерв',
          status: 'unavailable',
          summary: 'Движения своей кассы или резерва 1С не получены.',
        });
      } else {
        const exactAmounts = findExactEncashmentAmounts({
          personal: cashStatement,
          reserve: reserveStatement,
        });
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: 'Инкассация в резерв',
          status: exactAmounts.length > 0 ? 'mismatch' : 'matched',
          summary: exactAmounts.length > 0
            ? `Сотрудник указал, что инкассации не было, но в 1С найдено парное движение касса → резерв на ${exactAmounts.map(formatMoney).join(', ')}.`
            : 'Сотрудник указал, что инкассации не было; парных движений касса → резерв в 1С не найдено.',
        });
      }
    } else if (requiresEncashment) {
      if (encashmentAmount === null) {
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: 'Инкассация в резерв',
          status: 'waiting',
          summary: 'Сумма инкассации не указана.',
        });
      } else if (!cashStatement?.ok || !reserveStatement?.ok) {
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: 'Инкассация в резерв',
          status: 'unavailable',
          summary: 'Движения своей кассы или резерва 1С не получены.',
        });
      } else {
        const pairMatch = findEncashmentPair({
          personal: cashStatement,
          reserve: reserveStatement,
          amount: encashmentAmount,
          cutoff: null,
        });
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: 'Инкассация в резерв',
          status: pairMatch === 'exact' ? 'matched' : pairMatch === 'time' ? 'unavailable' : 'mismatch',
          summary: pairMatch === 'exact'
            ? `В 1С один документ отражает расход из кассы и приход в резерв на ${formatMoney(encashmentAmount)}.`
            : pairMatch === 'time'
              ? `Найдены расход и приход на ${formatMoney(encashmentAmount)} рядом по времени, но документы 1С различаются.`
              : `Парное движение касса → резерв на ${formatMoney(encashmentAmount)} в 1С не найдено.`,
          evidence: 'Проверяется учётное движение; физическое помещение денег подтверждается сотрудником и фото.',
        });
      }
    }

    if (storeClosing) {
      const checksCount = kkmUsage.reduce((sum, row) => sum + (row.checks ?? 0), 0);
      checks.push({
        id: `handover-z-report-${task.id}`,
        taskId: task.id,
        label: 'Закрытие смены ККМ',
        status: 'unavailable',
        summary: kkmDiagnostics.ok && cashboxName
          ? `В 1С за день найдено чеков ККМ: ${checksCount}. Факт формирования Z-отчёта текущий endpoint не подтверждает.`
          : 'Данные ККМ 1С не получены или касса не привязана.',
      });
    }
  }

  return checks;
}

export default async function AdminWorkdayPage({ searchParams }: { searchParams?: { date?: string; cashboxMapping?: string; cashboxMappingError?: string; control?: string; employee?: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const today = getMoscowDateKey();
  const selectedDate = isDateKey(searchParams?.date) ? searchParams.date : today;
  const selectedControlFilter = controlFilter(searchParams?.control);
  const previousDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);
  const [employees, schedules, workDays, shiftControlRuns, unfinishedWorkDays, cashStatementDimensions, liveRevision] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        department: true,
        oneCCashboxMapping: true,
      },
    }),
    prisma.workScheduleEntry.findMany({ where: { date: selectedDate } }),
    prisma.workDayEntry.findMany({ where: { date: selectedDate } }),
    prisma.shiftControlRun.findMany({
      where: { date: selectedDate },
      include: {
        tasks: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: {
            manualReviews: {
              orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }],
              include: {
                reviewedBy: {
                  select: {
                    id: true,
                    name: true,
                    login: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.workDayEntry.findMany({
      where: { status: { in: ['active', 'missing_checkout'] }, endedAt: null, date: { lt: selectedDate } },
      include: { user: { select: { name: true, department: true } } },
      orderBy: { startedAt: 'desc' },
    }),
    getCashStatementDimensions(),
    getAdminWorkdayRevision(selectedDate),
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
  const missingCheckoutSelectedDate = workDays.filter((entry) => (
    evaluateWorkdayTiming({
      dateKey: selectedDate,
      todayDateKey: today,
      nowMinutes,
      department: entry.department,
      workDay: entry,
    }).some((violation) => violation.kind === 'missing_checkout')
  )).length;
  const missingCheckoutCount = unfinishedWorkDays.length + missingCheckoutSelectedDate;
  const cashStatementOrganization =
    cashStatementDimensions.organizations.find((organization) => normalizeSearchText(organization.name).includes('оффоника'))
    ?? cashStatementDimensions.organizations[0]
    ?? null;
  const reserveCashbox =
    cashStatementDimensions.cashboxes.find((cashbox) => normalizeSearchText(cashbox.name) === reserveCashboxSearchName)
    ?? null;
  const [kkmDiagnostics, tbankSales, reserveStatement] = await Promise.all([
    getKkmEquipmentDiagnostics({ dateFrom: selectedDate, dateTo: selectedDate, limit: 300 }),
    getTbankSalesForDate(selectedDate),
    cashStatementDimensions.ok && cashStatementOrganization && reserveCashbox
      ? getCashStatementSummary({
        date: selectedDate,
        organizationRef: cashStatementOrganization.ref,
        cashboxRef: reserveCashbox.ref,
      })
      : Promise.resolve(null),
  ]);
  const cashStatementEmployees = employees.filter((employee) => usesWorkdayShiftControl(employee));
  const cashStatementRows = await Promise.all(cashStatementEmployees.map(async (employee) => {
    const searchKey = employeeCashboxSearchKey(employee.name);
    const suggestedCashbox = searchKey
      ? cashStatementDimensions.cashboxes.find((item) => normalizeSearchText(item.name).includes(searchKey)) ?? null
      : null;
    const schedule = scheduleByUser.get(employee.id);
    const scheduleInfo = cashStatementScheduleLabel(schedule?.status);
    const mapping = employee.oneCCashboxMapping?.isActive ? employee.oneCCashboxMapping : null;
    const employeeCash = readHandoverCashBalance(shiftControlRunByUser.get(employee.id));
    const mappedCashbox = mapping
      ? cashStatementDimensions.cashboxes.find((item) => item.ref === mapping.oneCCashboxRef)
        ?? { ref: mapping.oneCCashboxRef, name: mapping.oneCCashboxName, deleted: false }
      : null;

    if (!mapping) {
      return {
        employee,
        scheduleInfo,
        cashbox: null,
        suggestedCashbox,
        employeeCash,
        result: null,
        note: 'Касса 1С не привязана',
      };
    }

    if (!cashStatementDimensions.ok || !cashStatementOrganization || !mappedCashbox) {
      return {
        employee,
        scheduleInfo,
        cashbox: mappedCashbox,
        suggestedCashbox,
        employeeCash,
        result: null,
        note: !cashStatementDimensions.ok
          ? cashStatementDimensions.error ?? cashStatementDimensions.diagnostics.join('; ') ?? '1С не вернула список касс'
          : !cashStatementOrganization
            ? 'Организация 1С не найдена'
            : 'Привязанная касса 1С не найдена',
      };
    }

    const result = await getCashStatementSummary({
      date: selectedDate,
      organizationRef: cashStatementOrganization.ref,
      cashboxRef: mappedCashbox.ref,
    });

    return {
      employee,
      scheduleInfo,
      cashbox: mappedCashbox,
      suggestedCashbox,
      employeeCash,
      result,
      note: result.ok ? '' : result.error ?? result.diagnostics.join('; ') ?? 'Не удалось получить ведомость 1С',
    };
  }));
  const cashStatementLoadedCount = cashStatementRows.filter((row) => row.result?.ok).length;
  const cashStatementMissingCashboxCount = cashStatementRows.filter((row) => !row.cashbox).length;
  const cashStatementRowByUser = new Map(cashStatementRows.map((row) => [row.employee.id, row]));
  const autoChecksByUser = new Map(cashStatementEmployees.map((employee) => {
    const run = shiftControlRunByUser.get(employee.id);
    const cashRow = cashStatementRowByUser.get(employee.id);
    const latestManualReviewByCheckId = new Map<string, ShiftAutoCheckManualReview>();
    for (const task of run?.tasks ?? []) {
      for (const review of task.manualReviews) {
        if (latestManualReviewByCheckId.has(review.checkId)) continue;
        latestManualReviewByCheckId.set(review.checkId, {
          id: review.id,
          decision: review.decision === 'confirmed_issue' ? 'confirmed_issue' : 'confirmed_ok',
          comment: review.comment,
          reviewedAt: review.reviewedAt.toISOString(),
          reviewedBy: review.reviewedBy,
        });
      }
    }
    const checks = buildEmployeeAutoChecks({
      employeeName: employee.name,
      tasks: (run?.tasks ?? []) as AutoCheckTask[],
      cashboxName: cashRow?.cashbox?.name ?? null,
      cashStatement: cashRow?.result ?? null,
      reserveCashboxName: reserveCashbox?.name ?? null,
      reserveStatement,
      kkmDiagnostics,
      tbankSales,
    }).map((check) => ({
      ...check,
      manualReview: latestManualReviewByCheckId.get(check.id) ?? null,
    }));
    return [
      employee.id,
      checks,
    ] as const;
  }));
  const autoCheckTotals = [...autoChecksByUser.values()].flat();
  const autoMatchedCount = autoCheckTotals.filter((check) => check.status === 'matched' && !check.manualReview).length;
  const autoMismatchCount = autoCheckTotals.filter((check) => (
    check.manualReview?.decision === 'confirmed_issue'
    || (check.status === 'mismatch' && check.manualReview?.decision !== 'confirmed_ok')
  )).length;
  const autoUnavailableCount = autoCheckTotals.filter((check) => (
    check.status === 'unavailable' && !check.manualReview
  )).length;
  const autoManualReviewCount = autoCheckTotals.filter((check) => check.manualReview?.decision === 'confirmed_ok').length;
  const autoManualIssueCount = autoCheckTotals.filter((check) => check.manualReview?.decision === 'confirmed_issue').length;
  const acquiringControlRows = employees
    .filter((employee) => usesWorkdayShiftControl(employee))
    .map((employee) => {
      const run = shiftControlRunByUser.get(employee.id);
      const tasks = run?.tasks.filter((item) => item.category === 'acquiring') ?? [];
      const task = [...tasks].reverse().find((item) => acquiringControlStatus(item).problem)
        ?? tasks.at(-1)
        ?? null;
      return {
        employee,
        schedule: scheduleByUser.get(employee.id),
        workDay: workDayByUser.get(employee.id),
        task,
        status: acquiringControlStatus(task),
      };
    });
  const acquiringTaskRows = employees
    .filter((employee) => usesWorkdayShiftControl(employee))
    .flatMap((employee) => {
      const run = shiftControlRunByUser.get(employee.id);
      return (run?.tasks ?? [])
        .filter((task) => task.category === 'acquiring')
        .map((task) => ({
          employee,
          schedule: scheduleByUser.get(employee.id),
          workDay: workDayByUser.get(employee.id),
          task,
          status: acquiringControlStatus(task),
        }));
    });
  const acquiringDoneCount = acquiringTaskRows.filter((row) => row.task.status === 'done').length;
  const acquiringPendingCount = acquiringTaskRows.filter((row) => row.status.problem && row.task.integerValue !== 2).length;
  const acquiringDiscrepancyCount = acquiringTaskRows.filter((row) => row.task.integerValue === 2).length;
  const acquiringNoPaymentsCount = acquiringTaskRows.filter((row) => row.task.integerValue === 0).length;
  const acquiringControlRowByUser = new Map(acquiringControlRows.map((row) => [row.employee.id, row]));
  const criticalSystemErrorCount = [
    cashStatementDimensions.ok,
    kkmDiagnostics.ok,
    tbankSales.ok,
    Boolean(reserveStatement?.ok),
  ].filter((ok) => !ok).length;
  const employeeControlRows = employees
    .map((employee) => {
      const schedule = scheduleByUser.get(employee.id);
      const workDay = workDayByUser.get(employee.id);
      const run = shiftControlRunByUser.get(employee.id);
      const shiftControlRequired = usesWorkdayShiftControl(employee);
      const autoChecks = autoChecksByUser.get(employee.id) ?? [];
      const acquiringRow = acquiringControlRowByUser.get(employee.id);
      const timingViolations = evaluateWorkdayTiming({
        dateKey: selectedDate,
        todayDateKey: today,
        nowMinutes,
        department: employee.department,
        scheduleStatus: schedule?.status,
        workDay,
        tasks: (run?.tasks ?? []) as AutoCheckTask[],
      });
      const timingViolationCount = timingViolations.length;
      const manualReviewCount = autoChecks.filter((check) => check.manualReview?.decision === 'confirmed_ok').length;
      const manualIssueCount = autoChecks.filter((check) => check.manualReview?.decision === 'confirmed_issue').length;
      const unresolvedAutoChecks = autoChecks.filter((check) => check.manualReview?.decision !== 'confirmed_ok');
      const mismatchCount = unresolvedAutoChecks.filter((check) => (
        check.status === 'mismatch' || check.manualReview?.decision === 'confirmed_issue'
      )).length;
      const incompleteCount = unresolvedAutoChecks.filter((check) => (
        check.manualReview?.decision !== 'confirmed_issue'
        && (check.status === 'waiting' || check.status === 'unavailable')
      )).length;
      const matchedCount = unresolvedAutoChecks.filter((check) => (
        check.status === 'matched' && check.manualReview?.decision !== 'confirmed_issue'
      )).length;
      const attentionReasons = [
        !schedule ? 'График не заполнен' : null,
        hasStaleCloseViolation(workDay, run) ? 'Закрыто без сдачи смены' : null,
        mismatchCount > 0
          ? manualIssueCount > 0
            ? `Подтверждённых проблем: ${manualIssueCount}`
            : `Расхождений по 1С: ${mismatchCount}`
          : null,
        acquiringRow?.status.problem ? `Операции терминала: ${acquiringRow.status.label}` : null,
        timingViolationCount > 0
          ? timingViolationCount === 1
            ? timingViolations[0].label
            : `Нарушений времени: ${timingViolationCount} · ${timingViolations[0].label}`
          : null,
      ].filter((reason): reason is string => Boolean(reason));
      const needsAttention = attentionReasons.length > 0;
      const waitingForWorkdayStart = schedule?.status === 'working' && selectedDate === today && !workDay;
      const cannotVerify = !needsAttention && (
        waitingForWorkdayStart
        || (
          shiftControlRequired
          && (
            incompleteCount > 0
            || (Boolean(run) && autoChecks.length === 0)
            || (schedule?.status === 'working' && !run)
          )
        )
      );
      const category: Exclude<ControlFilter, 'all'> = needsAttention
        ? 'attention'
        : cannotVerify
          ? 'unverified'
          : 'normal';
      const reviewText = needsAttention
        ? `${attentionReasons.slice(0, 2).join(' · ')}${attentionReasons.length > 2 ? ` · ещё ${attentionReasons.length - 2}` : ''}`
        : cannotVerify
          ? waitingForWorkdayStart
            ? 'Нельзя проверить время автоматически: рабочий день ещё не начат'
            : incompleteCount > 0
              ? `Нельзя проверить автоматически: ${incompleteCount}`
              : 'Недостаточно данных для проверки'
          : manualReviewCount > 0
            ? `Проверено вручную: ${manualReviewCount}`
            : 'Действий не требуется';
      const oneCStatus = mismatchCount > 0
        ? {
          label: manualIssueCount > 0 ? `Подтверждено проблем ${manualIssueCount}` : `Расхождений ${mismatchCount}`,
          className: 'bg-rose-100 text-rose-800',
        }
        : incompleteCount > 0
          ? { label: `Нельзя проверить автоматически: ${incompleteCount}`, className: 'bg-blue-100 text-blue-800' }
          : manualReviewCount > 0
            ? { label: `Вручную ${manualReviewCount}`, className: 'bg-green-100 text-green-800' }
          : matchedCount > 0
            ? { label: `Совпало ${matchedCount}`, className: 'bg-green-100 text-green-800' }
            : { label: 'Нет проверок', className: 'bg-slate-100 text-slate-700' };
      const timeStatus = timingViolationCount > 0
        ? `${timingViolationCount} нарушений`
        : workDay?.startedAt
          ? `${formatTime(workDay.startedAt)}–${formatTime(workDay.endedAt)}`
          : '—';

      return {
        employee,
        schedule,
        workDay,
        run,
        autoChecks,
        timingViolations,
        shiftControlRequired,
        timingViolationCount,
        category,
        reviewText,
        oneCStatus,
        timeStatus,
      };
    })
    .sort((left, right) => {
      const rank = { attention: 0, unverified: 1, normal: 2 };
      return rank[left.category] - rank[right.category]
        || left.employee.department.localeCompare(right.employee.department, 'ru')
        || left.employee.name.localeCompare(right.employee.name, 'ru');
    });
  const attentionEmployeeCount = employeeControlRows.filter((row) => row.category === 'attention').length;
  const unverifiedEmployeeCount = employeeControlRows.filter((row) => row.category === 'unverified').length;
  const normalEmployeeCount = employeeControlRows.filter((row) => row.category === 'normal').length;
  const filteredEmployeeControlRows = selectedControlFilter === 'all'
    ? employeeControlRows
    : employeeControlRows.filter((row) => row.category === selectedControlFilter);
  const reviewableEmployeeRows = filteredEmployeeControlRows.filter((row) => row.shiftControlRequired && row.run);
  const controlFilterHref = (filter: ControlFilter) => `/admin/workday?date=${selectedDate}&control=${filter}#employees-control`;
  const employeeDetailHref = (employeeId: number) => (
    `/admin/workday?date=${selectedDate}&control=${selectedControlFilter}&employee=${employeeId}#employees-control`
  );
  const employeeDetailCloseHref = `/admin/workday?date=${selectedDate}&control=${selectedControlFilter}#employees-control`;
  const overallSummary = criticalSystemErrorCount > 0
    ? {
      title: 'Есть критичные ошибки автоматических проверок',
      description: `Недоступных источников: ${criticalSystemErrorCount}. Сначала восстановите подключения 1С.`,
      className: 'border-rose-200 bg-rose-50 text-rose-950',
    }
    : attentionEmployeeCount > 0
      ? {
        title: 'Есть сотрудники, требующие проверки',
        description: `Критичных ошибок системы нет. Требуют внимания: ${attentionEmployeeCount}.`,
        className: 'border-amber-200 bg-amber-50 text-amber-950',
      }
      : {
        title: 'Критичных ошибок нет',
        description: unverifiedEmployeeCount > 0
          ? `Действий по сотрудникам не требуется. Не удалось полностью проверить: ${unverifiedEmployeeCount}.`
          : 'Все доступные проверки завершены без замечаний.',
        className: 'border-green-200 bg-green-50 text-green-950',
      };
  const cashboxMappingMessage = cashboxMappingStatusMessage(searchParams?.cashboxMapping, searchParams?.cashboxMappingError);
  const cashboxMappingEmployees = employees.filter((employee) => usesWorkdayShiftControl(employee));
  const cashboxMappingRedirectTo = `/admin/workday?date=${selectedDate}`;

  return (
    <AdminShell>
      <AdminWorkdayAutoRefresh date={selectedDate} revision={liveRevision} />
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
            <WorkdayQrCodes />
          </div>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          <StatCard
            title='Ошибки системы'
            value={criticalSystemErrorCount}
            tone={criticalSystemErrorCount > 0 ? 'rose' : 'green'}
            caption={criticalSystemErrorCount > 0 ? 'нужно восстановить подключения' : 'критичных ошибок нет'}
            icon={AlertTriangle}
          />
          <StatCard
            title='Требуют внимания'
            value={attentionEmployeeCount}
            tone='amber'
            caption={attentionEmployeeCount > 0 ? 'нужно проверить сотрудников' : 'действий не требуется'}
            icon={UserCheck}
          />
          <StatCard
            title='Нельзя проверить автоматически'
            value={unverifiedEmployeeCount}
            tone='blue'
            caption='нет данных или полной автопроверки'
            icon={ClipboardList}
          />
          <StatCard
            title='Без замечаний'
            value={normalEmployeeCount}
            tone='green'
            caption='по доступным данным всё нормально'
            icon={CheckCircle2}
          />
        </div>

        <Card className={`border ${overallSummary.className}`}>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <p className='text-base font-extrabold'>{overallSummary.title}</p>
              <p className='mt-1 text-sm font-semibold opacity-80'>{overallSummary.description}</p>
            </div>
            {attentionEmployeeCount > 0 ? (
              <Link
                href={controlFilterHref('attention')}
                className='inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-extrabold text-white transition hover:bg-slate-800'
              >
                Показать сотрудников
              </Link>
            ) : null}
          </div>
        </Card>

        <Card className='p-5'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='flex items-start gap-3'>
              <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700'>
                <ClipboardList className='h-5 w-5' />
              </span>
              <div>
                <h2 className='text-lg font-extrabold text-slate-950'>Состояние автоматических проверок</h2>
                <p className='mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-500'>
                  Сверка касс, резерва, операций терминала и кредитных документов. Ограничения автоматизации не считаются ошибкой сотрудника.
                </p>
              </div>
            </div>
            <div className='flex max-w-xl flex-wrap gap-2 text-xs font-bold'>
              <Badge className={cashStatementDimensions.ok ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}>
                кассы 1С: {cashStatementDimensions.ok ? 'доступны' : 'ошибка'}
              </Badge>
              <Badge className={kkmDiagnostics.ok ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}>
                ККМ: {kkmDiagnostics.ok ? 'доступна' : 'ошибка'}
              </Badge>
              <Badge className={tbankSales.ok ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}>
                Т-Банк: {tbankSales.ok ? 'доступен' : 'ошибка'}
              </Badge>
              <Badge className={reserveStatement?.ok ? 'bg-green-100 text-green-800' : 'bg-rose-100 text-rose-800'}>
                резерв: {reserveStatement?.ok ? reserveCashbox?.name : 'ошибка'}
              </Badge>
              <Badge className='bg-green-100 text-green-800'>совпало: {autoMatchedCount}</Badge>
              <Badge className={autoMismatchCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}>
                расхождения: {autoMismatchCount}
              </Badge>
              <Badge className='bg-blue-100 text-blue-800'>нельзя проверить автоматически: {autoUnavailableCount}</Badge>
              <Badge className='bg-green-100 text-green-800'>проверено вручную: {autoManualReviewCount}</Badge>
              {autoManualIssueCount > 0 ? (
                <Badge className='bg-rose-100 text-rose-800'>проблем подтверждено вручную: {autoManualIssueCount}</Badge>
              ) : null}
            </div>
          </div>
          <div className='mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-600'>
            <span>По графику: <strong className='text-slate-950'>{scheduledWorking}</strong></span>
            <span>Выходной: <strong className='text-slate-950'>{scheduledOff}</strong></span>
            <span>Без графика: <strong className={scheduleMissing > 0 ? 'text-amber-700' : 'text-slate-950'}>{scheduleMissing}</strong></span>
            <span>Начали: <strong className='text-slate-950'>{startedCount}</strong></span>
            <span>Завершили: <strong className='text-slate-950'>{completedCount}</strong></span>
            <span>Опоздали: <strong className={lateCount > 0 ? 'text-amber-700' : 'text-slate-950'}>{lateCount}</strong></span>
            <span>Не завершили: <strong className={missingCheckoutCount > 0 ? 'text-amber-700' : 'text-slate-950'}>{missingCheckoutCount}</strong></span>
          </div>
        </Card>

        <Card className='p-0' id='employees-control'>
          <div className='flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <h2 className='text-lg font-extrabold text-slate-950'>Сотрудники</h2>
              <p className='mt-1 text-sm font-medium text-slate-500'>
                Сначала показаны сотрудники, которым требуется внимание. Статусы времени и сверки 1С разделены.
              </p>
            </div>
            <div className='flex flex-wrap gap-2 text-xs font-extrabold'>
              {([
                ['attention', `Требуют внимания · ${attentionEmployeeCount}`],
                ['unverified', `Нельзя проверить автоматически · ${unverifiedEmployeeCount}`],
                ['normal', `Без замечаний · ${normalEmployeeCount}`],
                ['all', `Все · ${employeeControlRows.length}`],
              ] as Array<[ControlFilter, string]>).map(([filter, label]) => (
                <Link
                  key={filter}
                  href={controlFilterHref(filter)}
                  className={`rounded-lg px-3 py-2 ring-1 transition ${
                    selectedControlFilter === filter
                      ? 'bg-slate-950 text-white ring-slate-950'
                      : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {filteredEmployeeControlRows.length === 0 ? (
            <div className='px-5 py-5 text-sm font-semibold text-slate-500'>В этой категории сотрудников нет.</div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <thead>
                  <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                    <th className='px-4 py-2.5'>Сотрудник</th>
                    <th className='px-4 py-2.5'>Статус дня</th>
                    <th className='px-4 py-2.5'>Время</th>
                    <th className='px-4 py-2.5'>Сверка 1С</th>
                    <th className='px-4 py-2.5'>Что требует внимания</th>
                    <th className='px-4 py-2.5'>Действие</th>
                    {devWorkdayToolsEnabled && <th className='px-4 py-2.5'>Dev/Test</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployeeControlRows.map((row) => {
                    const status = row.workDay?.status ?? 'not_started';
                    const reviewableIndex = reviewableEmployeeRows.findIndex((reviewableRow) => reviewableRow.employee.id === row.employee.id);
                    const previousEmployeeRow = reviewableIndex > 0 ? reviewableEmployeeRows[reviewableIndex - 1] : null;
                    const nextEmployeeRow = reviewableIndex >= 0 && reviewableIndex < reviewableEmployeeRows.length - 1
                      ? reviewableEmployeeRows[reviewableIndex + 1]
                      : null;
                    return (
                      <tr key={row.employee.id} className='border-t border-slate-100 align-middle'>
                        <td className='px-4 py-2.5'>
                          <p className='font-bold text-slate-950'>
                            {row.employee.name}
                            <span className='ml-2 text-xs font-semibold text-slate-400'>{departmentLabel(row.employee.department)}</span>
                          </p>
                          <p className='mt-0.5 text-xs font-semibold text-slate-500'>
                            {scheduleStatusLabel(row.schedule?.status)} · {row.workDay?.shiftLabel ?? 'смена не задана'}
                          </p>
                        </td>
                        <td className='px-4 py-2.5'>
                          <Badge className={statusClass(status)}>{workDayStatusLabel(status)}</Badge>
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold ${
                          row.timingViolationCount > 0 ? 'text-amber-700' : 'text-slate-700'
                        }`}>
                          {row.timeStatus}
                        </td>
                        <td className='px-4 py-2.5'>
                          <Badge className={row.oneCStatus.className}>{row.oneCStatus.label}</Badge>
                        </td>
                        <td className={`max-w-[360px] px-4 py-2.5 text-sm font-semibold ${
                          row.category === 'attention'
                            ? 'text-amber-800'
                            : row.category === 'unverified'
                              ? 'text-blue-700'
                              : 'text-green-700'
                        }`}>
                          {row.reviewText}
                        </td>
                        <td className='whitespace-nowrap px-4 py-2.5'>
                          {row.shiftControlRequired ? (
                            <AdminShiftControlDetails
                              employeeName={row.employee.name}
                              department={row.employee.department}
                              departmentName={departmentLabel(row.employee.department)}
                              scheduleLabel={scheduleStatusLabel(row.schedule?.status)}
                              run={serializeShiftControlRun(row.run)}
                              workDay={row.workDay ? {
                                status: row.workDay.status,
                                startedAt: row.workDay.startedAt.toISOString(),
                                endedAt: row.workDay.endedAt?.toISOString() ?? null,
                                shiftLabel: row.workDay.shiftLabel,
                                lateMinutes: row.workDay.lateMinutes,
                                comment: row.workDay.comment,
                              } : null}
                              dateKey={selectedDate}
                              autoChecks={row.autoChecks}
                              timingViolations={row.timingViolations}
                              initialOpen={searchParams?.employee === String(row.employee.id)}
                              closeHref={employeeDetailCloseHref}
                              previousEmployee={previousEmployeeRow ? {
                                name: previousEmployeeRow.employee.name,
                                href: employeeDetailHref(previousEmployeeRow.employee.id),
                              } : null}
                              nextEmployee={nextEmployeeRow ? {
                                name: nextEmployeeRow.employee.name,
                                href: employeeDetailHref(nextEmployeeRow.employee.id),
                              } : null}
                            />
                          ) : (
                            <span className='text-xs font-semibold text-slate-400'>Не требуется</span>
                          )}
                        </td>
                        {devWorkdayToolsEnabled && (
                          <td className='px-4 py-2.5'>
                            <div className='flex flex-col gap-2'>
                              {!row.workDay && row.shiftControlRequired && (
                                <DevCreateTestShiftButtons
                                  userId={row.employee.id}
                                  userName={row.employee.name}
                                  department={row.employee.department}
                                  date={selectedDate}
                                />
                              )}
                              {row.shiftControlRequired && row.run && (
                                <DevMakeShiftTasksAvailableButton userId={row.employee.id} userName={row.employee.name} date={selectedDate} />
                              )}
                              <DevResetTodayButton userId={row.employee.id} userName={row.employee.name} date={selectedDate} />
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card className='p-0'>
          <details className='group' open={cashStatementMissingCashboxCount > 0 || Boolean(cashboxMappingMessage)}>
            <summary className='flex cursor-pointer list-none flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <h2 className='text-lg font-extrabold text-slate-950'>Привязка касс 1С</h2>
                <p className='mt-1 text-sm font-medium text-slate-500'>
                  Настройка связки сотрудник → касса 1С. Открывайте только когда нужно поправить привязку.
                </p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <Badge className='w-fit bg-slate-100 text-slate-700'>касс 1С: {cashStatementDimensions.cashboxes.length}</Badge>
                <Badge className={cashStatementMissingCashboxCount > 0 ? 'w-fit bg-amber-100 text-amber-800' : 'w-fit bg-green-100 text-green-800'}>
                  {cashStatementMissingCashboxCount > 0 ? `не привязано: ${cashStatementMissingCashboxCount}` : 'все привязаны'}
                </Badge>
                <span className='text-sm font-extrabold text-slate-500 group-open:hidden'>Открыть</span>
                <span className='hidden text-sm font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
              </div>
            </summary>
            <div className='border-t border-slate-200'>
              {cashboxMappingMessage ? (
                <div className={`border-b px-5 py-3 text-sm font-semibold ${
                  cashboxMappingMessage.tone === 'green'
                    ? 'border-green-100 bg-green-50 text-green-900'
                    : cashboxMappingMessage.tone === 'rose'
                      ? 'border-rose-100 bg-rose-50 text-rose-900'
                      : 'border-amber-100 bg-amber-50 text-amber-900'
                }`}>
                  {cashboxMappingMessage.text}
                </div>
              ) : null}
              {cashboxMappingEmployees.length === 0 ? (
                <div className='px-5 py-4 text-sm font-semibold text-slate-500'>Нет активных сотрудников розницы или опта для привязки касс.</div>
              ) : (
                <div className='overflow-x-auto'>
                  <Table>
                    <thead>
                      <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                        <th className='px-4 py-3'>Сотрудник</th>
                        <th className='px-4 py-3'>Отдел</th>
                        <th className='px-4 py-3'>Касса 1С</th>
                        <th className='px-4 py-3'>Подсказка</th>
                        <th className='px-4 py-3'>Действие</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashboxMappingEmployees.map((employee) => {
                        const searchKey = employeeCashboxSearchKey(employee.name);
                        const suggestedCashbox = searchKey
                          ? cashStatementDimensions.cashboxes.find((item) => normalizeSearchText(item.name).includes(searchKey)) ?? null
                          : null;
                        const mapping = employee.oneCCashboxMapping?.isActive ? employee.oneCCashboxMapping : null;
                        return (
                          <tr key={employee.id} className='border-t border-slate-100 align-top'>
                            <td className='px-4 py-3'>
                              <p className='font-bold text-slate-950'>{employee.name}</p>
                              {!mapping ? <p className='text-xs font-semibold text-amber-700'>Касса 1С не привязана</p> : null}
                            </td>
                            <td className='px-4 py-3 text-sm font-semibold text-slate-600'>{departmentLabel(employee.department)}</td>
                            <td className='px-4 py-3'>
                              <form action='/api/admin/workday/cashbox-mapping' method='post' className='flex min-w-[320px] flex-col gap-2 sm:flex-row'>
                                <input type='hidden' name='userId' value={employee.id} />
                                <input type='hidden' name='redirectTo' value={cashboxMappingRedirectTo} />
                                <select
                                  name='oneCCashboxRef'
                                  defaultValue={mapping?.oneCCashboxRef ?? ''}
                                  className='min-h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                                  disabled={!cashStatementDimensions.ok}
                                >
                                  <option value=''>Не привязана</option>
                                  {cashStatementDimensions.cashboxes.map((cashbox) => (
                                    <option key={cashbox.ref} value={cashbox.ref}>
                                      {cashbox.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type='submit'
                                  className='rounded-lg bg-slate-950 px-3 py-2 text-sm font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300'
                                  disabled={!cashStatementDimensions.ok}
                                >
                                  Сохранить
                                </button>
                              </form>
                            </td>
                            <td className='px-4 py-3 text-sm font-semibold text-slate-500'>
                              {suggestedCashbox ? `Похоже: ${suggestedCashbox.name}` : '—'}
                            </td>
                            <td className='px-4 py-3'>
                              <Badge className={mapping ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                                {mapping ? 'привязана' : 'нужно настроить'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              )}
            </div>
          </details>
        </Card>

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
                    Сверка фактического остатка из сдачи смены с ведомостью денежных средств 1С. Ожидаемый остаток сотруднику не показывается.
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
          {cashStatementRows.length === 0 ? (
            <div className='px-5 py-4 text-sm font-semibold text-slate-500'>Нет активных сотрудников розницы или опта для проверки кассы.</div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <thead>
                  <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                    <th className='px-4 py-2.5'>Сотрудник</th>
                    <th className='px-4 py-2.5'>Факт</th>
                    <th className='px-4 py-2.5'>1С</th>
                    <th className='px-4 py-2.5'>Разница</th>
                    <th className='px-4 py-2.5'>Статус</th>
                    <th className='px-4 py-2.5'>Расчёт</th>
                  </tr>
                </thead>
                <tbody>
                  {cashStatementRows.map((row) => {
                    const difference =
                      row.employeeCash.value !== null && row.result?.ok && row.result.closingBalance !== null
                        ? row.employeeCash.value - row.result.closingBalance
                        : null;
                    const businessStatus = cashBusinessStatus({
                      hasCashbox: Boolean(row.cashbox),
                      result: row.result,
                      employeeCashBalance: row.employeeCash.value,
                    });
                    return (
                      <tr key={row.employee.id} className='border-t border-slate-100 align-middle'>
                        <td className='px-4 py-2.5'>
                          <p className='font-bold text-slate-950'>
                            {row.employee.name}
                            <span className='ml-2 text-xs font-semibold text-slate-400'>{departmentLabel(row.employee.department)}</span>
                          </p>
                          <p className='mt-0.5 text-xs font-semibold text-slate-500'>
                            {row.cashbox?.name ?? 'Касса 1С не привязана'} · {row.scheduleInfo.label}
                          </p>
                          {!row.cashbox && row.suggestedCashbox ? (
                            <p className='mt-0.5 text-xs font-semibold text-amber-700'>Возможная касса: {row.suggestedCashbox.name}</p>
                          ) : null}
                        </td>
                        <td className='whitespace-nowrap px-4 py-2.5 font-extrabold text-slate-950'>
                          {formatMoney(row.employeeCash.value)}
                          {row.employeeCash.isDraft && row.employeeCash.value !== null ? (
                            <p className='mt-0.5 text-xs font-semibold text-amber-700'>черновик</p>
                          ) : null}
                        </td>
                        <td className='whitespace-nowrap px-4 py-2.5 font-extrabold text-slate-950'>
                          {formatMoney(row.result?.closingBalance)}
                          {row.note ? <p className='mt-0.5 max-w-[220px] whitespace-normal text-xs font-semibold text-slate-500'>{row.note}</p> : null}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-2.5 font-extrabold ${
                          difference !== null && Math.abs(difference) > 1 ? 'text-amber-700' : 'text-slate-700'
                        }`}>
                          {formatMoney(difference)}
                        </td>
                        <td className='px-4 py-2.5'>
                          <Badge className={businessStatus.className}>{businessStatus.label}</Badge>
                        </td>
                        <td className='px-4 py-2.5'>
                          <details className='group min-w-[220px]'>
                            <summary className='cursor-pointer list-none text-sm font-extrabold text-slate-700 hover:text-slate-950'>
                              <span className='group-open:hidden'>Расшифровка</span>
                              <span className='hidden group-open:inline'>Скрыть расчёт</span>
                            </summary>
                            <div className='mt-2 grid gap-1 text-xs font-semibold text-slate-600'>
                              <span>На начало: {formatMoney(row.result?.openingBalance)}</span>
                              <span>Приход: <strong className='text-green-700'>{formatMoney(row.result?.incomingTotal)}</strong></span>
                              <span>Расход: <strong className='text-rose-700'>{formatMoney(row.result?.outgoingTotal)}</strong></span>
                              <span>Движений: {row.result?.movementsCount ?? '—'}</span>
                            </div>
                          </details>
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
              Для {cashStatementMissingCashboxCount} сотрудника касса 1С не привязана. Ведомость наличных считается только по явной привязке; подсказки по фамилии не используются как источник данных.
            </div>
          )}
        </Card>

        <Card className='p-0'>
          <div className='flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='flex items-center gap-2'>
              <span className='flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-700'>
                <CreditCard className='h-5 w-5' />
              </span>
              <div>
                <h2 className='text-lg font-extrabold text-slate-950'>Операции терминала</h2>
                <p className='mt-1 text-sm font-medium text-slate-500'>
                  Все проверки операций терминала за день: без новых операций, успешные сверки и обнаруженные расхождения.
                </p>
              </div>
            </div>
            <div className='flex flex-wrap gap-2 text-xs font-bold'>
              <Badge className='bg-green-100 text-green-800'>выполнено: {acquiringDoneCount}/{acquiringTaskRows.length}</Badge>
              <Badge className='bg-slate-100 text-slate-700'>новых операций не было: {acquiringNoPaymentsCount}</Badge>
              <Badge className={acquiringDiscrepancyCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'}>
                расхождений: {acquiringDiscrepancyCount}
              </Badge>
              <Badge className={acquiringPendingCount > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
                проверить: {acquiringPendingCount}
              </Badge>
            </div>
          </div>
          {acquiringTaskRows.length === 0 ? (
            <div className='px-5 py-4 text-sm font-semibold text-slate-500'>Нет сотрудников с чек-листом смены для контроля операций терминала.</div>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <thead>
                  <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                    <th className='px-4 py-2.5'>Сотрудник</th>
                    <th className='px-4 py-2.5'>График и смена</th>
                    <th className='px-4 py-2.5'>Результат</th>
                    <th className='px-4 py-2.5'>Что проверить</th>
                  </tr>
                </thead>
                <tbody>
                  {acquiringTaskRows.map((row) => (
                    <tr key={row.task.id} className='border-t border-slate-100 align-middle'>
                      <td className='px-4 py-2.5'>
                        <p className='font-bold text-slate-950'>
                          {row.employee.name}
                          <span className='ml-2 text-xs font-semibold text-slate-400'>{departmentLabel(row.employee.department)}</span>
                        </p>
                      </td>
                      <td className='px-4 py-2.5'>
                        <Badge className={scheduleClass(row.schedule?.status)}>{scheduleStatusLabel(row.schedule?.status)}</Badge>
                        <span className='ml-2 text-sm font-semibold text-slate-600'>{row.workDay?.shiftLabel ?? '—'}</span>
                      </td>
                      <td className='px-4 py-2.5'>
                        <Badge className={row.status.className}>{row.status.label}</Badge>
                        {row.task?.status === 'done' && row.task.completedAt ? (
                          <span className='ml-2 text-xs font-semibold text-slate-400'>{formatTime(row.task.completedAt)}</span>
                        ) : null}
                      </td>
                      <td className={`max-w-[360px] px-4 py-2.5 text-sm font-semibold ${row.status.problem ? 'text-amber-800' : 'text-slate-600'}`}>
                        {row.task?.comment || (row.status.problem ? 'Нужно проверить' : '—')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
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

      </div>
    </AdminShell>
  );
}
