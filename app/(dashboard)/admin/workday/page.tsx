import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, Banknote, CreditCard } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { getAdminWorkdayRevision } from '@/lib/admin-workday-revision';
import { adminWorkdayControlFilter, isActiveWorkdayTimingViolation, matchesAdminWorkdayControlFilter, resolveAdminWorkdayControlCategory, type AdminWorkdayControlCategory, type AdminWorkdayControlFilter } from '@/lib/admin-workday-view';
import { getCurrentUser } from '@/lib/auth';
import { readKkmShiftCloseSimulation } from '@/lib/kkm-shift-close-control';
import { oneCDateTimestamp, parseOneCDateTime } from '@/lib/one-c-date';
import {
  DEFAULT_SALES_REALIZATIONS_PARAMS,
  getCashStatementDimensions,
  getCashStatementSummary,
  getCashShifts,
  getKkmEquipmentDiagnostics,
  getSalesRealizationFiscalOperations,
  getSalesRealizations,
  type OneCCashStatementSummaryResult,
  type OneCCashShift,
  type OneCCashShiftsResult,
  type OneCKkmEquipmentDiagnosticsResult,
  type OneCSalesRealizationDocument,
  type OneCSalesRealizationFiscalOperationsResult,
} from '@/lib/one-c';
import { prisma } from '@/lib/prisma';
import { shiftControlOneCAuditKey } from '@/lib/shift-control-one-c-audit';
import { attributeTerminalFiscalRecordsToEmployees, getTerminalFiscalWorkdaySummary, presentTerminalFiscalEmployeeControl, presentTerminalFiscalWorkdaySummary } from '@/lib/terminal-fiscal-summary';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { evaluateWorkdayTiming } from '@/lib/workday-timing';
import type { WorkdayTimingViolation } from '@/lib/workday-timing';
import { departmentLabel, formatDateLabel, formatTime, getMoscowDateKey, getMoscowMinutes, getShiftOptionsForDepartment, scheduleStatusLabel, usesWorkdayShiftControl } from '@/lib/workday';
import { AdminWorkdayAutoRefresh } from './AdminWorkdayAutoRefresh';
import { AdminShiftControlDetails, type ShiftAutoCheck, type ShiftAutoCheckManualReview } from './AdminShiftControlDetails';
import { DevCreateTestShiftButtons } from './DevCreateTestShiftButtons';
import { DevMakeShiftTasksAvailableButton } from './DevMakeShiftTasksAvailableButton';
import { DevKkmCloseScenarioControl } from './DevKkmCloseScenarioControl';
import { DevResetTodayButton } from './DevResetTodayButton';
import { TerminalFiscalAdminSummary } from './TerminalFiscalAdminSummary';
import { WorkdayQrCodes } from './WorkdayQrCodes';

export const dynamic = 'force-dynamic';

const devWorkdayToolsEnabled = process.env.ENABLE_DEV_WORKDAY_TOOLS === 'true';
const reserveCashboxSearchName = 'резерв под телефоны';
const depositSafeCashboxSearchName = 'сейф депозитный';
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

