import type { loadOwnerCashForecastShadow } from './procurement-cash-forecast-loader';
import type { loadProcurementForecastHistory } from './procurement-forecast-history';
import type { fetchPayrollForecastEvidence } from './procurement-payroll-one-c';
import type { fetchTBankOwnerTransferControl } from './tbank-owner-transfer-one-c';
import type { fetchProcurementPriorityDebts } from './procurement-cash-forecast-settlements';
import { buildSupplierIntelligence } from './procurement-supplier-intelligence';
import { buildProcurementDebtAllocation } from './procurement-debt-allocation';
import { buildProcurementCashPreparation } from './procurement-cash-preparation';
import { buildProcurementFinancialAssistant } from './procurement-financial-assistant';
import { assessProcurementRequests } from './procurement-request-funding';
import { isFinishedPaymentState } from './procurement-small-remainder';
const normalizeManagerName = (value: string) => value.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');

export type AdminForecastSources = {
  asOf: string;
  history: Awaited<ReturnType<typeof loadProcurementForecastHistory>> | null;
  owner: Awaited<ReturnType<typeof loadOwnerCashForecastShadow>> | null;
  payroll: Awaited<ReturnType<typeof fetchPayrollForecastEvidence>> | null;
  tbank: Awaited<ReturnType<typeof fetchTBankOwnerTransferControl>> | null;
  debts: Awaited<ReturnType<typeof fetchProcurementPriorityDebts>> | null;
};
export type AdminForecastInput = {
  todayKey: string; plansComplete: boolean; ordersComplete: boolean;
  plansWithOrderContext: {id:string;status:string;supplierPartner:string;paymentMethod:string;plannedDate:string;plannedAmount:string;foreignAmount:string|null;evidence:{state:string;issuedAmount:number;paidAmount:number;remainingForeignAmount?:number|null}}[];
  scopedOrders: {supplierPartner:string;supplierCounterparty:string;orderPaymentGap:number}[];
  managerOrders: {supplierPartner:string;supplierCounterparty:string}[];
  usdtBalance:{balance:number|null}; accountableBalance:{balance:number|null};
  usdtRateReference?:{rate:number|null};
};
function plusDays(value: string, count: number) {
  const result = new Date(`${value}T12:00:00.000Z`);
  result.setUTCDate(result.getUTCDate() + count);
  return result.toISOString().slice(0, 10);
}

function nextMonthDay(value: string, day: number) {
  const current = new Date(`${value}T12:00:00.000Z`);
  const result = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), day, 12));
  if (result.toISOString().slice(0, 10) <= value) result.setUTCMonth(result.getUTCMonth() + 1);
  return result.toISOString().slice(0, 10);
}

function ownerBalance(source: Awaited<ReturnType<typeof loadOwnerCashForecastShadow>>["money"], name: string) {
  const index = source?.accountNames.indexOf(name) ?? -1;
  return index < 0 ? null : source?.positions[index]?.balanceMinor ?? null;
}

