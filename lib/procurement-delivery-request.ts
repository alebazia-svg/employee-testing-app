/** Portal request only: these values never authorize a cash issue. */
export type DeliveryRequestInput = { amount: number; comment: string };
export type DeliveryRequestDetails = DeliveryRequestInput & { balance: number; checkedAt: string; requestedAt: string };
export const deliveryDetailsKey = (reminderId: string) => `delivery:manual:${reminderId}:details`;

export function parseDeliveryRequest(value: unknown): DeliveryRequestInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => key !== 'amount' && key !== 'comment')) return null;
  if (typeof data.amount !== 'number' || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 999_999_999.99
    || Math.abs(data.amount * 100 - Math.round(data.amount * 100)) > 0.00001) return null;
  if (data.comment !== undefined && typeof data.comment !== 'string') return null;
  const comment = ((data.comment as string | undefined) ?? '').trim();
  if (comment.length > 500 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(comment)) return null;
  return { amount: Math.round(data.amount * 100) / 100, comment };
}

export function deliveryAmountFromText(value: string): number | null {
  const normalized = value.trim().replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  return parseDeliveryRequest({ amount: Number(normalized) })?.amount ?? null;
}

// Versioned payload on a private audit event; old text-only markers remain untouched.
export function readDeliveryDetails(body: string): DeliveryRequestDetails | null {
  try {
    const data = JSON.parse(body);
    const input = parseDeliveryRequest({ amount: data.amount, comment: data.comment });
    if (data.version !== 1 || !input || typeof data.balance !== 'number' || !Number.isFinite(data.balance)
      || typeof data.checkedAt !== 'string' || !Number.isFinite(Date.parse(data.checkedAt))
      || typeof data.requestedAt !== 'string' || !Number.isFinite(Date.parse(data.requestedAt))) return null;
    return { ...input, balance: data.balance, checkedAt: data.checkedAt, requestedAt: data.requestedAt };
  } catch { return null; }
}