type KkmAssignmentInterval = {
  oneCCashRegisterRef: string | null;
  oneCCashRegisterName: string | null;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

function assignmentAt(assignments: KkmAssignmentInterval[], moment: Date | null) {
  if (!moment) return assignments.at(-1) ?? null;
  return assignments.find((assignment) => assignment.effectiveFrom <= moment && (!assignment.effectiveTo || assignment.effectiveTo > moment)) ?? null;
}

type TbankSalesForDate = {
  ok: boolean;
  documents: OneCSalesRealizationDocument[];
  fiscalByRealization: Record<string, OneCSalesRealizationFiscalOperationsResult>;
  error?: string;
};

function scheduleClass(status: string | undefined) {
  if (status === 'working') return 'bg-green-100 text-green-800';
  if (status === 'off') return 'bg-slate-100 text-slate-700';
  return 'bg-amber-100 text-amber-800';
}

function shiftState(workDay: { status: string; endedAt: Date | null } | null | undefined, scheduleStatus?: string) {
  if (workDay?.endedAt || workDay?.status === 'completed') {
    return { label: 'Завершил смену', className: 'bg-slate-100 text-slate-700' };
  }
  if (workDay) return { label: 'Работает', className: 'bg-green-100 text-green-800' };
  if (scheduleStatus === 'off') return { label: 'Выходной', className: 'bg-slate-50 text-slate-500 ring-1 ring-slate-200' };
  return { label: 'Не начал', className: 'bg-white text-slate-600 ring-1 ring-slate-200' };
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

function moscowDayRange(dateKey: string) {
  return {
    periodFrom: new Date(`${dateKey}T00:00:00+03:00`),
    periodTo: new Date(`${addDays(dateKey, 1)}T00:00:00+03:00`),
  };
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function formatRealizationCount(count: number) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  const noun = mod100 >= 11 && mod100 <= 14
    ? 'реализаций'
    : mod10 === 1
      ? 'реализация'
      : mod10 >= 2 && mod10 <= 4
        ? 'реализации'
        : 'реализаций';

  return `${count} ${noun}`;
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

function cashShiftMatchesEmployee(shift: OneCCashShift, employeeName: string) {
  const employeeKey = employeeOneCSearchKey(employeeName);
  return Boolean(employeeKey) && shift.cashiers.some((item) => (
    normalizeSearchText(item.cashier.name).includes(employeeKey)
  ));
}

function factualCashRegisterRefs(shifts: OneCCashShift[], employeeName: string) {
  return [...new Set(
    shifts
      .filter((shift) => cashShiftMatchesEmployee(shift, employeeName))
      .map((shift) => shift.cashRegister.ref)
      .filter(Boolean),
  )];
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
    if (!result.ok) return { ok: false, documents, fiscalByRealization: {}, error: result.error ?? result.diagnostics.join('; ') };

    documents.push(...result.documents);
    if (result.responseDocumentCount < limit) break;
  }

  const fiscalByRealization: Record<string, OneCSalesRealizationFiscalOperationsResult> = {};
  for (let index = 0; index < documents.length; index += 4) {
    const batch = documents.slice(index, index + 4);
    const results = await Promise.all(batch.map((document) => getSalesRealizationFiscalOperations(document.ref)));
    results.forEach((result) => {
      fiscalByRealization[result.realizationRef] = result;
    });
  }

  return { ok: true, documents, fiscalByRealization };
}

function kkmUsageForEmployee({
  result,
  cashboxName,
  cashRegisterRef,
  kkmMode,
}: {
  result: OneCKkmEquipmentDiagnosticsResult;
  cashboxName: string;
  cashRegisterRef: string | null;
  kkmMode: string;
}) {
  if (kkmMode === 'personal') {
    if (!cashRegisterRef) return [];
    return result.cashRegisterUsage.filter((row) => row.cashRegister.ref === cashRegisterRef);
  }
  return result.cashRegisterUsage.filter((row) => matchesExplicitCashbox(cashboxName, row.cashRegister.name));
}

function selectPersonalCashShift(shifts: OneCCashShift[], task: AutoCheckTask) {
  const taskTime = task.completedAt?.getTime() ?? null;
  const eventTime = (shift: OneCCashShift) => {
    const value = task.category === 'closing'
      ? shift.closedAt || shift.datetime
      : shift.openedAt || shift.datetime;
    const parsed = value ? new Date(value).getTime() : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };

  return [...shifts].sort((left, right) => {
    const leftTime = eventTime(left);
    const rightTime = eventTime(right);
    if (taskTime !== null) {
      const leftDistance = leftTime === null ? Number.POSITIVE_INFINITY : Math.abs(leftTime - taskTime);
      const rightDistance = rightTime === null ? Number.POSITIVE_INFINITY : Math.abs(rightTime - taskTime);
      if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    }
    return (rightTime ?? 0) - (leftTime ?? 0);
  })[0] ?? null;
}

function findEncashmentPair({
  personal,
  target,
  amount,
  cutoff,
  expenseDocumentRef,
  receiptDocumentRef,
}: {
  personal: OneCCashStatementSummaryResult | null;
  target: OneCCashStatementSummaryResult | null;
  amount: number;
  cutoff: Date | null;
  expenseDocumentRef?: string | null;
  receiptDocumentRef?: string | null;
}) {
  if (!personal?.ok || !target?.ok) return null;
  const cutoffTimestamp = cutoff?.getTime() ?? Number.POSITIVE_INFINITY;
  const outgoing = personal.movements.filter((movement) => {
    const timestamp = oneCDateTimestamp(movement.period);
    return timestamp !== null && timestamp <= cutoffTimestamp && Math.abs((movement.outgoing ?? 0) - amount) <= oneCMoneyTolerance;
  });
  const incoming = target.movements.filter((movement) => {
    const timestamp = oneCDateTimestamp(movement.period);
    return timestamp !== null && timestamp <= cutoffTimestamp && Math.abs((movement.incoming ?? 0) - amount) <= oneCMoneyTolerance;
  });

  let timeMatched = false;
  for (const expense of outgoing) {
    for (const receipt of incoming) {
      if (
        expenseDocumentRef
        && receiptDocumentRef
        && expense.document.ref === expenseDocumentRef
        && receipt.document.ref === receiptDocumentRef
      ) return 'exact';
      if (expense.document.ref && receipt.document.ref && expense.document.ref === receipt.document.ref) return 'exact';
      const expenseTimestamp = oneCDateTimestamp(expense.period);
      const receiptTimestamp = oneCDateTimestamp(receipt.period);
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
  if (error === 'kkm-not-found') return { tone: 'rose', text: 'Не удалось сохранить: ККМ не найдена в текущих данных 1С.' };
  if (error === 'terminal-not-found') return { tone: 'rose', text: 'Не удалось сохранить: терминал 1С не найден в текущих данных.' };
  if (error === 'cashier-not-found') return { tone: 'rose', text: 'Не удалось сохранить: кассир 1С не найден в чеках выбранного дня.' };
  return null;
}

function buildEmployeeAutoChecks({
  employeeName,
  department,
  tasks,
  cashboxName,
  cashRegisterRef,
  kkmAssignments,
  kkmMode,
  cashStatement,
  reserveCashboxName,
  reserveStatement,
  depositSafeCashboxName,
  depositSafeStatement,
  cashOperations,
  kkmDiagnostics,
  cashShifts,
  tbankSales,
}: {
  employeeName: string;
  department: string;
  tasks: AutoCheckTask[];
  cashboxName: string | null;
  cashRegisterRef: string | null;
  kkmAssignments: KkmAssignmentInterval[];
  kkmMode: string;
  cashStatement: OneCCashStatementSummaryResult | null;
  reserveCashboxName: string | null;
  reserveStatement: OneCCashStatementSummaryResult | null;
  depositSafeCashboxName: string | null;
  depositSafeStatement: OneCCashStatementSummaryResult | null;
  cashOperations: Array<{
    id: number;
    idempotencyKey: string;
    direction: string;
    amount: number;
    status: string;
    oneCError: string;
    oneCDocumentRef: string | null;
    oneCReceiptDocumentRef: string | null;
  }>;
  kkmDiagnostics: OneCKkmEquipmentDiagnosticsResult;
  cashShifts: OneCCashShiftsResult;
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
    ? kkmUsageForEmployee({ result: kkmDiagnostics, cashboxName, cashRegisterRef, kkmMode })
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
          summary: snapshot?.error || 'Остаток 1С на момент проверки не был сохранён.',
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
        evidence: `Остаток 1С на момент проверки: ${formatMoney(snapshot.balance)}${snapshot.capturedAt ? ` · зафиксирован в ${formatTime(new Date(snapshot.capturedAt))}` : ''}.`,
      }));
      continue;
    }

    if (task.category === 'credit') {
      if (task.status !== 'done') {
        checks.push({
          id: `credit-${task.id}`,
          taskId: task.id,
          label: 'Кредиты и рассрочки',
          status: 'waiting',
          summary: 'Сотрудник ещё не завершил проверку.',
        });
        continue;
      }
      if (!tbankSales.ok) {
        checks.push({
          id: `credit-${task.id}`,
          taskId: task.id,
          label: 'Кредиты и рассрочки',
          status: 'unavailable',
          summary: tbankSales.error || 'Реализации 1С не получены.',
        });
        continue;
      }

      const cutoffTimestamp = cutoff?.getTime() ?? Number.POSITIVE_INFINITY;
      const matchedDocuments = employeeTbankDocuments.filter((document) => {
        const timestamp = oneCDateTimestamp(document.date);
        return timestamp !== null && timestamp <= cutoffTimestamp;
      });
      const declaredOperations = task.integerValue === 1 || task.integerValue === 2;
      const oneCHasOperations = matchedDocuments.length > 0;

      if (!oneCHasOperations && tbankSales.documents.length > 0) {
        checks.push({
          id: `credit-${task.id}`,
          taskId: task.id,
          label: 'Кредиты и рассрочки',
          status: 'unavailable',
          summary: `По имени сотрудника документы не найдены; всего по партнёру Т-Банка за день: ${tbankSales.documents.length}.`,
          evidence: 'Сопоставление выполняется по имени менеджера в реализации 1С.',
        });
        continue;
      }

      const matchedAmount = matchedDocuments.reduce((sum, document) => sum + (document.amount ?? 0), 0);

      if (oneCHasOperations) {
        const fiscalResults = matchedDocuments.map((document) => ({
          document,
          result: tbankSales.fiscalByRealization[document.ref],
        }));
        const unavailableFiscal = fiscalResults.find(({ result }) => !result?.ok);
        if (unavailableFiscal) {
          checks.push({
            id: `credit-${task.id}`,
            taskId: task.id,
            label: 'Кредиты и рассрочки',
            status: 'unavailable',
            summary: `Реализации найдены, но фискальные операции 1С не получены для ${unavailableFiscal.document.number || 'одного документа'}.`,
            evidence: unavailableFiscal.result?.error || 'Нет ответа нового read-only endpoint 1С.',
          });
          continue;
        }

        const withoutCheck = fiscalResults.filter(({ result }) => !result.fiscalized);
        if (withoutCheck.length > 0) {
          checks.push({
            id: `credit-${task.id}`,
            taskId: task.id,
            label: 'Кредиты и рассрочки',
            status: 'mismatch',
            summary: `Фискальный чек не найден: ${withoutCheck.map(({ document }) => document.number).join(', ')}.`,
            evidence: 'Проверено по прямой связи реализации с регистром ФискальныеОперации 1С.',
          });
          continue;
        }

        const ambiguousFiscal = fiscalResults.find(({ result }) => result.operations.filter((operation) => operation.fiscalized).length !== 1);
        if (ambiguousFiscal) {
          checks.push({
            id: `credit-${task.id}`,
            taskId: task.id,
            label: 'Кредиты и рассрочки',
            status: 'unavailable',
            summary: `По реализации ${ambiguousFiscal.document.number} найдено несколько фискальных операций — требуется проверка.`,
            evidence: 'Автоматическая сверка не выбирает чек при неоднозначной прямой связи.',
          });
          continue;
        }

        const fiscalMismatch = fiscalResults.find(({ document, result }) => {
          const operation = result.operations.find((item) => item.fiscalized);
          const realizationAmount = document.amount ?? 0;
          return !operation
            || operation.amount === null
            || Math.abs(operation.amount - realizationAmount) > oneCMoneyTolerance
            || operation.postpayment === null
            || Math.abs(operation.postpayment - realizationAmount) > oneCMoneyTolerance;
        });
        if (fiscalMismatch) {
          const operation = fiscalMismatch.result.operations.find((item) => item.fiscalized);
          checks.push({
            id: `credit-${task.id}`,
            taskId: task.id,
            label: 'Кредиты и рассрочки',
            status: 'mismatch',
            summary: `Реализация ${formatMoney(fiscalMismatch.document.amount)} · чек ${formatMoney(operation?.amount)} · постоплата ${formatMoney(operation?.postpayment)}.`,
            evidence: `Реализация ${fiscalMismatch.document.number} · чек №${operation?.checkNumber || '—'} · прямая связь 1С.`,
          });
          continue;
        }
      }

      const checkNumbers = matchedDocuments.flatMap((document) => (
        tbankSales.fiscalByRealization[document.ref]?.operations
          .filter((operation) => operation.fiscalized)
          .map((operation) => operation.checkNumber)
          ?? []
      ));
      checks.push({
        id: `credit-${task.id}`,
        taskId: task.id,
        label: 'Кредиты и рассрочки',
        status: declaredOperations === oneCHasOperations ? 'matched' : 'mismatch',
        summary: oneCHasOperations
          ? `1С: ${formatRealizationCount(matchedDocuments.length)} на ${formatMoney(matchedAmount)} · чеки ${checkNumbers.map((number) => `№${number}`).join(', ')}; сотрудник ${declaredOperations ? 'подтвердил операции' : 'указал, что операций не было'}.`
          : `В 1С операций до момента проверки нет; сотрудник ${declaredOperations ? 'подтвердил операции' : 'указал, что операций не было'}.`,
        evidence: oneCHasOperations
          ? 'Реализации сопоставлены по партнёру, дате и менеджеру; чеки — по прямой связи с регистром ФискальныеОперации 1С.'
          : 'Сопоставление по партнёру, дате и имени менеджера 1С.',
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
      } else if (kkmMode === 'personal' && cashShifts.ok) {
        const taskAssignment = assignmentAt(kkmAssignments, task.completedAt)
          ?? (task.category === 'opening' ? kkmAssignments[0] : kkmAssignments.at(-1))
          ?? null;
        const taskCashRegisterRef = taskAssignment?.oneCCashRegisterRef ?? cashRegisterRef;
        const factualRefs = factualCashRegisterRefs(cashShifts.shifts, employeeName);
        const personalShifts = cashShifts.shifts.filter((shift) => (
          (taskCashRegisterRef
            ? shift.cashRegister.ref === taskCashRegisterRef
            : factualRefs.includes(shift.cashRegister.ref) && cashShiftMatchesEmployee(shift, employeeName))
          && shift.posted !== false
          && shift.deletionMark !== true
        ));
        const cashShift = selectPersonalCashShift(personalShifts, task);
        const opened = Boolean(cashShift?.openedAt) && Boolean(cashShift?.status);
        const closed = Boolean(cashShift?.closedAt) && normalizeSearchText(cashShift?.status).includes('закрыт');
        const matched = task.category === 'opening' ? opened : closed;
        const canIdentifyKkm = Boolean(taskCashRegisterRef) || factualRefs.length > 0;
        checks.push({
          id: `${task.category}-${task.id}`,
          taskId: task.id,
          label,
          status: matched ? 'matched' : canIdentifyKkm ? 'mismatch' : 'unavailable',
          summary: matched
            ? task.category === 'opening'
              ? `Персональная смена ККМ открыта ${formatTime(cashShift?.openedAt)} · ККМ ${cashShift?.cashRegister.name}.`
              : `Персональная смена ККМ закрыта ${formatTime(cashShift?.closedAt)} · статус «${cashShift?.status}».`
            : task.category === 'opening'
              ? taskCashRegisterRef || factualRefs.length > 0
                ? 'Для определённой ККМ сотрудника открытая кассовая смена не найдена.'
                : 'До первого чека ККМ сотрудника автоматически определить нельзя.'
              : taskCashRegisterRef || factualRefs.length > 0
                ? 'Для определённой ККМ сотрудника закрытие смены не подтверждено.'
                : 'ККМ сотрудника по фактическим чекам не определена.',
          evidence: cashShift
            ? `Смена ${cashShift.number || cashShift.ref} · статус регламентных операций: ${cashShift.regulatoryStatus || 'не указан'} · кассиры по чекам: ${cashShift.cashiers.map((item) => item.cashier.name).filter(Boolean).join(', ') || 'чеков ещё нет'}.`
            : taskCashRegisterRef
              ? 'Проверка выполнена по резервному назначению ККМ на смену.'
              : 'Фактическая ККМ определяется по кассиру в чеках 1С.',
        });
      } else if (!kkmDiagnostics.ok || !cashboxName) {
        checks.push({
          id: `${task.category}-${task.id}`,
          taskId: task.id,
          label,
          status: 'unavailable',
          summary: !cashboxName
            ? 'Касса сотрудника не привязана.'
            : kkmDiagnostics.error || 'Данные ККМ 1С не получены.',
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
        ? `Остаток 1С на момент проверки: ${formatMoney(personalCashAudit.balance)}${personalCashAudit.capturedAt ? ` · зафиксирован в ${formatTime(new Date(personalCashAudit.capturedAt))}` : ''}.`
        : 'Снимок при сдаче смены отсутствует; используется конечный остаток 1С за день.',
    }));
    if (reserveCash) checks.push(moneyAutoCheck({
      id: `handover-reserve-${task.id}`,
      taskId: task.id,
      label: 'Пересчёт резерва',
      actual: readNumber(reserveCash.cashBalance),
      expected: expectedReserveCash,
      evidence: reserveCashAudit?.status === 'captured'
        ? `Остаток резерва 1С на момент проверки: ${formatMoney(reserveCashAudit.balance)}${reserveCashAudit.capturedAt ? ` · зафиксирован в ${formatTime(new Date(reserveCashAudit.capturedAt))}` : ''}.`
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

    const requiresEncashment = personalCash ? readBoolean(personalCash.requiresEncashment) : null;
    const encashmentAmount = personalCash ? readNumber(personalCash.encashmentAmount) : null;
    const encashmentExceptionRequestId = personalCash ? readText(personalCash.encashmentExceptionRequestId) : '';
    const savedEncashmentDirection = personalCash ? readText(personalCash.encashmentDirection) : '';
    const encashmentDirection = savedEncashmentDirection === 'deposit_safe' || department !== 'retail'
      ? 'deposit_safe'
      : 'phone_reserve';
    const targetCashboxName = encashmentDirection === 'deposit_safe' ? depositSafeCashboxName : reserveCashboxName;
    const targetStatement = encashmentDirection === 'deposit_safe' ? depositSafeStatement : reserveStatement;
    const targetShortLabel = encashmentDirection === 'deposit_safe' ? 'депозитный сейф' : 'резерв';
    const encashmentLabel = `Инкассация в ${targetShortLabel}`;
    const handoverOperationKeys = new Set([
      `h${task.id}`,
      `00000000-0000-4000-8000-${task.id.toString(16).padStart(12, '0')}`,
    ]);
    for (const operation of cashOperations.filter((item) => ['one_c_error', 'manual_in_progress', 'retrying_1c'].includes(item.status) && !handoverOperationKeys.has(item.idempotencyKey))) {
      const operationTarget = operation.direction === 'deposit_safe' ? 'депозитный сейф' : 'резерв';
      const operationState = operation.status === 'manual_in_progress'
        ? 'Операцию взял в ручную администратор.'
        : operation.status === 'retrying_1c'
          ? 'Портал повторно проводит документы в 1С.'
          : 'Можно повторить автоматически или взять проведение в ручную.';
      checks.push({
        id: `cash-operation-${operation.id}-${task.id}`,
        taskId: task.id,
        label: `Дневная инкассация в ${operationTarget}`,
        status: 'unavailable',
        summary: `${formatMoney(operation.amount)}. Инкассация зафиксирована, но документы 1С не проведены. ${operationState}`,
        evidence: operation.oneCError || '1С не вернула подтверждение проведения связанной пары документов.',
        cashOperation: { id: operation.id, status: operation.status },
      });
    }
    if (requiresEncashment === false) {
      if (!cashStatement?.ok || !targetStatement?.ok) {
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: encashmentLabel,
          status: 'unavailable',
          summary: `Движения своей кассы или кассы «${targetCashboxName ?? targetShortLabel}» в 1С не получены.`,
        });
      } else {
        const exactAmounts = findExactEncashmentAmounts({
          personal: cashStatement,
          reserve: targetStatement,
        });
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: encashmentLabel,
          status: exactAmounts.length > 0 ? 'mismatch' : 'matched',
          summary: exactAmounts.length > 0
            ? `Сотрудник указал, что инкассации не было, но в 1С найдено парное движение касса → ${targetShortLabel} на ${exactAmounts.map(formatMoney).join(', ')}.`
            : `Сотрудник указал, что инкассации не было; парных движений касса → ${targetShortLabel} в 1С не найдено.`,
        });
      }
    } else if (requiresEncashment) {
      if (encashmentAmount === null) {
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: encashmentLabel,
          status: encashmentExceptionRequestId && task.status === 'done' ? 'matched' : 'waiting',
          summary: encashmentExceptionRequestId && task.status === 'done'
            ? 'Администратор разрешил завершить рабочий день без инкассации. Исключение сохранено для контроля.'
            : 'Сумма инкассации не указана; ожидается решение администратора.',
        });
      } else if (!cashStatement?.ok || !targetStatement?.ok) {
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: encashmentLabel,
          status: 'unavailable',
          summary: `Движения своей кассы или кассы «${targetCashboxName ?? targetShortLabel}» в 1С не получены.`,
        });
      } else {
        const failedCashOperation = cashOperations.find((operation) => (
          handoverOperationKeys.has(operation.idempotencyKey)
          && operation.direction === encashmentDirection
          && ['one_c_error', 'manual_in_progress', 'retrying_1c'].includes(operation.status)
          && Math.abs(operation.amount - encashmentAmount) <= oneCMoneyTolerance
        ));
        const postedCashOperation = cashOperations.find((operation) => (
          handoverOperationKeys.has(operation.idempotencyKey)
          && operation.direction === encashmentDirection
          && operation.status === 'posted_1c_pair'
          && Math.abs(operation.amount - encashmentAmount) <= oneCMoneyTolerance
        ));
        const pairMatch = findEncashmentPair({
          personal: cashStatement,
          target: targetStatement,
          amount: encashmentAmount,
          cutoff: null,
          expenseDocumentRef: postedCashOperation?.oneCDocumentRef,
          receiptDocumentRef: postedCashOperation?.oneCReceiptDocumentRef,
        });
        checks.push({
          id: `handover-encashment-${task.id}`,
          taskId: task.id,
          label: encashmentLabel,
          status: failedCashOperation ? 'unavailable' : pairMatch === 'exact' ? 'matched' : pairMatch === 'time' ? 'unavailable' : 'mismatch',
          summary: failedCashOperation
            ? `Сотрудник выполнил инкассацию, но 1С не провела документы. Администратор уведомлён: ${failedCashOperation.oneCError || 'требуется ручное проведение'}.`
            : pairMatch === 'exact'
            ? `В 1С подтверждены проведённые РКО и ПКО: касса → ${targetShortLabel} на ${formatMoney(encashmentAmount)}.`
            : pairMatch === 'time'
              ? `Найдены расход и приход на ${formatMoney(encashmentAmount)} рядом по времени, но связь пары документов 1С не подтверждена.`
              : `Парное движение касса → ${targetShortLabel} на ${formatMoney(encashmentAmount)} в 1С не найдено.`,
          evidence: 'Проверяется учётное движение; физическое помещение денег подтверждается сотрудником и фото.',
          cashOperation: failedCashOperation ? { id: failedCashOperation.id, status: failedCashOperation.status } : undefined,
        });
      }
    }

    if (storeClosing && department === 'retail') {
      const closingAssignment = assignmentAt(kkmAssignments, task.completedAt) ?? kkmAssignments.at(-1) ?? null;
      const closingCashRegisterRef = closingAssignment?.oneCCashRegisterRef ?? cashRegisterRef;
      const factualRefs = factualCashRegisterRefs(cashShifts.shifts, employeeName);
      const assignedShift = kkmMode === 'personal' && cashShifts.ok
        ? selectPersonalCashShift(cashShifts.shifts.filter((shift) => (
          (closingCashRegisterRef
            ? shift.cashRegister.ref === closingCashRegisterRef
            : factualRefs.includes(shift.cashRegister.ref) && cashShiftMatchesEmployee(shift, employeeName))
          && shift.posted !== false
          && shift.deletionMark !== true
        )), task)
        : null;
      const closed = Boolean(assignedShift?.closedAt) && normalizeSearchText(assignedShift?.status ?? '').includes('закрыт');
      const checksCount = kkmUsage.reduce((sum, row) => sum + (row.checks ?? 0), 0);
      checks.push({
        id: `handover-z-report-${task.id}`,
        taskId: task.id,
        label: 'Закрытие смены ККМ',
        status: assignedShift ? (closed ? 'matched' : 'mismatch') : 'unavailable',
        summary: assignedShift
          ? closed
            ? `Назначенная ККМ закрыта ${formatTime(assignedShift.closedAt || assignedShift.datetime)} · статус «${assignedShift.status}».`
            : `Смена назначенной ККМ не закрыта · статус «${assignedShift.status || 'не указан'}».`
          : kkmMode === 'personal'
            ? 'Фактическая ККМ по чекам ещё не определена или данные её смены недоступны.'
            : kkmDiagnostics.ok && cashboxName
              ? `Серверная ККМ: в 1С за день найдено чеков ${checksCount}; прямое подтверждение закрытия недоступно.`
              : 'Данные серверной ККМ 1С не получены.',
        evidence: assignedShift ? `Смена ${assignedShift.number || assignedShift.ref} · ККМ ${assignedShift.cashRegister.name} · регламентные операции: ${assignedShift.regulatoryStatus || 'не указаны'}.` : undefined,
      });
    }
  }

  if (kkmMode === 'personal' && kkmAssignments.length > 0 && tasks[0] && kkmDiagnostics.ok) {
    const employeeKey = employeeOneCSearchKey(employeeName);
    const isEmployee = (cashierName: string) => Boolean(employeeKey) && normalizeSearchText(cashierName).includes(employeeKey);
    const employeeChecks = kkmDiagnostics.recentChecks.filter((check) => isEmployee(check.cashier.name));
    const employeeChecksOnOtherKkm = employeeChecks.filter((check) => {
      const assigned = assignmentAt(kkmAssignments, parseOneCDateTime(check.datetime));
      return Boolean(assigned) && check.cashRegister.ref !== assigned?.oneCCashRegisterRef;
    });
    const otherCashiersOnAssignedKkm = kkmDiagnostics.recentChecks.filter((check) => {
      const assigned = assignmentAt(kkmAssignments, parseOneCDateTime(check.datetime));
      return Boolean(assigned) && check.cashRegister.ref === assigned?.oneCCashRegisterRef && !isEmployee(check.cashier.name);
    });
    const hasConflict = employeeChecksOnOtherKkm.length > 0 || otherCashiersOnAssignedKkm.length > 0;
    checks.push({
      id: `kkm-assignment-${tasks[0].id}`,
      taskId: tasks[0].id,
      label: 'Фактическая работа на ККМ',
      status: hasConflict ? 'mismatch' : employeeChecks.length > 0 ? 'matched' : 'waiting',
      summary: hasConflict
        ? `Нарушена сменная привязка: чеков сотрудника на другой ККМ — ${employeeChecksOnOtherKkm.length}; чеков других кассиров на назначенной ККМ — ${otherCashiersOnAssignedKkm.length}.`
        : employeeChecks.length > 0
          ? `Сотрудник пробил ${employeeChecks.length} чеков только на назначенной ККМ.`
          : 'Чеков сотрудника пока нет; назначение проверится после первой фискальной операции.',
      evidence: `Интервалов назначения за день: ${kkmAssignments.length}. Проверка выполнена по времени чека, UUID ККМ и кассиру.`,
    });
  }

  return checks;
}

