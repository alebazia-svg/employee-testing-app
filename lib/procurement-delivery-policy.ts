// The accountable person is a physical-person reference, NOT the manager/user ref.
export const DELIVERY_PERSON = {
  name: 'Тохов Астемир',
  ref: '0fae75a8-b8d2-11ed-a2b7-0025901e48ee',
  organizationRef: '1c2d6c5c-251f-11ec-ac9f-0025901e48ee',
  currencyRef: '2b18b598-314c-11ed-87c2-0025901e48ee',
} as const;
export const DELIVERY_RESERVE = { target: 35_000, warnAt: 20_000 } as const;
export const DELIVERY_SOURCE = 'procurement_delivery';
export const DELIVERY_OPEN = 'procurement.delivery_requested';
export const DELIVERY_COVERED = 'procurement.delivery_covered';
// Separate audit marker: no second inbox receipt or notification for the same reserve cycle.
export const DELIVERY_REQUEST_SOURCE = 'procurement_delivery_request';
export const DELIVERY_MANUAL_REQUEST = 'procurement.delivery_manual_requested';
export const deliveryManualRequestKey = (reminderId: string) => `delivery:manual:${reminderId}`;
export function legacyDeliveryBuyerRequest(event: { type: string; body: string }) {
  // Compatibility with the first release's fixed, server-generated message.
  return event.type === DELIVERY_OPEN && event.body.includes('Астемир запросил пополнение.');
}
export const DELIVERY_MAX_AGE_MS = 5 * 60_000;

export function deliveryUserAllowed(user: { role: string; portalArea: string; oneCManagerName: string | null; isActive: boolean }) {
  return user.isActive && user.role === 'EMPLOYEE' && user.portalArea === 'PROCUREMENT'
    && user.oneCManagerName === DELIVERY_PERSON.name;
}

export function deliveryFresh(snapshot: { balance: number | null; checkedAt: string }, now = Date.now()) {
  const age = now - Date.parse(snapshot.checkedAt);
  return snapshot.balance !== null && Number.isFinite(snapshot.balance)
    && Number.isFinite(age) && age >= -60_000 && age <= DELIVERY_MAX_AGE_MS;
}

export function deliveryAction(input: {
  snapshot: { balance: number | null; checkedAt: string };
  active: boolean;
  manual: boolean;
  now?: number;
}): 'open' | 'cover' | 'keep' {
  if (!deliveryFresh(input.snapshot, input.now)) return 'keep';
  if (input.active) return input.snapshot.balance! >= DELIVERY_RESERVE.target ? 'cover' : 'keep';
  if (input.snapshot.balance! >= DELIVERY_RESERVE.target) return 'keep';
  return input.manual || input.snapshot.balance! <= DELIVERY_RESERVE.warnAt ? 'open' : 'keep';
}
