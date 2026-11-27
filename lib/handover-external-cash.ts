type Row = Record<string, unknown>;
function record(value: unknown): Row {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Row : {};
}

export function handoverCashBoundary(value: unknown) {
  const draft = record(value);
  if (draft.draft !== true || typeof record(draft.personalCash).cashBalance !== 'number') return null;
  const timestamp = draft.cashCountStartedAt ?? record(draft.oneCAudit).capturedAt ?? draft.updatedAt;
  const time = typeof timestamp === 'string' ? Date.parse(timestamp) : NaN;
  return Number.isFinite(time) ? time : null;
}

export function isSeparateCashOperation(key: string) {
  return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(key)
    && !/^00000000-0000-4000-8000-/i.test(key);
}

export type HandoverCashOperation = {
  id: number;
  workDayEntryId: number;
  direction: string;
  status: string;
  separate: boolean;
  createdAt: string | Date;
  oneCPostedAt?: string | Date | null;
};

export function externalCashSinceCount<T extends HandoverCashOperation>(
  rows: T[], workDayEntryId: number, boundary: number | null,
) {
  if (boundary === null) return [];
  return rows.filter(row => row.separate && row.workDayEntryId === workDayEntryId
    && (row.direction === 'deposit_safe' || row.direction === 'phone_reserve')
    && row.status !== 'cancelled' && Math.max(+new Date(row.createdAt), row.oneCPostedAt ? +new Date(row.oneCPostedAt) : 0) >= boundary)
    .sort((a, b) => a.id - b.id);
}
