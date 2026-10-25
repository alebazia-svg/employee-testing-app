import { expenseRecord as record, expenseText as text, expenseName as name } from './expense-request-list-view';
import { expenseRemaining, EXPENSE_SOURCE_MAX_AGE_MS } from './employee-expense-policy';
import { parseOneCDateTime, moscowDateKey } from './one-c-date';
import { DELIVERY_PHONE_RESERVE_REF } from './procurement-delivery-reserve';

const ref = (v: unknown) => text(v).toLowerCase();
const minor = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && Number.isSafeInteger(Math.round(v * 100)) ? Math.round(v * 100) : null;
const complete = (v: unknown) => { const b = record(v); return b.complete === true && b.truncated !== true && (!Array.isArray(b.errors) || !b.errors.length) && (!Array.isArray(b.missing_fields) || !b.missing_fields.length); };
const safe = (value: string) => /сейф|\bsafe\b/iu.test(value);
export type ExpenseRouteEmployee = { id: number; name: string; applicantRef: string; cashboxRef: string; cashboxName: string; department: string; onShift: boolean; shiftState?: 'active' | 'ended' | 'not_started' | 'day_off' };
export type ExpenseAllocation = { cashboxRef: string; cashbox: string; remaining: number; dueDate: string };
export type ExpenseRouteItem = ExpenseAllocation & { ref: string; number: string; purpose: string; recipient?: string; date: string; cycle: number; userId: number; mode: 'execute' | 'coordinate'; onShift: boolean; detail: string };
export type AdminExpenseRouteItem = ExpenseAllocation & { ref: string; number: string; purpose: string; recipient?: string; date: string; cycle: number; applicant: string; reason: string; handoverNote?: string };
export const ADMIN_EXPENSE_ISSUE_SOURCE = 'expense_cash_issue';
export function adminExpenseRouteKey(item: { ref: string; cashboxRef: string; cycle: number }) { return `expense-cash-admin:${item.ref}:${item.cashboxRef}:${item.cycle}`; }
export function adminExpenseRouteCopy(item: AdminExpenseRouteItem) {
  return { title: `Оформите расходник · ${item.remaining.toLocaleString('ru-RU')} ₽`, body: `${item.cashbox} · ${item.reason}` };
}
export type ExpenseRouteSnapshot = { state: 'ready' | 'unavailable'; checkedAt: string | null; items: ExpenseRouteItem[]; adminItems: AdminExpenseRouteItem[]; unavailableRefs: string[]; review: Array<{ ref: string; reason: string }> };

