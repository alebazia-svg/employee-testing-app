import type { ExpenseRequestSourceRow } from '@/lib/expense-request-source';

export const PAYMENT_METHODS = ['CASH', 'BANK', 'USDT', 'ACCOUNTABLE_QR'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export type PaymentPlanInput = {
  supplierPartner?: unknown;
  supplierCounterparty?: unknown;
  orderRefs?: unknown;
  orderNumbers?: unknown;
  plannedDate?: unknown;
  plannedAmount?: unknown;
  condition?: unknown;
  paymentMethod?: unknown;
  currency?: unknown;
  foreignAmount?: unknown;
  exchangeRate?: unknown;
  commissionAmount?: unknown;
  exchangerName?: unknown;
  supplierConfirmation?: unknown;
};

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
const positive = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : null; };

export function validatePaymentPlan(input: PaymentPlanInput) {
  const method = clean(input.paymentMethod).toUpperCase() as PaymentMethod;
  const refs = Array.isArray(input.orderRefs) ? input.orderRefs.map(clean).filter(Boolean) : [];
  const numbers = Array.isArray(input.orderNumbers) ? input.orderNumbers.map(clean).filter(Boolean) : [];
  const date = clean(input.plannedDate);
  const data = {
    supplierPartner: clean(input.supplierPartner), supplierCounterparty: clean(input.supplierCounterparty),
    orderRefs: refs, orderNumbers: numbers, plannedDate: date, plannedAmount: positive(input.plannedAmount),
    condition: clean(input.condition) || 'Оплата по выбранным заказам', paymentMethod: method, currency: clean(input.currency).toUpperCase() || (method === 'USDT' ? 'USDT' : 'RUB'),
    foreignAmount: positive(input.foreignAmount), exchangeRate: positive(input.exchangeRate),
    commissionAmount: input.commissionAmount === '' || input.commissionAmount == null ? null : Number(input.commissionAmount),
    exchangerName: clean(input.exchangerName), supplierConfirmation: clean(input.supplierConfirmation),
  };
  const errors: string[] = [];
  if (!data.supplierPartner) errors.push('Выберите поставщика из заказов 1С.');
  if (!data.orderRefs.length) errors.push('Выберите хотя бы один заказ 1С.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.plannedDate)) errors.push('Укажите плановую дату оплаты.');
  if (method === 'USDT') {
    if (!data.plannedAmount && !data.foreignAmount) errors.push('Укажите сумму в рублях или USDT.');
  } else if (!data.plannedAmount) errors.push('Укажите сумму оплаты в рублях.');
  if (!PAYMENT_METHODS.includes(method)) errors.push('Выберите способ оплаты.');
  return { ok: errors.length === 0, errors, data };
}

export function buildPaymentPlanCode(now = new Date(), random = Math.random()) {
  return `PAY-${now.toISOString().slice(0, 10).replaceAll('-', '')}-${Math.floor(random * 1_000_000).toString().padStart(6, '0')}`;
}

export type CashPreparationPlan = { id: string; plannedDate: string; plannedAmount: number; paymentMethod: string; foreignAmount?: number | null; exchangeRate?: number | null; commissionAmount?: number | null; issued?: boolean };

export function calculateCashPreparation(plans: CashPreparationPlan[], usdtBalance: number | null, todayKey: string) {
  let remainingUsdt = usdtBalance;
  const eligible = plans.filter((plan) => !plan.issued && plan.plannedDate.slice(0, 10) >= todayKey).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
  const rows = eligible.map((plan) => {
    if (plan.paymentMethod === 'CASH') return { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: plan.plannedAmount };
    if (plan.paymentMethod !== 'USDT') return { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: 0 };
    if (!Number(plan.foreignAmount || 0)) return { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: plan.plannedAmount, estimated: true };
    if (remainingUsdt == null) return { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: plan.plannedAmount, estimated: true };
    const requiredUsdt = Number(plan.foreignAmount || 0);
    const coveredUsdt = Math.min(remainingUsdt, requiredUsdt);
    const deficitUsdt = Math.max(0, requiredUsdt - coveredUsdt);
    remainingUsdt = Math.max(0, remainingUsdt - requiredUsdt);
    if (deficitUsdt <= 0) return { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: 0 };
    const rate = Number(plan.exchangeRate || 0);
    return rate > 0
      ? { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: deficitUsdt * rate + Number(plan.commissionAmount || 0) }
      : { planId: plan.id, plannedDate: plan.plannedDate, cashRequired: plan.plannedAmount, estimated: true };
  }).filter((row) => row.cashRequired > 0.009);
  const plannedUsdt = eligible.filter((plan) => plan.paymentMethod === 'USDT').reduce((sum, plan) => sum + Number(plan.foreignAmount || 0), 0);
  const unknownUsdtCount = eligible.filter((plan) => plan.paymentMethod === 'USDT' && !Number(plan.foreignAmount || 0)).length;
  return { rows, plannedUsdt, unknownUsdtCount, usdtDeficit: usdtBalance == null || unknownUsdtCount > 0 ? null : Math.max(0, plannedUsdt - usdtBalance) };
}

const normalized = (value: unknown) => clean(value).toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');

export function matchCashEvidence(plan: { planCode: string; supplierPartner: string; supplierCounterparty: string; plannedAmount: number; managerName?: string; plannedDate?: string }, requests: ExpenseRequestSourceRow[]) {
  const candidates = requests.filter((request) => {
    const haystack = `${clean(request.comment)} ${clean(request.payment_purpose)}`;
    if (haystack.toUpperCase().includes(plan.planCode.toUpperCase())) return true;
    const supplier = normalized(request.counterparty?.name || request.partner?.name);
    return Boolean(supplier) && [plan.supplierPartner, plan.supplierCounterparty].some((name) => normalized(name) === supplier) && Math.abs(Number(request.amount || 0) - plan.plannedAmount) < 0.01;
  });
  const strong = candidates.filter((request) => `${clean(request.comment)} ${clean(request.payment_purpose)}`.toUpperCase().includes(plan.planCode.toUpperCase()));
  const exactFallback = candidates.filter((request) => {
    const managerMatches = Boolean(plan.managerName) && normalized(request.requested_by?.name) === normalized(plan.managerName);
    const requestDate = clean(request.desired_payment_date || request.payment_date).slice(0, 10);
    return managerMatches && Boolean(plan.plannedDate) && requestDate === clean(plan.plannedDate).slice(0, 10);
  });
  const selected = strong.length ? strong : exactFallback.length === 1 ? exactFallback : [];
  const orders = selected.flatMap((request) => request.linked_cash_expense_orders?.rows || []).filter((order) => order.posted === true && order.deletion_mark !== true);
  const issuedAmount = orders.reduce((sum, order) => sum + Number(order.executed_amount ?? order.amount ?? 0), 0);
  return {
    state: issuedAmount > 0 ? 'ISSUED_BY_ONE_C' : candidates.length > 0 && !strong.length ? 'NEEDS_REVIEW' : 'NO_EVIDENCE',
    issuedAmount,
    cashOrders: orders.map((order) => ({ ref: order.ref || '', number: order.number || '', date: order.date || '', amount: Number(order.executed_amount ?? order.amount ?? 0), cashbox: order.cashbox?.name || '' })),
  } as const;
}
