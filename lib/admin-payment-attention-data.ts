import 'server-only';
import { prisma } from './prisma';
import { getMoscowDateKey } from './workday';
import { expenseListItem } from './expense-request-list-item';
import { expenseRequestMoscowDayEnd } from './expense-request-source';
import { readProcurementExpenseDisplay } from './procurement-expense-display';
import { fetchSupplierCurrencyPaymentDisplaySnapshot } from './procurement-currency-payment-source';
import { matchProcurementPaymentEvidence } from './procurement-currency-payment-evidence';
import { paymentEvidenceFrom } from './procurement-ruble-payment-evidence';
import { savedPaymentEvidence } from './procurement-evidence-continuity';
import { manualPaymentLinks } from './procurement-manual-payment-links';
import { paymentCompletion } from './procurement-payment-completion';
import { paymentMatchCreatedAt, readPaymentRevision } from './procurement-plan-revision';
import { getProcurementBalances } from './procurement-currency-balance';
import { attachQrFunding, readQrFunding } from './procurement-qr-funding-source';
import { calculateDayPreparation } from './procurement-day-preparation';
import { paymentPreparationDate } from './procurement-schedule';
import { supplierPaymentAttention } from './admin-payment-attention';


async function readExpenseDecisions() {
  const rows = await prisma.expenseRequestAdminCase.findMany({
    where: { currentCycleOrigin: 'live', deletionMark: false, OR: [{ isNotApproved: true }, { currentStatusKey: 'approved' }] },
    include: { evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 } },
  });
  return rows.filter(row => expenseListItem(row).stage === 'decision').length;
}

async function readSupplierAttention(now: Date, today: string) {
  const rows = await prisma.supplierPaymentPlan.findMany({
    include: { manager: { select: { name: true, oneCManagerName: true } } },
    orderBy: [{ plannedDate: 'asc' }, { createdAt: 'desc' }],
  });
  const plans = rows.map(row => ({
    ...row,
    id: row.id,
    managerName: row.manager.oneCManagerName || row.manager.name,
    orderRefs: Array.isArray(row.orderRefs) ? row.orderRefs.map(String) : [],
    plannedAmount: Number(row.plannedAmount),
    foreignAmount: row.foreignAmount === null ? null : Number(row.foreignAmount),
    exchangeRate: row.exchangeRate === null ? null : Number(row.exchangeRate),
    commissionAmount: row.commissionAmount === null ? null : Number(row.commissionAmount),
    plannedDate: row.plannedDate.toISOString(),
    createdAt: paymentMatchCreatedAt(row),
    hasPendingRevision: Boolean(readPaymentRevision(row.oneCCashEvidence)),
    manualRubleLinks: manualPaymentLinks(row.oneCCashEvidence),
    completedPaymentRefs: paymentCompletion(row.oneCCashEvidence)?.paymentRefs,
  }));
  const lastEvidence = new Map(rows.map(row => [row.id, savedPaymentEvidence(row)?.evidence]));
  const savedDecisions = plans.filter(plan => plan.hasPendingRevision ||
    (plan.status === 'SUBMITTED' && lastEvidence.get(plan.id)?.state !== 'PAID_BY_ONE_C')).length;
  const tomorrow = new Date(Date.parse(today) + 86_400_000).toISOString().slice(0, 10);
  const due = plans.filter(plan => {
    const day = paymentPreparationDate({ ...plan, evidence: lastEvidence.get(plan.id) });
    return plan.status === 'APPROVED' && !plan.hasPendingRevision && day && day <= tomorrow;
  });
  if (!due.length) return { decisions: savedDecisions, preparation: 0 };

  const to = expenseRequestMoscowDayEnd(now);
  const from = paymentEvidenceFrom(rows, new Date(to.getTime() - 31 * 86_400_000));
  const hasWallet = plans.some(plan => plan.paymentMethod === 'USDT' && plan.fundingSource !== 'CASH_EXCHANGE');
  const [requests, payments, qrFunding, balances, receipts] = await Promise.allSettled([
    readProcurementExpenseDisplay(from, to),
    fetchSupplierCurrencyPaymentDisplaySnapshot({ from, to, timeoutMs: 15_000, plans: rows }),
    readQrFunding(plans, today),
    hasWallet ? getProcurementBalances(today) : null,
    prisma.supplierPaymentReceipt.groupBy({ by: ['planId'], where: { planId: { in: due.map(plan => plan.id) } } }),
  ]);
  if (requests.status !== 'fulfilled' || !requests.value.complete || payments.status !== 'fulfilled' ||
      !payments.value.complete || !payments.value.rubPaymentsSupported || receipts.status !== 'fulfilled') {
    return { decisions: savedDecisions, preparation: null };
  }
  const evidence = matchProcurementPaymentEvidence(plans, requests.value.rows, payments.value.payments,
    payments.value.conversions, { allowSmallRemainder: true });
  if (qrFunding.status === 'fulfilled') attachQrFunding(evidence, qrFunding.value);
  const checkedPlans = plans.map(plan => ({
    ...plan, evidence: { ...evidence.get(plan.id)!, verification: 'current' as const },
  }));
  const wallet = balances.status === 'fulfilled' ? balances.value?.usdt : undefined;
  const walletCurrent = Boolean(wallet && !wallet.error && Number.isFinite(Date.parse(wallet.checkedAt)) &&
    getMoscowDateKey(new Date(wallet.checkedAt)) === today);
  const preparation = calculateDayPreparation(checkedPlans, { balance: wallet?.balance ?? null, current: walletCurrent });
  return supplierPaymentAttention(checkedPlans, today, preparation,
    new Set(receipts.value.map(receipt => receipt.planId)), true);
}


// Reuse a bounded read across administrators, including requests received while
// it is still running. Expiry also follows the Moscow business date.
function sharedAttention<T>(read: (now: Date, day: string) => Promise<T>, refreshMs: number) {
  let cached: { value: T | null; day: string; expires: number } | undefined;
  let loading: { day: string; promise: Promise<T | null> } | undefined;
  return (now = new Date()) => {
    const day = getMoscowDateKey(now);
    if (cached?.day === day && now.getTime() < cached.expires) return Promise.resolve(cached.value);
    if (loading?.day === day) return loading.promise;
    const promise = read(now, day).catch(() => null).then(value => {
      if (loading?.promise === promise) {
        cached = { value, day, expires: Date.now() + refreshMs };
        loading = undefined;
      }
      return value;
    });
    loading = { day, promise };
    return promise;
  };
}

export const readExpenseAttention = sharedAttention(readExpenseDecisions, 30_000);
export const readSupplierPaymentAttention = sharedAttention(readSupplierAttention, 150_000);