/** This allocation is for routing only. It must never explain an employee's cash shortage. */
export function expenseAllocations(source: unknown): ExpenseAllocation[] | null {
  const s = record(source), remaining = expenseRemaining(s, false);
  if (remaining === null) return null;
  if (remaining === 0) return []; // Complete direct RKO proof wins, including legacy cross-cashbox execution.
  const distribution = record(s.plannedDistribution), rows = distribution.rows;
  const provided = s.plannedDistribution != null;
  if (provided && (!complete(distribution) || !Array.isArray(rows))) return null;
  const groups = new Map<string, { cashbox: string; dates: Map<string, number> }>();
  if (Array.isArray(rows) && rows.length) {
    const lineNumbers = new Set<number>(); let total = 0;
    for (const value of rows) {
      const row = record(value), place = record(row.payment_place), cashboxRef = ref(place.ref), amount = minor(row.amount);
      const date = parseOneCDateTime(row.payment_date);
      if (!cashboxRef || amount === null || amount <= 0 || !date || date.getFullYear() < 2000
        || !Number.isInteger(row.line_number) || lineNumbers.has(Number(row.line_number))) return null;
      lineNumbers.add(Number(row.line_number)); total += amount;
      const group = groups.get(cashboxRef) ?? { cashbox: name(place), dates: new Map<string, number>() };
      const key = moscowDateKey(date); group.dates.set(key, (group.dates.get(key) ?? 0) + amount); groups.set(cashboxRef, group);
    }
    if (total !== minor(s.amount)) return null; // Incomplete distribution must not silently borrow the header remainder.
  } else {
    const cashboxRef = ref(record(s.cashbox).ref), amount = minor(s.amount);
    if (!cashboxRef || amount === null) return null;
    const date = parseOneCDateTime(s.desiredPaymentDate || s.paymentDate || s.date);
    if (!date) return null;
    groups.set(cashboxRef, { cashbox: name(s.cashbox), dates: new Map([[moscowDateKey(date), amount]]) });
  }
  const paid = new Map<string, number>();
  for (const value of record(s.linkedCashExpenseOrders).rows as unknown[]) {
    const r = record(value);
    if (r.posted !== true || r.deletion_mark !== false) continue;
    const cashboxRef = ref(record(r.cashbox).ref), amount = minor(r.executed_amount)!;
    if (amount > 0 && !groups.has(cashboxRef)) return null;
    paid.set(cashboxRef, (paid.get(cashboxRef) ?? 0) + amount);
  }
  const result: ExpenseAllocation[] = [];
  for (const [cashboxRef, group] of groups) {
    const executed = paid.get(cashboxRef) ?? 0;
    // RKO links identify a cashbox, not a planned line. Several dates with partial
    // execution cannot be matched safely; do not guess FIFO or instruct early payment.
    const total = [...group.dates.values()].reduce((a, b) => a + b, 0);
    if (executed > total || group.dates.size > 1 && executed > 0 && executed < total) return null;
    if (executed === total) continue;
    for (const [dueDate, amount] of group.dates) result.push({ cashboxRef, cashbox: group.cashbox, dueDate, remaining: (amount - executed) / 100 });
  }
  if (result.reduce((n, row) => n + Math.round(row.remaining * 100), 0) !== Math.round(remaining * 100)) return null;
  return result;
}

