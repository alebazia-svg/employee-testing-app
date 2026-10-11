import type { DeliveryView } from './procurement-delivery-reminders';
import { deliveryNativeFresh } from './procurement-delivery-native';
export type ExpenseQueueStage = 'decision' | 'issuance' | 'check';
export function deliveryQueueStage(view: DeliveryView, now: number): ExpenseQueueStage {
  const native = view.nativeRequest;
  if (!view.requestStateAvailable || !native || native.state === 'unavailable') return 'check';
  if (native.state === 'unlinked') return native.reviewReason ? 'check' : 'decision';
  if (!native.status || !deliveryNativeFresh(native.status, now)) return 'check';
  if (native.status.state === 'payable' || native.status.state === 'partial') return 'issuance';
  return native.status.state === 'waiting' || native.status.state === 'approved' ? 'decision' : 'check';
}
export function requestWaitingAge(since: string | null | undefined, now: number) {
  const at = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(at) || at > now) return null;
  const minutes = Math.floor((now - at) / 60_000);
  return { label: minutes < 1 ? 'меньше минуты' : minutes < 60 ? `${minutes} мин` : minutes < 1440 ? `${Math.floor(minutes / 60)} ч` : `${Math.floor(minutes / 1440)} дн`, overDay: minutes >= 1440 };
}
