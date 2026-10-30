'use client';
import { cashOutboxResponseAcknowledges, type EmployeeCashOutboxItem } from './employee-cash-outbox';

/** An outbox retry first reads the durable portal receipt. Never upload the
 * original multi-megabyte photo again merely because its response was lost.
 * A pending 1C status acknowledges persistence only, not financial completion.
 */
export async function readEmployeeCashReceipt<T>(item: EmployeeCashOutboxItem, fetcher: typeof fetch = fetch): Promise<{ operation: T } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`/api/employee/cash-operations?idempotencyKey=${encodeURIComponent(item.id)}`, { cache: 'no-store', signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Не удалось проверить сохранение инкассации. Сумма и фото остаются на телефоне.');
    const payload: unknown = await response.json().catch(() => null);
    if (!cashOutboxResponseAcknowledges(payload, item)) throw new Error('Портал не подтвердил именно эту инкассацию. Сумма и фото остаются на телефоне.');
    return payload as { operation: T };
  } finally { clearTimeout(timeout); }
}
