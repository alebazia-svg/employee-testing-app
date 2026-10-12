/** Only individual, identifiable records belong in a focused notification dialog. */
export type NotificationOpening = 'payment' | 'receipts' | 'expense' | 'page';
export function adminNotificationOpening(event:{sourceType?:string;type:string;body?:string;href:string}):NotificationOpening {
  if(event.sourceType==='supplier_payment_receipt'&&event.type==='procurement.receipt_added')return 'receipts';
  // Legacy batch events stored the first plan as sourceId: do not hide the rest.
  if(event.sourceType==='supplier_payment_plan'&&!/ · \d+ оплат · /.test(event.body||''))return 'payment';
  if(event.sourceType==='expense_request'&&/^\/admin\/expense-requests\/[^/?#]+$/.test(event.href))return 'expense';
  return 'page';
}
export function employeeNotificationOpening(item:{kind:string}):NotificationOpening {
  if(item.kind==='procurement_receipt_added')return 'receipts';
  if(['procurement_payment_approved','procurement_payment_needs_changes','procurement_payment_cancelled'].includes(item.kind))return 'payment';
  return 'page';
}
export function safeNotificationHref(href:string,fallback:string) {
  return /^\/(?!\/)/.test(href)&&!/[\\\u0000-\u0020]/.test(href)?href:fallback;
}