export default async function AdminWorkdayPage({ searchParams }: { searchParams?: { date?: string; cashboxMapping?: string; cashboxMappingError?: string; kkmAssignment?: string; kkmAssignmentError?: string; control?: string; employee?: string; technical?: string } }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const today = getMoscowDateKey();
  const selectedDate = isDateKey(searchParams?.date) ? searchParams.date : today;
  const selectedControlFilter = adminWorkdayControlFilter(searchParams?.control, selectedDate === today ? 'active' : 'all');
  const previousDate = addDays(selectedDate, -1);
  const nextDate = addDays(selectedDate, 1);
  const selectedDayRange = moscowDayRange(selectedDate);
  const [employees, schedules, workDays, shiftControlRuns, unfinishedWorkDays, cashStatementDimensions, liveRevision, kkmAssignments, terminalFiscalSummary, requiredIssues, lateCreditReceipts, cashOperations] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'EMPLOYEE', isActive: true },
      orderBy: [{ department: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        login: true,
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
    prisma.workdayKkmAssignment.findMany({
      where: { date: selectedDate },
      include: { assignedBy: { select: { name: true } } },
      orderBy: { effectiveFrom: 'asc' },
    }),
    getTerminalFiscalWorkdaySummary(moscowDayRange(selectedDate)),
    prisma.workdayControlIssue.findMany({
      where: { status: 'open', employeeActionRequired: true, ...(selectedDate === today ? {} : { originDate: selectedDate }) },
      include: { user: { select: { name: true } } },
      orderBy: [{ severity: 'desc' }, { detectedAt: 'asc' }],
    }),
    prisma.creditRealizationControlCase.findMany({
      where: {
        realizationAt: { gte: selectedDayRange.periodFrom, lt: selectedDayRange.periodTo },
        receiptDelayMinutes: { gt: 15 },
      },
      select: { id: true, documentNumber: true, receiptDelayMinutes: true, receiptCashierName: true },
      orderBy: { realizationAt: 'asc' },
    }),
    prisma.cashOperation.findMany({
      where: { date: selectedDate },
      select: {
        id: true,
        idempotencyKey: true,
        userId: true,
        direction: true,
        amount: true,
        status: true,
        oneCError: true,
        oneCDocumentRef: true,
        oneCReceiptDocumentRef: true,
      },
    }),
  ]);

  const scheduleByUser = new Map(schedules.map((entry) => [entry.userId, entry]));
  const workDayByUser = new Map(workDays.map((entry) => [entry.userId, entry]));
  const shiftControlRunByUser = new Map(shiftControlRuns.map((run) => [run.userId, run]));
  const requiredIssuesByUser = new Map<number, typeof requiredIssues>();
  for (const issue of requiredIssues) {
    requiredIssuesByUser.set(issue.userId, [...(requiredIssuesByUser.get(issue.userId) ?? []), issue]);
  }
  const activeKkmAssignments = kkmAssignments.filter((assignment) => !assignment.effectiveTo);
  const kkmAssignmentByUser = new Map(activeKkmAssignments.map((assignment) => [assignment.userId, assignment]));
  const terminalFiscalAttribution = attributeTerminalFiscalRecordsToEmployees(
    terminalFiscalSummary?.attributionRecords ?? [],
    employees.flatMap((employee) => employee.oneCCashboxMapping?.isActive && employee.oneCCashboxMapping.oneCCashierRef
      ? [{ userId: employee.id, oneCCashierRef: employee.oneCCashboxMapping.oneCCashierRef }]
      : []),
  );
  const nowMinutes = selectedDate === today ? getMoscowMinutes() : selectedDate < today ? 24 * 60 : 0;
  const cashStatementOrganization =
    cashStatementDimensions.organizations.find((organization) => normalizeSearchText(organization.name).includes('оффоника'))
    ?? cashStatementDimensions.organizations[0]
    ?? null;
  const reserveCashbox =
    cashStatementDimensions.cashboxes.find((cashbox) => normalizeSearchText(cashbox.name) === reserveCashboxSearchName)
    ?? null;
  const depositSafeCashbox =
    cashStatementDimensions.cashboxes.find((cashbox) => normalizeSearchText(cashbox.name) === depositSafeCashboxSearchName)
    ?? null;
  const [kkmDiagnostics, cashShifts, tbankSales, reserveStatement, depositSafeStatement] = await Promise.all([
    getKkmEquipmentDiagnostics({ dateFrom: selectedDate, dateTo: selectedDate, limit: 300 }),
    getCashShifts(selectedDate),
    getTbankSalesForDate(selectedDate),
    cashStatementDimensions.ok && cashStatementOrganization && reserveCashbox
      ? getCashStatementSummary({
        date: selectedDate,
        organizationRef: cashStatementOrganization.ref,
        cashboxRef: reserveCashbox.ref,
      })
      : Promise.resolve(null),
    cashStatementDimensions.ok && cashStatementOrganization && depositSafeCashbox
      ? getCashStatementSummary({
        date: selectedDate,
        organizationRef: cashStatementOrganization.ref,
        cashboxRef: depositSafeCashbox.ref,
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
      department: employee.department,
      tasks: (run?.tasks ?? []) as AutoCheckTask[],
      cashboxName: cashRow?.cashbox?.name ?? null,
      cashRegisterRef: kkmAssignmentByUser.get(employee.id)?.oneCCashRegisterRef
        ?? (employee.oneCCashboxMapping?.kkmMode === 'server' ? employee.oneCCashboxMapping.oneCCashRegisterRef : null),
      kkmAssignments: kkmAssignments.filter((assignment) => assignment.userId === employee.id),
      kkmMode: kkmAssignmentByUser.get(employee.id)?.kkmMode ?? employee.oneCCashboxMapping?.kkmMode ?? 'personal',
      cashStatement: cashRow?.result ?? null,
      reserveCashboxName: reserveCashbox?.name ?? null,
      reserveStatement,
      depositSafeCashboxName: depositSafeCashbox?.name ?? null,
      depositSafeStatement,
      cashOperations: cashOperations.filter((operation) => operation.userId === employee.id),
      kkmDiagnostics,
      cashShifts,
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
  const employeeControlRows = employees
    .map((employee) => {
      const schedule = scheduleByUser.get(employee.id);
      const workDay = workDayByUser.get(employee.id);
      const run = shiftControlRunByUser.get(employee.id);
      const shiftControlRequired = usesWorkdayShiftControl(employee);
      const autoChecks = autoChecksByUser.get(employee.id) ?? [];
      const handoverHasStoreClosing = (run?.tasks ?? []).some((task) => (
        task.category === 'handover'
        && isRecord(task.handoverData)
        && isRecord(task.handoverData.storeClosing)
      ));
      const visibleTaskIds = new Set((run?.tasks ?? [])
        .filter((task) => !(task.category === 'closing' && handoverHasStoreClosing))
        .map((task) => task.id));
      const visibleAutoChecks = autoChecks.filter((check) => visibleTaskIds.has(check.taskId));
      const terminalFiscalControl = terminalFiscalAttribution.byUser.get(employee.id) ?? null;
      const terminalFiscalRecords = terminalFiscalAttribution.recordsByUser.get(employee.id) ?? [];
      const terminalFiscalPresentation = presentTerminalFiscalEmployeeControl(terminalFiscalControl);
      const employeeRequiredIssues = requiredIssuesByUser.get(employee.id) ?? [];
      const timingViolations = evaluateWorkdayTiming({
        dateKey: selectedDate,
        todayDateKey: today,
        nowMinutes,
        department: employee.department,
        scheduleStatus: schedule?.status,
        workDay,
        tasks: (run?.tasks ?? []) as AutoCheckTask[],
      });
      const activeTimingViolations = timingViolations.filter((violation) => isActiveWorkdayTimingViolation(violation.kind));
      const manualReviewCount = visibleAutoChecks.filter((check) => check.manualReview?.decision === 'confirmed_ok').length;
      const manualIssueCount = visibleAutoChecks.filter((check) => check.manualReview?.decision === 'confirmed_issue').length;
      const unresolvedAutoChecks = visibleAutoChecks.filter((check) => check.manualReview?.decision !== 'confirmed_ok');
      const mismatchCount = unresolvedAutoChecks.filter((check) => (
        check.status === 'mismatch' || check.manualReview?.decision === 'confirmed_issue'
      )).length;
      const incompleteCount = unresolvedAutoChecks.filter((check) => (
        check.manualReview?.decision !== 'confirmed_issue'
        && (check.status === 'waiting' || check.status === 'unavailable')
      )).length;
      const missedTaskCount = (run?.tasks ?? []).filter((task) => task.status === 'missed').length;
      const businessAttentionReasons = [
        !schedule ? 'График не заполнен' : null,
        hasStaleCloseViolation(workDay, run) ? 'Закрыто без сдачи смены' : null,
        missedTaskCount > 0 ? `Пропущено проверок: ${missedTaskCount}` : null,
        mismatchCount > 0
          ? manualIssueCount > 0
            ? `Подтверждённых проблем: ${manualIssueCount}`
            : `Расхождений по 1С: ${mismatchCount}`
          : null,
      ].filter((reason): reason is string => Boolean(reason));
      const attentionReasons = [
        ...businessAttentionReasons,
        activeTimingViolations.length > 0
          ? activeTimingViolations.length === 1
            ? activeTimingViolations[0].label
            : `Требуют действия: ${activeTimingViolations.length} · ${activeTimingViolations[0].label}`
          : null,
      ].filter((reason): reason is string => Boolean(reason));
      const employeeReportedProblem = (run?.tasks ?? []).some((task) => (
        (task.category === 'acquiring' || task.category === 'credit')
        && task.status === 'done'
        && task.integerValue === 2
      ));
      const hasError = employeeRequiredIssues.length > 0 || mismatchCount > 0 || manualIssueCount > 0 || employeeReportedProblem || terminalFiscalPresentation.tone === 'error';
      const needsAttention = !hasError && (attentionReasons.length > 0 || terminalFiscalPresentation.tone === 'attention');
      const waitingForWorkdayStart = schedule?.status === 'working' && selectedDate === today && !workDay;
      const pendingTaskCount = (run?.tasks ?? []).filter((task) => (
        task.status !== 'done'
        && task.status !== 'missed'
        && !timingViolations.some((violation) => violation.taskId === task.id && violation.kind === 'task_overdue')
      )).length;
      const cannotVerify = incompleteCount > 0 || (Boolean(run) && visibleAutoChecks.length === 0);
      const isPending = !hasError && !needsAttention && (
        waitingForWorkdayStart
        || pendingTaskCount > 0
        || (shiftControlRequired && schedule?.status === 'working' && !run)
      );
      const category: AdminWorkdayControlCategory = resolveAdminWorkdayControlCategory({ hasError, needsAttention, cannotVerify, isPending });
      const reviewText = hasError
        ? employeeRequiredIssues.length > 0
          ? `${employeeRequiredIssues[0].title}${employeeRequiredIssues.length > 1 ? ` · ещё ${employeeRequiredIssues.length - 1}` : ''}`
          : terminalFiscalPresentation.tone === 'error'
          ? terminalFiscalPresentation.text
          : manualIssueCount > 0
          ? `Подтверждённых проблем: ${manualIssueCount}`
          : employeeReportedProblem
            ? 'Сотрудник сообщил о расхождении'
            : `Расхождений с учётными данными: ${mismatchCount}`
        : needsAttention
        ? terminalFiscalPresentation.tone === 'attention'
          ? terminalFiscalPresentation.text
          : businessAttentionReasons.length > 0
          ? `${businessAttentionReasons.slice(0, 2).join(' · ')}${businessAttentionReasons.length > 2 ? ` · ещё ${businessAttentionReasons.length - 2}` : ''}`
          : activeTimingViolations[0]?.label ?? 'Требуется действие'
        : cannotVerify
          ? `Нужно проверить вручную: ${Math.max(incompleteCount, 1)}`
        : isPending
            ? waitingForWorkdayStart
              ? 'Рабочий день ещё не начат'
              : pendingTaskCount > 0
                ? `Ожидается проверок: ${pendingTaskCount}`
                : 'Чек-лист ещё не создан'
          : manualReviewCount > 0
            ? `Проверено вручную: ${manualReviewCount}`
            : terminalFiscalPresentation.tone === 'technical'
              ? terminalFiscalPresentation.text
              : 'Замечаний нет';
      const completedTaskCount = (run?.tasks ?? []).filter((task) => task.status === 'done').length;
      const totalTaskCount = run?.tasks.length ?? 0;
      const activeWorkDay = Boolean(workDay && !workDay.endedAt && workDay.status !== 'completed');
      const primaryRequiredIssue = employeeRequiredIssues[0] ?? null;
      const primaryIssueLifecycle = primaryRequiredIssue
        ? `${primaryRequiredIssue.originDate === today ? 'Возникла сегодня' : `Возникла ${formatDateLabel(primaryRequiredIssue.originDate)}`} · ${getMoscowDateKey(primaryRequiredIssue.lastDetectedAt) === today ? `автопроверка сегодня в ${formatTime(primaryRequiredIssue.lastDetectedAt)}` : `автопроверка ${formatDateLabel(getMoscowDateKey(primaryRequiredIssue.lastDetectedAt))} в ${formatTime(primaryRequiredIssue.lastDetectedAt)}`}`
        : '';
      const businessStatus = category === 'error'
        ? { label: 'Есть ошибка', className: 'bg-rose-100 text-rose-800' }
        : category === 'attention'
          ? { label: 'Требует внимания', className: 'bg-amber-100 text-amber-800' }
          : category === 'pending'
            ? { label: 'Не выполнено', className: 'bg-slate-100 text-slate-700' }
            : { label: 'Всё нормально', className: 'bg-green-100 text-green-800' };

      return {
        employee,
        schedule,
        workDay,
        run,
        autoChecks,
        terminalFiscalControl,
        terminalFiscalRecords,
        requiredIssues: employeeRequiredIssues.map((issue) => {
          const view = workdayIssueView(issue);
          const lifecycle = `${issue.originDate === today ? 'Возникла сегодня' : `Возникла ${formatDateLabel(issue.originDate)}`} · ${getMoscowDateKey(issue.lastDetectedAt) === today ? `автопроверка сегодня в ${formatTime(issue.lastDetectedAt)}` : `автопроверка ${formatDateLabel(getMoscowDateKey(issue.lastDetectedAt))} в ${formatTime(issue.lastDetectedAt)}`}`;
          return {
            id: issue.id,
            title: view.summaryTitle,
            meta: view.summaryMeta,
            lifecycle,
            href: `/admin/workday/issues/${issue.id}`,
          };
        }),
        timingViolations,
        shiftControlRequired,
        activeWorkDay,
        category,
        reviewText,
        primaryIssueLifecycle,
        completedTaskCount,
        totalTaskCount,
        businessStatus,
      };
    })
    .sort((left, right) => {
      const rank = { error: 0, attention: 1, pending: 2, normal: 3 };
      return rank[left.category] - rank[right.category]
        || left.employee.department.localeCompare(right.employee.department, 'ru')
        || left.employee.name.localeCompare(right.employee.name, 'ru');
    });
  const pendingEmployeeCount = employeeControlRows.filter((row) => row.category === 'pending').length;
  const normalEmployeeCount = employeeControlRows.filter((row) => row.category === 'normal').length;
  const focusEmployeeCount = employeeControlRows.filter((row) => row.activeWorkDay || matchesAdminWorkdayControlFilter(row.category, 'active')).length;
  const filteredEmployeeControlRows = employeeControlRows.filter((row) => (
    selectedControlFilter === 'active'
      ? row.activeWorkDay || matchesAdminWorkdayControlFilter(row.category, 'active')
      : matchesAdminWorkdayControlFilter(row.category, selectedControlFilter)
  ));
  const reviewableEmployeeRows = filteredEmployeeControlRows.filter((row) => row.requiredIssues.length > 0 || row.run || row.workDay || row.timingViolations.length > 0);
  const controlFilterHref = (filter: AdminWorkdayControlFilter) => `/admin/workday?date=${selectedDate}&control=${filter}#employees-control`;
  const employeeDetailHref = (employeeId: number) => (
    `/admin/workday?date=${selectedDate}&control=${selectedControlFilter}&employee=${employeeId}#employees-control`
  );
  const employeeDetailCloseHref = `/admin/workday?date=${selectedDate}&control=${selectedControlFilter}#employees-control`;
  const cashboxMappingMessage = cashboxMappingStatusMessage(searchParams?.cashboxMapping, searchParams?.cashboxMappingError);
  const kkmAssignmentMessage = searchParams?.kkmAssignment === 'saved'
    ? { tone: 'green', text: 'ККМ назначена на смену.' }
    : searchParams?.kkmAssignment === 'removed'
      ? { tone: 'amber', text: 'Назначение ККМ удалено.' }
      : searchParams?.kkmAssignment === 'error'
        ? { tone: 'rose', text: searchParams.kkmAssignmentError || 'Не удалось сохранить назначение ККМ.' }
        : null;
  const cashboxMappingEmployees = employees.filter((employee) => usesWorkdayShiftControl(employee));
  const cashboxMappingRedirectTo = `/admin/workday?date=${selectedDate}`;
  const cashRegisterOptions = Array.from(new Map([
    ...kkmDiagnostics.catalogCashRegisters.map((item) => [item.ref, item] as const),
    ...kkmDiagnostics.cashRegisterUsage.map((item) => [item.cashRegister.ref, item.cashRegister] as const),
    ...kkmDiagnostics.recentChecks.map((item) => [item.cashRegister.ref, item.cashRegister] as const),
  ]).values()).filter((item) => item.ref);
  const acquiringTerminalOptions = Array.from(new Map(
    [
      ...kkmDiagnostics.catalogAcquiringTerminals.map((item) => [item.ref, item] as const),
      ...kkmDiagnostics.acquiringTerminalUsage.map((item) => [item.acquiringTerminal.ref, item.acquiringTerminal] as const),
    ],
  ).values()).filter((item) => item.ref);
  const cashierOptions = Array.from(new Map([
    ...kkmDiagnostics.recentChecks.map((check) => [check.cashier.ref, check.cashier] as const),
    ...employees.flatMap((employee) => employee.oneCCashboxMapping?.oneCCashierRef
      ? [[employee.oneCCashboxMapping.oneCCashierRef, { ref: employee.oneCCashboxMapping.oneCCashierRef, name: employee.oneCCashboxMapping.oneCCashierName ?? '' }] as const]
      : []),
  ]).values()).filter((item) => item.ref);
  const terminalFiscalPresentation = presentTerminalFiscalWorkdaySummary(terminalFiscalSummary);
  const showTerminalFiscalSummary = selectedDate !== today || terminalFiscalPresentation.status !== 'confirmed';
  const showTechnical = searchParams?.technical === '1';

  return (
    <AdminShell>
      <AdminWorkdayAutoRefresh date={selectedDate} revision={liveRevision} />
      <div className='space-y-6'>
        <AdminPageHeader
          eyebrow='Операционная работа'
          title='Контроль дня'
          description='Состояние сотрудников и текущие отклонения. Ваши решения и новые обращения собраны на главной.'
          actions={<>
            <Link
              href={`/admin/workday?date=${previousDate}`}
              aria-label='Предыдущий день'
              className='admin-material-control rounded-lg px-3 py-2 text-sm font-bold text-slate-700 transition'
            >
              ← <span className='hidden sm:inline'>Предыдущий</span>
            </Link>
            <Badge className='admin-material-control w-fit px-3 py-2 text-slate-700'>{formatDateLabel(selectedDate)}</Badge>
            <Link
              href={`/admin/workday?date=${nextDate}`}
              className='admin-material-control rounded-lg px-3 py-2 text-sm font-bold text-slate-700 transition'
            >
              <span className='hidden sm:inline'>Следующий</span> →
            </Link>
            <Link
              href='/admin/workday'
              className='admin-material-primary rounded-lg px-3 py-2 text-sm font-extrabold text-white transition'
            >
              <span className='sm:hidden'>Сегодня</span><span className='hidden sm:inline'>Сегодня</span>
            </Link>
            <WorkdayQrCodes />
          </>}
        />

        {showTerminalFiscalSummary && <TerminalFiscalAdminSummary summary={terminalFiscalSummary} />}

        {unfinishedWorkDays.length > 0 && (
          <Card className='border-amber-200 bg-amber-50'>
            <div className='flex items-start gap-3'>
              <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
              <div>
                <p className='font-extrabold text-amber-950'>Остались незавершённые рабочие дни</p>
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

        <Card className='admin-material-surface p-0' id='employees-control'>
          <div className='flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <h2 className='text-lg font-extrabold text-slate-950'>Состояние сотрудников</h2>
              <p className='mt-1 text-sm font-medium text-slate-500'>
                Сначала показаны работающие сотрудники и те, у кого есть активная проблема или отклонение.
              </p>
            </div>
            <div className='flex flex-wrap gap-2 text-xs font-extrabold'>
              {([
                ['active', `Главное сейчас · ${focusEmployeeCount}`],
                ['pending', `Ожидаются · ${pendingEmployeeCount}`],
                ['normal', `Без проблем · ${normalEmployeeCount}`],
                ['all', `Все · ${employeeControlRows.length}`],
              ] as Array<[AdminWorkdayControlFilter, string]>).map(([filter, label]) => (
                <Link
                  key={filter}
                  href={controlFilterHref(filter)}
                  className={`rounded-lg px-3 py-2 ring-1 transition ${
                    selectedControlFilter === filter
                      ? 'admin-material-filter-active text-white ring-slate-950'
                      : 'admin-material-control text-slate-700 ring-slate-200'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          {filteredEmployeeControlRows.length === 0 ? (
            <div className='flex items-center gap-3 px-5 py-5 text-sm font-semibold text-slate-600'><span className='flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-700'>✓</span>В этой категории сотрудников нет.</div>
          ) : (
            <div className='divide-y divide-slate-100'>
              {filteredEmployeeControlRows.map((row) => {
                const currentShiftState = shiftState(row.workDay, row.schedule?.status);
                const reviewableIndex = reviewableEmployeeRows.findIndex((reviewableRow) => reviewableRow.employee.id === row.employee.id);
                const previousEmployeeRow = reviewableIndex > 0 ? reviewableEmployeeRows[reviewableIndex - 1] : null;
                const nextEmployeeRow = reviewableIndex >= 0 && reviewableIndex < reviewableEmployeeRows.length - 1
                  ? reviewableEmployeeRows[reviewableIndex + 1]
                  : null;
                return (
                  <div key={row.employee.id} className='admin-control-row grid gap-3 px-5 py-4 transition lg:grid-cols-[minmax(220px,0.9fr)_minmax(180px,0.75fr)_minmax(260px,1.25fr)_auto] lg:items-center'>
                    <div className='min-w-0'>
                      <p className='truncate font-extrabold text-slate-950'>{row.employee.name}</p>
                      <p className='mt-0.5 text-xs font-semibold text-slate-400'>{departmentLabel(row.employee.department)}</p>
                    </div>
                    <div className='flex min-w-0 flex-wrap items-center gap-2'>
                      <Badge className={currentShiftState.className}>{currentShiftState.label}</Badge>
                      {row.workDay?.shiftLabel && <span className='text-xs font-bold text-slate-600'>{row.workDay.shiftLabel}</span>}
                    </div>
                    <div className='min-w-0'>
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge className={row.requiredIssues.length > 0 ? 'bg-amber-100 text-amber-800' : row.activeWorkDay && row.category === 'normal' ? 'bg-green-100 text-green-800' : row.businessStatus.className}>
                          {row.requiredIssues.length > 0 ? 'Исправляет сотрудник' : row.activeWorkDay && row.category === 'normal' ? 'Идёт по плану' : row.businessStatus.label}
                        </Badge>
                        <span className='text-xs font-semibold text-slate-400'>{row.totalTaskCount > 0 ? `Выполнено ${row.completedTaskCount} из ${row.totalTaskCount}` : 'Проверок пока нет'}</span>
                      </div>
                      <p className={`mt-1.5 text-sm font-semibold leading-relaxed ${
                        row.category === 'error' ? 'text-rose-800' : row.category === 'attention' ? 'text-amber-800' : row.category === 'pending' ? 'text-slate-600' : 'text-green-700'
                      }`}>{row.reviewText}</p>
                      {row.primaryIssueLifecycle && <p className='mt-1 text-xs font-semibold text-slate-400'>{row.primaryIssueLifecycle}</p>}
                    </div>
                    <div className='flex items-center gap-2 lg:justify-end'>
                      {row.requiredIssues.length > 0 || row.run || row.workDay || row.timingViolations.length > 0 ? (
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
                          terminalFiscalControl={row.terminalFiscalControl ? {
                            total: row.terminalFiscalControl.total,
                            statuses: row.terminalFiscalControl.statuses,
                            reasonCodes: row.terminalFiscalControl.reasonCodes,
                            lastOperationAt: row.terminalFiscalControl.lastOperationAt?.toISOString() ?? null,
                          } : null}
                          terminalFiscalRecords={row.terminalFiscalRecords.map((record) => ({
                            status: record.status,
                            reasonCode: record.reasonCode,
                            bankOperationAt: record.bankOperationAt?.toISOString() ?? null,
                          }))}
                          requiredIssues={row.requiredIssues}
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
                      ) : <span className='text-xs font-semibold text-slate-400'>Нет данных</span>}
                      {(devWorkdayToolsEnabled || row.employee.login === 'kkm_test') && <div className='flex flex-col gap-2'>
                        {!row.workDay && row.shiftControlRequired && <DevCreateTestShiftButtons userId={row.employee.id} userName={row.employee.name} department={row.employee.department} date={selectedDate} />}
                        {row.shiftControlRequired && row.run && <DevMakeShiftTasksAvailableButton userId={row.employee.id} userName={row.employee.name} date={selectedDate} />}
                        {row.employee.department === 'retail' && row.workDay?.comment.startsWith('Dev/Test') && row.run?.tasks.find((task) => task.category === 'handover') && (() => {
                          const handoverTask = row.run!.tasks.find((task) => task.category === 'handover')!;
                          const handoverData = isRecord(handoverTask.handoverData) ? handoverTask.handoverData : {};
                          const simulation = readKkmShiftCloseSimulation(handoverData.kkmCloseSimulation);
                          return <DevKkmCloseScenarioControl taskId={handoverTask.id} initialScenario={simulation?.scenario ?? null} />;
                        })()}
                        <DevResetTodayButton userId={row.employee.id} userName={row.employee.name} date={selectedDate} />
                      </div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {lateCreditReceipts.length > 0 && (
          <details className='group rounded-xl bg-white ring-1 ring-slate-200'>
            <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50'>
              <div><h2 className='text-base font-extrabold text-slate-950'>История исправленных нарушений · {lateCreditReceipts.length}</h2><p className='mt-1 text-sm font-medium text-slate-500'>Активного действия уже нет; опоздание сохранено в audit.</p></div>
              <span className='text-sm font-extrabold text-slate-500 group-open:hidden'>Открыть</span><span className='hidden text-sm font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
            </summary>
            <div className='grid gap-2 border-t border-slate-200 p-4 sm:grid-cols-2'>{lateCreditReceipts.map((item) => <div key={item.id} className='rounded-xl bg-slate-50 px-3 py-2 text-sm'><p className='font-extrabold text-slate-900'>Реализация {item.documentNumber} · +{item.receiptDelayMinutes} мин.</p><p className='mt-0.5 font-semibold text-slate-500'>Кассир чека: {item.receiptCashierName || 'не определён'}</p></div>)}</div>
          </details>
        )}

        {showTechnical ? <details className='group rounded-xl bg-white ring-1 ring-slate-200' open>
          <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 transition hover:bg-slate-50'>
            <div>
              <h2 className='text-base font-extrabold text-slate-950'>Диагностика и настройки</h2>
              <p className='mt-1 text-sm font-medium text-slate-500'>Служебный режим: подключения, привязки касс и технические таблицы.</p>
            </div>
            <span className='text-sm font-extrabold text-slate-500 group-open:hidden'>Открыть</span>
            <span className='hidden text-sm font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
          </summary>
          <div className='grid gap-6 border-t border-slate-200 bg-slate-50 p-4 sm:p-5'>
        <Card id='kkm-assignments' className='p-0'>
          <details className='group' open={Boolean(kkmAssignmentMessage) || selectedDate === today}>
            <summary className='flex cursor-pointer list-none flex-col gap-3 px-5 py-4 transition hover:bg-slate-50 lg:flex-row lg:items-center lg:justify-between'>
              <div>
                <h2 className='text-lg font-extrabold text-slate-950'>ККМ на рабочую смену</h2>
                <p className='mt-1 text-sm font-medium text-slate-500'>Касса 1С остаётся персональной. Здесь назначается только физическая ККМ на {formatDateLabel(selectedDate)}.</p>
              </div>
              <Badge className='w-fit bg-slate-100 text-slate-700'>назначено сейчас: {activeKkmAssignments.length}</Badge>
            </summary>
            <div className='border-t border-slate-200'>
              {kkmAssignmentMessage ? (
                <div className={`m-4 rounded-lg px-3 py-2 text-sm font-bold ${kkmAssignmentMessage.tone === 'green' ? 'bg-green-50 text-green-800' : kkmAssignmentMessage.tone === 'rose' ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                  {kkmAssignmentMessage.text}
                </div>
              ) : null}
              <div className='overflow-x-auto'>
                <Table>
                  <thead>
                    <tr className='text-left text-xs uppercase tracking-wide text-slate-500'>
                      <th className='px-4 py-3'>Сотрудник</th>
                      <th className='px-4 py-3'>Персональная касса 1С</th>
                      <th className='px-4 py-3'>ККМ на день</th>
                      <th className='px-4 py-3'>Состояние</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.filter((employee) => employee.department === 'retail').map((employee) => {
                      const assignment = kkmAssignmentByUser.get(employee.id);
                      const mapping = employee.oneCCashboxMapping?.isActive ? employee.oneCCashboxMapping : null;
                      return (
                        <tr key={employee.id} className='border-t border-slate-100 align-top'>
                          <td className='px-4 py-3 font-bold text-slate-950'>{employee.name}</td>
                          <td className='px-4 py-3 text-sm font-semibold text-slate-600'>{mapping?.oneCCashboxName || 'Не привязана'}</td>
                          <td className='px-4 py-3'>
                            <form action='/api/admin/workday/kkm-assignment' method='post' className='grid min-w-[330px] gap-2'>
                              <input type='hidden' name='date' value={selectedDate} />
                              <input type='hidden' name='userId' value={employee.id} />
                              <select name='oneCCashRegisterRef' defaultValue={assignment?.oneCCashRegisterRef ?? ''} className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800'>
                                <option value=''>Не назначена</option>
                                {cashRegisterOptions.map((cashRegister) => <option key={cashRegister.ref} value={cashRegister.ref}>{cashRegister.name}</option>)}
                              </select>
                              <select name='plannedShiftCode' defaultValue={assignment?.plannedShiftCode ?? ''} className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800'>
                                <option value=''>Любая выбранная смена</option>
                                {getShiftOptionsForDepartment('retail').map((shift) => <option key={shift.code} value={shift.code}>{shift.label}</option>)}
                              </select>
                              <input name='note' defaultValue={assignment?.note ?? ''} placeholder='Комментарий при необходимости' className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold' />
                              <input name='changeReason' placeholder={assignment ? 'Причина замены или отключения ККМ' : 'Причина — только при замене'} className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold' />
                              <button type='submit' disabled={!kkmDiagnostics.ok} className='rounded-lg bg-slate-950 px-3 py-2 text-sm font-extrabold text-white disabled:bg-slate-300'>Сохранить назначение</button>
                            </form>
                          </td>
                          <td className='px-4 py-3'>
                            <Badge className={assignment ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}>
                              {assignment ? 'Действует' : 'Не назначено'}
                            </Badge>
                            {assignment ? <p className='mt-1 text-xs font-semibold text-slate-500'>{assignment.oneCCashRegisterName}</p> : null}
                            {kkmAssignments.filter((item) => item.userId === employee.id).length > 1 ? <p className='mt-1 text-xs font-semibold text-slate-500'>смен ККМ за день: {kkmAssignments.filter((item) => item.userId === employee.id).length}</p> : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          </details>
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
                        <th className='px-4 py-3'>Постоянные настройки 1С</th>
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
                              <form action='/api/admin/workday/cashbox-mapping' method='post' className='grid min-w-[360px] gap-2'>
                                <input type='hidden' name='userId' value={employee.id} />
                                <input type='hidden' name='redirectTo' value={cashboxMappingRedirectTo} />
                                <input type='hidden' name='mappingDate' value={selectedDate} />
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
                                <select
                                  name='kkmMode'
                                  defaultValue={mapping?.kkmMode ?? 'personal'}
                                  className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                                >
                                  <option value='personal'>Персональная ККМ — пилот</option>
                                  <option value='server'>Серверная ККМ — резервный режим</option>
                                </select>
                                <select
                                  name='oneCCashRegisterRef'
                                  defaultValue={mapping?.oneCCashRegisterRef ?? ''}
                                  className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                                  disabled={!kkmDiagnostics.ok}
                                >
                                  <option value=''>ККМ по умолчанию не задана</option>
                                  {cashRegisterOptions.map((cashRegister) => (
                                    <option key={cashRegister.ref} value={cashRegister.ref}>{cashRegister.name}</option>
                                  ))}
                                </select>
                                <select
                                  name='oneCAcquiringTerminalRef'
                                  defaultValue={mapping?.oneCAcquiringTerminalRef ?? ''}
                                  className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                                  disabled={!kkmDiagnostics.ok}
                                >
                                  <option value=''>Терминал 1С не привязан</option>
                                  {acquiringTerminalOptions.map((terminal) => (
                                    <option key={terminal.ref} value={terminal.ref}>{terminal.name}</option>
                                  ))}
                                </select>
                                <select
                                  name='oneCCashierRef'
                                  defaultValue={mapping?.oneCCashierRef ?? ''}
                                  className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                                  disabled={!kkmDiagnostics.ok}
                                >
                                  <option value=''>Кассир 1С не сопоставлен</option>
                                  {cashierOptions.map((cashier) => (
                                    <option key={cashier.ref} value={cashier.ref}>{cashier.name || 'Кассир без наименования'}</option>
                                  ))}
                                </select>
                                <input
                                  name='tbankTerminalId'
                                  defaultValue={mapping?.tbankTerminalId ?? ''}
                                  className='min-h-10 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                                  placeholder='ID физического терминала Т-Банка'
                                />
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
                                {mapping ? 'касса привязана' : 'нужно настроить кассу'}
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

          </div>
        </details> : <Link href={`/admin/workday?date=${selectedDate}&technical=1#kkm-assignments`} className='flex items-center justify-between gap-3 rounded-xl bg-white px-5 py-4 text-sm font-extrabold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 hover:text-slate-950'><span><span className='block text-slate-950'>Служебные настройки</span><span className='mt-0.5 block text-xs font-semibold text-slate-500'>Привязки касс, наличные по 1С и технические таблицы</span></span><span>Открыть →</span></Link>}

      </div>
    </AdminShell>
  );
}