export function routeEmployeeExpenses(input: { complete: boolean; checkedAt: string | null; now: Date; employees: ExpenseRouteEmployee[]; rows: Array<{ source: unknown; seenAt: string; cycle: number }>; excludedRefs?: string[]; ambiguousCashboxRefs?: string[]; adminAssignments?: Array<{ key: string; reason: string; at?: string }> }): ExpenseRouteSnapshot {
  const result: ExpenseRouteSnapshot = { state: 'unavailable', checkedAt: input.checkedAt, items: [], adminItems: [], unavailableRefs: [], review: [] };
  const fresh = (value: string | null) => { const t = Date.parse(value ?? ''); return Number.isFinite(t) && t <= +input.now && +input.now - t <= EXPENSE_SOURCE_MAX_AGE_MS; };
  if (!input.complete || !fresh(input.checkedAt)) return result;
  result.state = 'ready'; const seen = new Set<string>(), today = moscowDateKey(input.now);
  for (const row of input.rows) {
    const s = record(row.source), requestRef = ref(s.ref), payment = record(s.paymentForm);
    if (input.excludedRefs?.includes(requestRef)) continue;
    if (s.deletionMark === true || text(record(s.status).key) !== 'payable' || payment.cash === false) continue;
    if (!requestRef || seen.has(requestRef) || !fresh(row.seenAt) || s.posted !== true || s.deletionMark !== false
      || payment.cash !== true || payment.card === true || payment.cashless === true
      || !['руб', 'руб.', 'rub', 'rur', '₽'].includes(name(s.currency).toLowerCase())) {
      if (requestRef) result.unavailableRefs.push(requestRef); else result.state = 'unavailable'; continue;
    }
    seen.add(requestRef);
    const allocations = expenseAllocations(s);
    if (allocations === null) { result.unavailableRefs.push(requestRef); result.review.push({ ref: requestRef, reason: 'Распределение или исполнение не подтверждено' }); continue; }
    // requested_by is the native КтоЗаявил user reference. Compare only with the
    // explicitly saved 1C user/cashier binding, never a cashbox or a display name.
    const applicantRef = ref(record(s.requestedBy).ref);
    const applicants = applicantRef && applicantRef !== '00000000-0000-0000-0000-000000000000'
      ? input.employees.filter(e => ref(e.applicantRef) === applicantRef) : [];
    const applicant = applicants.length === 1 ? applicants[0] : undefined;
    const due = new Map<string, ExpenseAllocation>();
    for (const allocation of allocations.filter(a => a.dueDate <= today)) {
      const existing = due.get(allocation.cashboxRef);
      due.set(allocation.cashboxRef, existing ? { ...existing, remaining: (Math.round(existing.remaining * 100) + Math.round(allocation.remaining * 100)) / 100 } : allocation);
    }
    for (const allocation of due.values()) {
      const base = { ...allocation, ref: requestRef, number: text(s.number), purpose: name(s.cashFlowItem) || name(s.businessOperation) || 'Расход', recipient: name(s.accountablePerson) || name(s.counterparty), date: parseOneCDateTime(s.date)?.toISOString() || input.now.toISOString(), cycle: row.cycle };
      const adminOnly = safe(allocation.cashbox);
      const owners = input.employees.filter(e => ref(e.cashboxRef) === allocation.cashboxRef);
      const shared = allocation.cashboxRef === DELIVERY_PHONE_RESERVE_REF;
      const reserveAllowed = applicant && applicant.department === 'retail' && applicant.cashboxRef && !safe(applicant.cashboxName)
        && !input.ambiguousCashboxRefs?.includes(ref(applicant.cashboxRef)) && input.employees.filter(e => ref(e.cashboxRef) === ref(applicant.cashboxRef)).length === 1;
      const owner = shared ? reserveAllowed ? applicant : undefined : owners.length === 1 && !input.ambiguousCashboxRefs?.includes(allocation.cashboxRef) && !safe(owners[0].cashboxName) ? owners[0] : undefined;
      const assigned = input.adminAssignments?.find(a => a.key === adminExpenseRouteKey(base));
      if (owner?.onShift && !adminOnly && !assigned) {
        result.items.push({ ...base, userId: owner.id, mode: 'execute', onShift: true,
          detail: 'В 1С откройте эту заявку и создайте на её основании расходник. Если деньги ещё не выданы — оформите его после выдачи.' });
      } else {
        const priorDay = assigned?.at && moscowDateKey(new Date(assigned.at)) !== today;
        const reason = priorDay ? `За вами с ${moscowDateKey(new Date(assigned!.at!)).slice(5).split('-').reverse().join('.')}` : assigned && owner?.onShift ? 'Выдача уже передана вам' : assigned?.reason || (adminOnly ? 'Выдача из сейфа — ваша задача' : !owner ? 'Кассир не определён'
          : owner.shiftState === 'ended' ? 'Смена завершена' : owner.shiftState === 'day_off' ? 'Сегодня выходной' : 'Смена не начата');
        result.adminItems.push({ ...base, applicant: name(s.requestedBy) || 'Не указан', reason, ...(assigned && reason !== assigned.reason ? { handoverNote: `При передаче: ${assigned.reason === 'Сегодня выходной' ? 'выходной по графику' : assigned.reason.toLocaleLowerCase('ru-RU')}.` } : {}) });
      }
    }
  }
  result.items = result.items.filter(item => !result.unavailableRefs.includes(item.ref));
  result.adminItems = result.adminItems.filter(item => !result.unavailableRefs.includes(item.ref));
  if (result.state !== 'ready') { result.items = []; result.adminItems = []; } // An outage never retires stored notices or proves completion.
  return result;
}
export function expenseRouteKey(item: ExpenseRouteItem) {
  return `employee-expense:${item.userId}:${item.cashboxRef}:${item.ref}:${item.cycle}${item.mode === 'coordinate' ? ':coordinate' : ''}`;
}
export function expenseRouteCopy(items: ExpenseRouteItem[]) {
  const first = items[0], amount = items.reduce((sum, item) => sum + Math.round(item.remaining * 100), 0) / 100;
  return { title: `Оформите ${items.length > 1 ? 'расходники' : 'расходник'} · ${amount.toLocaleString('ru-RU')} ₽`,
    body: `По заявке № ${first.number} в 1С${items.length > 1 ? ` · касс: ${items.length}` : ''}` };
}