/** Same forecast formulas as the calendar; source loading no longer blocks the list. */
export function buildAdminProcurementForecast(input: AdminForecastInput, sources: AdminForecastSources | null) {
  const {todayKey,plansComplete,ordersComplete,plansWithOrderContext,scopedOrders,managerOrders,usdtBalance,accountableBalance,usdtRateReference}=input;
  const ownerForecast = sources?.owner ?? null;
  const ownerMoney = ownerForecast?.money?.complete ? ownerForecast.money : null;
  const safeMinor = ownerBalance(ownerMoney, "Сейф Депозитный");
  const alfaCardMinor = ownerBalance(ownerMoney, "Банк Альфа КБР");
  const vtbCardMinor = ownerBalance(ownerMoney, "Банк ВТБ КБР");
  const tbankCardMinor = ownerBalance(ownerMoney, "Банк ТБанк КБР");
  const cardParts = [alfaCardMinor, vtbCardMinor, tbankCardMinor];
  const cardsMinor = cardParts.every((value) => value !== null)
    ? cardParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const tbankAccountMinor = ownerBalance(ownerMoney, "Т-Банк КБР");
  const vtbAccountMinor = ownerBalance(ownerMoney, "ВТБ КБР");
  const bankParts = [tbankAccountMinor, vtbAccountMinor];
  const bankAccountsMinor = bankParts.every((value) => value !== null)
    ? bankParts.reduce<number>((sum, value) => sum + (value ?? 0), 0)
    : null;
  const payroll = sources?.payroll ?? null;
  const salaryMinor = payroll?.sourceComplete ? payroll.payableMinor : null;
  const salaryDate = nextMonthDay(todayKey, 16);
  const rentDate = nextMonthDay(todayKey, 20);
  const firstDay = nextMonthDay(todayKey, 1);
  const horizonEnd = plusDays(todayKey, 30);
  const forecastPlans = plansWithOrderContext
    .filter((plan) => plan.status === "SUBMITTED" || plan.status === "APPROVED")
    .filter((plan) => !isFinishedPaymentState(plan.evidence.state))
    .map((plan) => {
      const reflected = plan.evidence.state === "MISMATCH"
        ? 0
        : Number(plan.evidence.issuedAmount || 0) + Number(plan.evidence.paidAmount || 0);
      return {
        id: plan.id,
        supplier: plan.supplierPartner,
        paymentMethod: plan.paymentMethod,
        status: plan.status,
        plannedDate: plan.plannedDate.slice(0, 10),
        requestedRub: Math.max(0, Number(plan.plannedAmount) - reflected).toFixed(2),
        issuedRub: "0",
      };
    });
  const datedRows = new Map<string, {
    date: string;
    items: { id: string; title: string; amountMinor: number | null; source: string; certainty: "fact" | "estimate" | "unknown" }[];
    safeOutMinor: number;
    cardsOutMinor: number;
  }>();
  const addForecastItem = (date: string, item: { id: string; title: string; amountMinor: number | null; source: string; certainty: "fact" | "estimate" | "unknown" }, bucket?: "safe" | "cards") => {
    if (date > horizonEnd) return;
    const row = datedRows.get(date) ?? { date, items: [], safeOutMinor: 0, cardsOutMinor: 0 };
    row.items.push(item);
    if (item.amountMinor !== null && bucket === "safe") row.safeOutMinor += item.amountMinor;
    if (item.amountMinor !== null && bucket === "cards") row.cardsOutMinor += item.amountMinor;
    datedRows.set(date, row);
  };
  addForecastItem(salaryDate, {
    id: "salary", title: "Зарплата", amountMinor: salaryMinor,
    source: salaryMinor === null ? "Сумма требует сверки с ОСВ" : "Остаток к выплате по 1С",
    certainty: salaryMinor === null ? "unknown" : "estimate",
  }, "safe");
  addForecastItem(rentDate, {
    id: "rent", title: "ООО «Заря» · аренда и коммунальные", amountMinor: 23_500_000,
    source: "Обычный ежемесячный ориентир: 215 000 ₽ + около 20 000 ₽",
    certainty: "estimate",
  }, "cards");
  addForecastItem(firstDay, {
    id: "salary-first", title: "Первая выплата зарплаты", amountMinor: null,
    source: "Сумма появится после расчёта нового периода", certainty: "unknown",
  });
  let unallocatedPlanCount = 0;
  for (const plan of forecastPlans) {
    if (plan.plannedDate <= todayKey || plan.plannedDate > horizonEnd) continue;
    const requestedMinor = Math.round(Number(plan.requestedRub) * 100);
    const issuedMinor = Math.round(Number(plan.issuedRub ?? "0") * 100);
    const remainingMinor = Math.max(0, requestedMinor - issuedMinor);
    if (!remainingMinor) continue;
    const bucket = ['CASH', 'CNY'].includes(plan.paymentMethod) ? "safe" : undefined;
    if (!bucket) unallocatedPlanCount += 1;
    addForecastItem(plan.plannedDate, {
      id: `plan:${plan.id}`,
      title: `Заявка Астемира · ${plan.supplier}`,
      amountMinor: remainingMinor,
      source: plan.status === "SUBMITTED" ? "Ждёт вашего решения" : "Согласована",
      certainty: "fact",
    }, bucket);
  }
  let runningSafe = safeMinor;
  let runningCards = cardsMinor;
  const forecastRows = [...datedRows.values()].sort((left, right) => left.date.localeCompare(right.date)).map((row) => {
    const safeBeforeMinor = runningSafe;
    const cardsBeforeMinor = runningCards;
    if (runningSafe !== null) runningSafe -= row.safeOutMinor;
    if (runningCards !== null) runningCards -= row.cardsOutMinor;
    return {
      ...row,
      safeBeforeMinor,
      cardsBeforeMinor,
      safeAfterMinor: runningSafe,
      cardsAfterMinor: runningCards,
      gapMinor: Math.max(0, -(runningSafe ?? 0)) + Math.max(0, -(runningCards ?? 0)),
    };
  });
  const firstGap = forecastRows.find((row) => row.gapMinor > 0) ?? null;
  const tbank = sources?.tbank ?? null;
  const tbankCurrentTierRemainingMinor = tbank?.currentRateBps === 0
    ? tbank?.freeRemainingMinor ?? null
    : tbank?.currentRateBps === 100
      ? tbank?.tierOneRemainingMinor ?? null
      : tbank?.currentRateBps === 500
        ? tbank?.tierFiveRemainingMinor ?? null
        : tbank?.currentRateBps === 1500 ? tbankAccountMinor : null;
  const cashPreparation = buildProcurementCashPreparation({
    asOf: todayKey,
    dueOn: salaryDate,
    requiredMinor: salaryMinor,
    safeMinor,
    vtbCardMinor,
    vtbAccountMinor,
    tbankCardMinor,
    tbankAccountMinor,
    tbankTransferStatus: tbank?.status ?? "unavailable",
    tbankCurrentRateBps: tbank?.currentRateBps ?? null,
    tbankCurrentTierRemainingMinor,
  });
  const fundingPlans = plansWithOrderContext
    .filter((plan) => plan.status === "SUBMITTED" || plan.status === "APPROVED")
    .filter((plan) => !isFinishedPaymentState(plan.evidence.state))
    .map((plan) => {
      const plannedMinor = Math.round(Number(plan.plannedAmount || 0) * 100);
      const reflectedMinor = plan.evidence.state === "MISMATCH" ? 0 : Math.round((Number(plan.evidence.issuedAmount || 0) + Number(plan.evidence.paidAmount || 0)) * 100);
      const remainingMinor = Math.max(0, plannedMinor - reflectedMinor);
      const initialForeign = Number(plan.foreignAmount || 0);
      const foreignAmount = plan.evidence.remainingForeignAmount != null ? Number(plan.evidence.remainingForeignAmount) : initialForeign > 0 && plannedMinor > 0 ? initialForeign * Math.min(1, remainingMinor / plannedMinor) : null;
      return { id: plan.id, status: plan.status, paymentMethod: plan.paymentMethod, plannedDate: plan.plannedDate.slice(0, 10), remainingMinor, foreignAmount };
    });
  const requestFundingAssessments = assessProcurementRequests({
    asOf: todayKey, plans: fundingPlans,
    salary: { dueOn: salaryDate, amountMinor: salaryMinor }, rent: { dueOn: rentDate, amountMinor: 23_500_000 },
    safeMinor, cardsMinor, bankAccountsMinor, vtbCardMinor, vtbAccountMinor, tbankCardMinor, tbankAccountMinor,
    tbankTransferStatus: tbank?.status ?? "unavailable", tbankCurrentRateBps: tbank?.currentRateBps ?? null, tbankCurrentTierRemainingMinor,
    usdtBalance: usdtBalance.balance,
    accountableBalanceMinor: accountableBalance.balance == null ? null : Math.round(accountableBalance.balance * 100),
    usdtRate: usdtRateReference?.rate ?? null,
  });
  const priorityDebts = sources?.debts ?? null;
  const scopedSupplierNames = new Set([
    ...managerOrders.map((order) => normalizeManagerName(order.supplierPartner || order.supplierCounterparty)),
    ...forecastPlans.map((plan) => normalizeManagerName(plan.supplier)),
  ]);
  const astemirSupplierWarnings = buildSupplierIntelligence({
    orders: scopedOrders.map((order) => ({
      supplier: order.supplierPartner || order.supplierCounterparty,
      orderPaymentGapMinor: Math.round(Number(order.orderPaymentGap || 0) * 100),
    })),
    debts: (priorityDebts?.supplierDebts ?? [])
      .filter((debt) => scopedSupplierNames.has(normalizeManagerName(debt.name)))
      .map((debt) => ({
        supplier: debt.name,
        debtMinor: Math.round(debt.amountRub * 100),
        verified: priorityDebts?.calculationReady === true,
      })),
  });
  const warningKeys = new Set(astemirSupplierWarnings.map((item) => normalizeManagerName(item.supplier)));
  const supplierWarnings = astemirSupplierWarnings.map((item) => ({
    supplier: item.supplier,
    level: item.level,
    amountMinor: item.primaryAmountMinor,
    metric: item.primaryMetric === "debt" ? "Долг по 1С" : "Осталось по активным заказам",
    reason: item.reason,
    action: item.action,
    confidence: item.confidence,
  }));
  for (const debt of [
    { supplier: "95‑RU", amountRub: priorityDebts?.ninetyFiveRu ?? null, attention: 1_000_000, urgent: 2_000_000 },
    { supplier: "Зелим Чечня", amountRub: priorityDebts?.zelimChechnya ?? null, attention: 300_000, urgent: 1_000_000 },
  ]) {
    if (debt.amountRub === null || debt.amountRub < debt.attention || warningKeys.has(normalizeManagerName(debt.supplier))) continue;
    supplierWarnings.push({
      supplier: debt.supplier,
      level: debt.amountRub >= debt.urgent ? "urgent" : "attention",
      amountMinor: Math.round(debt.amountRub * 100),
      metric: "Долг по 1С",
      reason: "Сальдо превысило установленный порог внимания.",
      action: debt.amountRub >= debt.urgent
        ? "Определить сумму ближайшей частичной оплаты после обязательных выплат."
        : "Проверить договорённость и решить, нужен ли частичный платёж.",
      confidence: priorityDebts?.calculationReady ? "current_snapshot" : "needs_review",
    });
  }
  supplierWarnings.sort((left, right) => (left.level === right.level ? right.amountMinor - left.amountMinor : left.level === "urgent" ? -1 : 1));
  const warningPriority = new Map(supplierWarnings.map((warning) => [
    normalizeManagerName(warning.supplier).replace(/[‐‑–—]/g, "-"),
    warning.level === "urgent" ? 1 : 2,
  ]));
  const approvedPlanReserveMinor = forecastPlans
    .filter((plan) => plan.status === "APPROVED")
    .reduce((sum, plan) => sum + Math.round(Number(plan.requestedRub) * 100), 0);
  const mandatoryReserveMinor = salaryMinor === null || !plansComplete
    ? null
    : salaryMinor + 23_500_000 + approvedPlanReserveMinor;
  const resourcesMinor = safeMinor === null || cardsMinor === null || bankAccountsMinor === null
    ? null
    : safeMinor + cardsMinor + bankAccountsMinor;
  const debtAllocation = buildProcurementDebtAllocation({
    resourcesMinor,
    mandatoryReserveMinor,
    resourcesComplete: ownerMoney !== null,
    debtsComplete: priorityDebts?.calculationReady === true,
    debts: (priorityDebts?.supplierDebts ?? []).map((debt) => {
      const key = normalizeManagerName(debt.name).replace(/[‐‑–—]/g, "-");
      const isNinetyFive = /^95[\s-]*ru$/.test(key);
      const isZelim = key === "зелим чечня";
      return {
        supplier: debt.name,
        debtMinor: Math.round(debt.amountRub * 100),
        priority: isNinetyFive ? 0 : isZelim ? 1 : (warningPriority.get(key) ?? 3) + 1,
        verified: priorityDebts?.calculationReady === true,
      };
    }),
  });
  const financialAssistant = buildProcurementFinancialAssistant({
    cashPreparation,
    debtAllocation,
    dataWarnings: [],
  });
  const forecast30Days = {
    asOf: todayKey,
    horizonEnd,
    checkedAt: new Date().toISOString(),
    rows: forecastRows,
    firstGap: firstGap ? { date: firstGap.date, amountMinor: firstGap.gapMinor } : null,
    safeMinor,
    cardsMinor,
    coverageReady: safeMinor !== null && cardsMinor !== null && unallocatedPlanCount === 0
      && plansComplete && forecastRows.every(row => row.items.every(item => item.amountMinor !== null)),
    allocatedOutMinor: forecastRows.reduce((sum, row) => sum + row.safeOutMinor + row.cardsOutMinor, 0),
    scheduledOutMinor: forecastRows.reduce((sum, row) => sum + row.items.reduce((itemSum, item) => itemSum + (item.amountMinor ?? 0), 0), 0),
    unallocatedPlanCount,
    tbank: tbank ? {
      status: tbank.status,
      renewsOn: tbank.renewsOn,
      freeRemainingMinor: tbank.freeRemainingMinor,
      tierOneRemainingMinor: tbank.tierOneRemainingMinor,
      currentRateBps: tbank.currentRateBps,
    } : null,
    limitations: [
      "Будущие поступления пока не подтверждены и в расчёт не включены.",
      "Переводы между расчётными счетами, картами и сейфом не предполагаются автоматически.",
      ...(unallocatedPlanCount ? [`${unallocatedPlanCount} заявок без подтверждённого источника денег показаны по датам, но не уменьшают сейф или карты.`] : []),
    ],
  };
  return { forecastHistory: sources?.history ?? {state:'unavailable' as const,checkedAt:'',previousChangedAt:'',currentChangedAt:'',change:null}, forecast30Days, supplierWarnings, supplierWarningsReady:Boolean(priorityDebts && ordersComplete), debtAllocation, cashPreparation, financialAssistant, requestFundingAssessments, debtReserveBreakdown:{salaryMinor,rentMinor:23_500_000,approvedPlansMinor:approvedPlanReserveMinor} };
}
