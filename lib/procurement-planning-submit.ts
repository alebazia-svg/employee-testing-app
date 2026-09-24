import 'server-only';
import type { SupplierOrderFinanceRow } from './procurement-payment-source';
import { verifySelectedPlanningOrders } from './procurement-planning-sync';

export async function planningSubmissionError(rows: SupplierOrderFinanceRow[], requested: { refs: string[]; amount: number }[]) {
  if (process.env.PROCUREMENT_PLANNING_MODE !== 'snapshot') return null;
  if (new Set(rows.map(row => row.ref)).size > 20) return 'За одну отправку можно проверить до 20 заказов. Разделите список оплат.';
  try {
    const unique = [...new Map(rows.map(row => [row.ref, row])).values()];
    const checked = await verifySelectedPlanningOrders(unique);
    const allowed = new Map(checked.filter(row => ['prepayment', 'receipt_debt'].includes(row.planningState || '') && row.orderPaymentGap > 500).map(row => [row.ref, row]));
    const used = new Set<string>();
    for (const request of requested) {
      if (!request.refs.length) continue;
      if (new Set(request.refs).size !== request.refs.length || request.refs.some(ref => used.has(ref) || !allowed.has(ref))) return 'Оплата по одному из заказов уже погашена или требует сверки. Обновите календарь; при оплате общего долга выберите «В счёт долга поставщику».';
      request.refs.forEach(ref => used.add(ref));
      const available = request.refs.reduce((sum, ref) => sum + allowed.get(ref)!.orderPaymentGap, 0);
      if (request.amount > available + .009) return 'Остаток по выбранным заказам уменьшился. Обновите календарь и сумму заявки.';
    }
    return null;
  } catch { return 'Не удалось повторно проверить выбранные заказы в 1С. Заявка не отправлена — повторите позже.'; }
}
