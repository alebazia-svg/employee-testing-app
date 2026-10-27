import { agentCreditCommissionEmployee, applyPayrollBonuses, buildPayrollEmployeeDirectory, type PayrollDirectoryUser } from './payroll-calculation-engine';
import { prepareDailyPayrollInputs, buildDailyPayrollBase } from './payroll-daily-calculation';
import { validatePayrollBonuses } from './payroll-compensation';
import { validatePayrollDraft } from './payroll-draft';
import { aggregatePayrollOneCControlSlices, isPayrollOneCControlSlice, listDates } from './payroll-one-c-control-snapshots';
import { buildPayrollSalesCompactSnapshot, type PayrollSalesClassificationRule } from './payroll-sales-classification';
import { readPayrollAttendanceSnapshotPayload } from './payroll-attendance-snapshot';
import type { PayrollPurchaseSupplierRuleValue } from './payroll-purchase-suppliers';
import { buildPayrollPurchaseSupplierPreview } from './payroll-purchase-suppliers';
import { applyPayrollOneCAdvances, type PayrollAdvanceRead } from './payroll-one-c-advances';
import type { EmployeeEarning } from './employee-payroll-estimate';

export type CurrentPayrollEvidence = {
  users: PayrollDirectoryUser[];
  slices: Array<{ dateFrom: string; dateTo: string; payload: unknown }>;
  attendance: { payload: unknown; sourceCheckedAt: Date; updatedAt: Date } | null;
  draft: { payload: unknown; revision: number } | null;
  finboxAmount: string | null;
  classificationRules: PayrollSalesClassificationRule[];
  supplierRules: PayrollPurchaseSupplierRuleValue[];
  advances?: unknown;
};
export type PersonalCurrentPayroll = {
  userId: number; periodKey: string; grossPay: number; verifiedThrough: string;
  attendanceCheckedAt: string; draftRevision: number;
  advance?: number | null;
  dayPay?: number;
  earnings?: EmployeeEarning[];
  sourceFallback?: boolean;
};
export type PersonalPayrollSourceMemo = Map<string, {
  combined: { sales: { summary: ReturnType<typeof aggregatePayrollOneCControlSlices>['sales']['summary'] }; purchases: ReturnType<typeof aggregatePayrollOneCControlSlices>['purchases'] };
  compact: ReturnType<typeof buildPayrollSalesCompactSnapshot>;
}>;

function verifiedAdvances(value: unknown, periodKey: string, now: Date): PayrollAdvanceRead | null {
  if (!value || typeof value !== 'object') return null;
  const read = value as PayrollAdvanceRead;
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now);
  const age = now.getTime() - Date.parse(read.checkedAt);
  if (read.version !== 1 || read.periodKey !== periodKey || read.dateFrom !== `${periodKey}-01` || read.dateTo !== today
    || !Number.isFinite(age) || age < 0 || age > 5 * 60_000 || !Array.isArray(read.issues) || read.issues.length
    || !Array.isArray(read.documents)) return null;
  const keys = new Set<string>();
  for (const doc of read.documents) {
    if (!doc || typeof doc.key !== 'string' || !doc.key || keys.has(doc.key) || doc.periodKey !== periodKey
      || typeof doc.employeeRef !== 'string' || !doc.employeeRef || typeof doc.employeeName !== 'string'
      || typeof doc.documentNumber !== 'string' || typeof doc.documentDate !== 'string'
      || !Number.isFinite(doc.amount) || doc.amount < 0) return null;
    keys.add(doc.key);
  }
  return read;
}

/** Reuse complete, closed daily sources; never skip a disputed day in the middle
 * of a month or manufacture a zero for it. The displayed cutoff remains exact. */
