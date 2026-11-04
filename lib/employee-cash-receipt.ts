'use client';
import { cashMetadataAcknowledges, type EmployeeCashOutboxItem } from './employee-cash-outbox';

/** An outbox retry first reads the durable portal receipt. Never upload the
 * original multi-megabyte photo again merely because its response was lost.
 * A pending 1C status acknowledges persistence only, not financial completion.
 */
export async function readEmployeeCashReceipt<T>(item: EmployeeCashOutboxItem, fetcher: typeof fetch = fetch): Promise<{ operation: T } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetcher(`/api/employee/cash-operations?idempotencyKey=${encodeURIComponent(item.id)}${item.protocol === 2 ? '&protocol=2' : ''}`, { cache: 'no-store', signal: controller.signal });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('Нет подтверждения от портала. Повторим отправку.');
    const payload: unknown = await response.json().catch(() => null);
    if (!cashMetadataAcknowledges(payload, item)) throw new Error('Портал не подтвердил именно эту инкассацию. Повторим проверку.');
    return payload as { operation: T };
  } finally { clearTimeout(timeout); }
}

/** Observe persistence while the original POST continues. This never creates or
 * retries financial documents. A cancelled/late read cannot change a finished UI.
 */
export function watchEmployeeCashPersistence<T>(item: EmployeeCashOutboxItem, onSaved: (operation: T) => void,
  read = () => readEmployeeCashReceipt<T>(item), intervalMs = 1000) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    try {
      const receipt = await read();
      if (!stopped && receipt) { stopped = true; onSaved(receipt.operation); return; }
    } catch { /* The original POST still owns the upload outcome. */ }
    if (!stopped) timer = setTimeout(() => { void poll(); }, intervalMs);
  };
  void poll();
  return () => { stopped = true; if (timer !== undefined) clearTimeout(timer); };
}
