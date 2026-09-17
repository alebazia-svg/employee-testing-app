import { paymentMatchCreatedAt } from '@/lib/procurement-plan-revision';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { fetchSupplierCurrencyPaymentSnapshot } from '@/lib/procurement-currency-payment-source';
import { fetchExpenseRequestSnapshot } from '@/lib/expense-request-source';
import { matchProcurementPaymentEvidence } from '@/lib/procurement-currency-payment-evidence';
import { paymentEvidenceFrom, paymentTimestamp, uniqueSupplierPayments } from '@/lib/procurement-ruble-payment-evidence';
import { manualPaymentLinks, paymentFingerprint, samePaymentSupplier } from '@/lib/procurement-manual-payment-links';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const { id } = await props.params;
  const payload = await req.json().catch(() => null);
  if (!payload || !['LINK', 'UNLINK'].includes(payload.action) || typeof payload.ref !== 'string' ||
      !/^[a-f0-9-]{36}$/i.test(payload.ref)) return Response.json({ error: 'Выберите расходник.' }, { status: 400 });
  const ref = payload.ref.toLowerCase();
  try {
    const initial = await prisma.supplierPaymentPlan.findMany();
    const to = new Date();
    const from = paymentEvidenceFrom(initial, new Date(to.getTime() - 30 * 86400_000));
    const [source, requests] = payload.action === 'LINK' ? await Promise.all([
      fetchSupplierCurrencyPaymentSnapshot({ from, to }), fetchExpenseRequestSnapshot({ from, to }),
    ]) : [null, null];
    if (payload.action === 'LINK' && (!source?.complete || !requests?.complete)) {
      return Response.json({ error: 'Не удалось полностью проверить оплаты в 1С. Зачёт не сохранён.' }, { status: 503 });
    }
    await prisma.$transaction(async (tx) => {
      // All link/unlink operations share a lock: two requests cannot claim one RKO.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
      const rows = await tx.supplierPaymentPlan.findMany({ include: { manager: { select: { name: true, oneCManagerName: true } } } });
      const plan = rows.find((row) => row.id === id);
      if (!plan) throw new Error('Заявка не найдена.');
      const links = manualPaymentLinks(plan.oneCCashEvidence);
      let next = links.filter((link) => link.ref.toLowerCase() !== ref);
      if (payload.action === 'LINK') {
        if (plan.status !== 'APPROVED') throw new Error('Выберите согласованную заявку.');
        const payment = uniqueSupplierPayments(source!.payments).find((row) => row.ref.toLowerCase() === ref && row.documentCurrency === (plan.paymentMethod === 'USDT' ? 'USDT' : 'РУБ'));
        if (!payment?.posted || payment.deleted || !samePaymentSupplier(plan, payment) ||
            !(paymentTimestamp(payment.date) >= plan.createdAt.getTime())) throw new Error('Расходник не соответствует поставщику или дате заявки.');
        const fingerprint = paymentFingerprint(payment);
        if (links.some((link) => link.ref.toLowerCase() === ref && link.fingerprint === fingerprint)) return;
        if (rows.some((row) => manualPaymentLinks(row.oneCCashEvidence).some((link) => link.ref.toLowerCase() === ref))) {
          throw new Error('Этот расходник уже зачтён. Сначала отмените предыдущую привязку.');
        }
        const evidencePlans = rows.map((row) => ({
          ...row, orderRefs: Array.isArray(row.orderRefs) ? row.orderRefs.map(String) : [],
          plannedAmount: Number(row.plannedAmount), foreignAmount: row.foreignAmount == null ? null : Number(row.foreignAmount),
          plannedDate: row.plannedDate.toISOString(), createdAt: paymentMatchCreatedAt(row),
          managerName: row.manager.oneCManagerName || row.manager.name, manualRubleLinks: manualPaymentLinks(row.oneCCashEvidence),
        }));
        const evidence = matchProcurementPaymentEvidence(evidencePlans, requests!.rows, source!.payments, source!.conversions);
        if ([...evidence.values()].some((row) => [...row.cashOrders, ...row.currencyPayments].some((order) => order.ref.toLowerCase() === ref))) {
          throw new Error('Расходник уже связан с заявкой по данным 1С.');
        }
        const proposed = matchProcurementPaymentEvidence(evidencePlans.map((row) => row.id === id ? { ...row, manualRubleLinks: [...next, { ref, fingerprint }] } : row), requests!.rows, source!.payments, source!.conversions).get(id)!;
        const remaining = evidence.get(id)?.remainingAmount || 0;
        const assignedForeign = proposed.currencyPayments.find((row) => row.ref.toLowerCase() === ref)?.foreignAmount || 0;
        if (payment.documentAmount <= 0 || (payment.documentCurrency === 'USDT'
          ? Math.abs(assignedForeign - payment.documentAmount) > 0.000001
          : Math.round(payment.documentAmount * 100) > Math.round(remaining * 100))) {
          throw new Error('Сумма расходника больше остатка заявки. Такой платёж требует отдельного распределения.');
        }
        next = [...next, { ref, fingerprint }];
      }
      const previous = plan.oneCCashEvidence && typeof plan.oneCCashEvidence === 'object' && !Array.isArray(plan.oneCCashEvidence) ? plan.oneCCashEvidence : {};
      await tx.supplierPaymentPlan.update({ where: { id }, data: { oneCCashEvidence: { ...previous, manualRubleLinks: next } } });
      await tx.supplierPaymentPlanEvent.create({ data: { planId: id, actorUserId: access.user.id,
        action: payload.action === 'LINK' ? 'PAYMENT_LINKED' : 'PAYMENT_UNLINKED',
        snapshot: { ref, manualRubleLinks: next, source: 'owner_confirmation_no_one_c_write' } } });
    });
    return Response.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error && /^[А-ЯЁ]/.test(error.message) ? error.message : 'Не удалось проверить или сохранить привязку. Повторите позже.';
    return Response.json({ error: message }, { status: 409 });
  }
}