export function calculateLastVerifiedPersonalPayroll(periodKey: string, userId: number, evidence: CurrentPayrollEvidence, now = new Date(), sourceMemo?: PersonalPayrollSourceMemo): PersonalCurrentPayroll | null {
  const memo = sourceMemo ?? new Map();
  const current = calculatePersonalCurrentPayroll(periodKey, userId, evidence, now, memo);
  if (current || !getPrivatePayrollBinding(evidence.users, userId) || !evidence.attendance || !evidence.draft) return current;
  const slices = [...evidence.slices].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom));
  if (!slices.length || slices.length > 31 || slices.some(row => !isPayrollOneCControlSlice(row.payload)
    || row.payload.dateFrom !== row.dateFrom || row.payload.dateTo !== row.dateTo
    || row.dateFrom !== row.dateTo || !/^20\d{2}-\d{2}-\d{2}$/.test(row.dateFrom)
    || !Number.isFinite(Date.parse(row.dateFrom)) || new Date(row.dateFrom).toISOString().slice(0, 10) !== row.dateFrom
    || !row.dateFrom.startsWith(`${periodKey}-`))) return null;
  const dates = listDates(`${periodKey}-01`, slices.at(-1)!.dateTo);
  if (dates.length !== slices.length || dates.some((date, index) => slices[index].dateFrom !== date)) return null;
  const latest = memo.get(slices.at(-1)!.dateTo);
  const sourceBlocked = latest && (latest.compact.unresolvedRows || latest.compact.costPendingRows
    || latest.combined.sales.summary.missingManagerRows || latest.combined.sales.summary.missingCustomerRows
    || latest.combined.sales.summary.missingProductRows);
  // Earlier sales cannot repair missing personal days, pay rules or draft inputs.
  if (!sourceBlocked && !slices.some(row => (row.payload as { close: { blockingIssues: string[] } }).close.blockingIssues.length)) return null;
  for (let length = slices.length - 1; length > 0; length--) {
    const previous = calculatePersonalCurrentPayroll(periodKey, userId, { ...evidence, slices: slices.slice(0, length) }, now, memo);
    if (previous) return { ...previous, sourceFallback: true };
  }
  return null;
}

// No name fallback: the explicit ADMIN payroll binding must be unique even
// against inactive accounts, so reusing a trainee alias cannot disclose pay.
export function getPrivatePayrollBinding(users: PayrollDirectoryUser[], userId: number) {
  const matches = users.filter(user => user.id === userId);
  if (matches.length !== 1) return null;
  const user = matches[0];
  const name = user.payrollName?.trim();
  if (!name || !user.isActive || user.role !== 'EMPLOYEE') return null;
  if (users.filter(other => (other.payrollName?.trim() || other.name.trim()) === name).length !== 1) return null;
  return name;
}

