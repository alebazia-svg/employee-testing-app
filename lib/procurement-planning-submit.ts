import 'server-only';
import type { SupplierOrderFinanceRow } from './procurement-payment-source';
import { verifySelectedPlanningOrders } from './procurement-planning-sync';
import { hasCurrentPaidClosure, hasRecordedPaidClosure } from './procurement-order-payment-closure';

export async function planningSubmissionError(rows: SupplierOrderFinanceRow[], requested: { refs: string[]; amount: number; condition?: string }[], onVerified?: (rows: SupplierOrderFinanceRow[]) => void) {
  if (new Set(rows.map(row => row.ref)).size > 20) return 'За одну отправку можно проверить до 20 заказов. Разделите список оплат.';
  try {
    const unique = [...new Map(rows.map(row => [row.ref, row])).values()];
    const checked = await verifySelectedPlanningOrders(unique);
    if (checked.some(row => hasCurrentPaidClosure(row))) return 'Приобретения уже оплачены. Обновите список заказов.';
    if (checked.some(row => hasRecordedPaidClosure(row))) return 'Ранее полная оплата уже подтверждалась. Повторная заявка недоступна до обновления сверки с 1С.';
    const allowed = new Map(checked.map(row => [row.ref, row]));
    const used = new Set<string>();
    for (const request of requested) {
      if (!request.refs.length) continue;
      if (new Set(request.refs).size !== request.refs.length || request.refs.some(ref => used.has(ref) || !allowed.has(ref))) return 'Заказ недоступен или выбран дважды. Обновите список заказов.';
      request.refs.forEach(ref => used.add(ref));
    }
    onVerified?.(checked);
    return null;
  } catch { return 'Не удалось повторно проверить выбранные заказы в 1С. Заявка не отправлена — повторите позже.'; }
}
