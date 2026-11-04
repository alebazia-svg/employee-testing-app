export const CASH_DUPLICATE_CODE = 'CASH_OPERATION_DUPLICATE';
export type CashDuplicateSummary = {
  id: number; userId: number; workDayEntryId: number; date: string;
  amount: number; direction: string; createdAt: string; status: string;
};

/** Never acknowledge/delete another queued request on the strength of amount
 * alone. The server rejection must identify this request and its owner/shift.
 */
export function cashDuplicateResult(value: unknown, item: {
  id: string; userId: number; workDayEntryId: number; direction: string; amount: string; protocol?: 2;
}): CashDuplicateSummary | null {
  if (!value || typeof value !== 'object') return null;
  const result = value as Record<string, unknown>;
  if (result.code !== CASH_DUPLICATE_CODE || result.requestedIdempotencyKey !== item.id
    || !result.operation || typeof result.operation !== 'object') return null;
  const row = result.operation as Record<string, unknown>;
  if (!Number.isSafeInteger(row.id) || Number(row.id) <= 0 || row.userId !== item.userId
    || row.workDayEntryId !== item.workDayEntryId || row.direction !== item.direction
    || typeof row.amount !== 'number' || !Number.isFinite(row.amount) || row.amount <= 0
    || item.protocol !== 2 && row.amount !== Number(item.amount.replace(',', '.'))
    || typeof row.createdAt !== 'string' || !Number.isFinite(Date.parse(row.createdAt))
    || typeof row.date !== 'string' || typeof row.status !== 'string') return null;
  return row as CashDuplicateSummary;
}