// Fail closed on missing/gapped/invalid sources. Never create a synthetic zero.
// This returns an internal projection only; the HTTP boundary allowlists fields.
export function calculatePersonalCurrentPayroll(periodKey: string, userId: number, evidence: CurrentPayrollEvidence, now = new Date(), sourceMemo?: PersonalPayrollSourceMemo): PersonalCurrentPayroll | null {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(periodKey) || evidence.slices.length > 31) return null;
  const name = getPrivatePayrollBinding(evidence.users, userId);
  if (!name || !evidence.draft || !evidence.attendance || !evidence.slices.length) return null;
  if (name === agentCreditCommissionEmployee && evidence.finboxAmount === null) return null;
  const slices = evidence.slices.map(row => {
    if (!isPayrollOneCControlSlice(row.payload)) throw Error('Invalid payroll source');
    if (row.dateFrom !== row.payload.dateFrom || row.dateTo !== row.payload.dateTo) throw Error('Source date mismatch');
    return row.payload;
  });
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
    && new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) === date;
  if (slices.some(slice => !validDate(slice.dateFrom) || !validDate(slice.dateTo) || !slice.dateFrom.startsWith(periodKey + '-')
    || !slice.dateTo.startsWith(periodKey + '-') || slice.dateFrom > slice.dateTo || slice.close.blockingIssues.length)) return null;
  const through = slices.map(slice => slice.dateTo).sort().at(-1)!;
  if (!through.startsWith(`${periodKey}-`)) return null;
  const dates = slices.flatMap(slice => listDates(slice.dateFrom, slice.dateTo));
  const expected = listDates(`${periodKey}-01`, through);
  if (new Set(dates).size !== dates.length || dates.length !== expected.length || expected.some(date => !dates.includes(date))) return null;
  // The server supplies a memo scoped to the exact persisted source/rule hash.
  // Identity, draft, attendance and financial verification are never memoized.
  let prepared = sourceMemo?.get(through);
  if (!prepared) {
    const combined = aggregatePayrollOneCControlSlices(slices);
    // Cost flags on revenue-based services are not payroll blockers. The shared
    // ADMIN classification retains blockers on cost-dependent remuneration.
    const compact = buildPayrollSalesCompactSnapshot(combined.sales.rows.map(row => ({
      ...row, registrar: '', registrars: [], profitability: row.revenue ? row.grossProfit / row.revenue * 100 : 0,
      sourceCostReviewRows: row.costReviewRows, sourceCostCalculationPendingRows: row.costCalculationPendingRows,
    })), evidence.classificationRules, periodKey);
    // Retain summaries only, not another copy of every sales fact per cutoff.
    prepared = { combined: { sales: { summary: combined.sales.summary }, purchases: combined.purchases }, compact };
    sourceMemo?.set(through, prepared);
  }
  const { combined, compact } = prepared;
  if (combined.sales.summary.missingManagerRows || combined.sales.summary.missingCustomerRows || combined.sales.summary.missingProductRows) return null;
  if (compact.unresolvedRows || compact.costPendingRows) return null;
  const attendance = readPayrollAttendanceSnapshotPayload(evidence.attendance.payload, periodKey);
  if (!attendance || attendance.attendanceMode === 'demo' || attendance.period.monthIndex !== Number(periodKey.slice(5)) - 1
    || attendance.period.year !== Number(periodKey.slice(0, 4))) return null;
  const draft = validatePayrollDraft(evidence.draft.payload);
  const directory = buildPayrollEmployeeDirectory(evidence.users, periodKey, new Set(compact.managerSummaries.map(row => row.manager)), true);
  if (!directory[name]) return null;
  const purchases = buildPayrollPurchaseSupplierPreview(combined.purchases.settlements, evidence.supplierRules);
  if (directory[name].salaryType === 'purchase_manager' && (!purchases.ready || combined.purchases.reviewDocumentCount)) return null;
  const manual = prepareDailyPayrollInputs({ directory, manual: draft.manual, periodKey, finboxAmount: evidence.finboxAmount,
    attendance: { ...attendance, snapshot: { servedFrom: 'stored', sourceCheckedAt: evidence.attendance.sourceCheckedAt.toISOString(), savedAt: evidence.attendance.updatedAt.toISOString() } } });
  const base = buildDailyPayrollBase({ periodKey, directory, users: evidence.users, summaries: compact.managerSummaries,
    manual, fixed: draft.fixed, purchase: draft.purchase, purchaseBase: purchases.approvedBase });
  const bonuses = validatePayrollBonuses(draft.bonuses, base.map(row => row.manager));
  const allRows = applyPayrollBonuses(base, bonuses);
  const rows = allRows.filter(row => row.manager === name);
  if (rows.length !== 1 || rows[0].payrollStatus !== 'OK' || rows[0].payrollReasons.length || !Number.isFinite(rows[0].grossPay)) return null;
  const advanceRead = verifiedAdvances(evidence.advances, periodKey, now);
  const applied = advanceRead ? applyPayrollOneCAdvances(allRows, advanceRead) : null;
  // A saved manual amount alone is not proof of money issued in 1C.
  const advance = rows[0].advance === 0 && applied && !applied.issues.length
    ? applied.rows.find(row => row.manager === name)?.advance ?? null : null;
  const summary = rows[0];
  const earnings: EmployeeEarning[] | undefined = ['retail_sales_bonus', 'wholesale_percent'].includes(directory[name].salaryType) ? [
    { label: 'Выходы', amount: rows[0].dayPay },
    ...(directory[name].salaryType === 'wholesale_percent'
      ? [{ label: 'Оптовые продажи', amount: summary.wholesaleBonus }]
      : [{ label: 'Телефоны и техника', amount: summary.techBonus + summary.creditBonus },
        { label: 'Аксессуары', amount: summary.accessoryBonus },
        { label: 'Поклейка и услуги', amount: summary.filmBonus + summary.plotterBonus }]),
  ] as EmployeeEarning[] : undefined;
  // Day pay and sales only. Discipline and one-time bonuses remain in ADMIN.
  // A changed compensation formula must not silently lose a sales component.
  if (earnings && Math.abs(earnings.reduce((sum, row) => sum + row.amount, 0) - rows[0].dayPay - rows[0].salesBonus) > 0.005) return null;
  return { userId, periodKey, grossPay: rows[0].grossPay, dayPay: rows[0].dayPay, earnings, verifiedThrough: through, advance,
    attendanceCheckedAt: evidence.attendance.sourceCheckedAt.toISOString(), draftRevision: evidence.draft.revision };
}
