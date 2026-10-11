import type { DeliveryHistoryRow, DeliveryView } from './procurement-delivery-reminders';
import { deliveryRequestIsClosed } from './procurement-delivery-native';

export function deliveryMatchesQuery(value: DeliveryView | DeliveryHistoryRow, query: string) {
  const details = 'snapshot' in value ? value.requestDetails : value.details;
  const native = 'snapshot' in value ? value.nativeRequest : value.native;
  const haystack = ['Астемир', 'Подотчёт', 'Выдача подотчётнику', details?.amount, details?.comment,
    native?.status?.number, native?.status?.cashbox].join(' ').toLocaleLowerCase('ru-RU');
  return !query.trim() || haystack.includes(query.trim().toLocaleLowerCase('ru-RU'));
}
export function deliveryRowRef(value: DeliveryView | DeliveryHistoryRow) {
  const native = 'snapshot' in value ? value.nativeRequest : value.native;
  return (value.nativeRef || (native?.state === 'linked' ? native.status?.ref : '') || '').toLowerCase();
}
export function deliveryIsCurrent(view: DeliveryView, now = Date.now()) {
  return !deliveryRequestIsClosed(view, now) && (!view.requestStateAvailable || view.requested);
}

/** Keep only a verified identity for the same request through a temporary read failure. */
export function retainDeliveryIdentity(previous: DeliveryView | undefined, next: DeliveryView): DeliveryView {
  if (deliveryRowRef(next) || !previous?.requestDetails || !next.requestDetails || !next.requested
    || previous.requestDetails.requestedAt !== next.requestDetails.requestedAt) return next;
  const ref = deliveryRowRef(previous);
  return ref ? { ...next, nativeRef: ref } : next;
}
