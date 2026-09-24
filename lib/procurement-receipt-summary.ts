import type { OrderReceiptSettlement } from './procurement-planning-verification';

/** Receipt grain, never order face amounts. Duplicate ownership invalidates
 * the aggregate instead of silently counting the same liability twice. */
export function summarizeOrderReceipts(rows: { ref: string; supplierPartner: string; receiptSettlement?: OrderReceiptSettlement }[]) {
  const orders = new Set<string>(), receipts = new Set<string>();
  const suppliers = new Map<string, string>();
  let debtMinor = 0, measured = 0, positive = 0, advanceReview = 0;
  const bySupplier: Record<string, number> = {};
  for (const row of rows) {
    if (orders.has(row.ref)) return null;
    orders.add(row.ref);
    const evidence = row.receiptSettlement;
    if (!evidence) continue;
    const supplierKey = JSON.stringify(evidence.supplier);
    if (suppliers.has(row.supplierPartner) && suppliers.get(row.supplierPartner) !== supplierKey) return null;
    suppliers.set(row.supplierPartner, supplierKey);
    if (!evidence.receipts.length) return null;
    let subtotal = 0;
    for (const receipt of evidence.receipts) {
      const minor = Math.round(receipt.remainingRub * 100);
      if (!receipt.ref || receipts.has(receipt.ref) || !Number.isSafeInteger(minor) || minor < 0
        || Math.abs(receipt.remainingRub * 100 - minor) > 0.00001) return null;
      receipts.add(receipt.ref);
      subtotal += minor;
    }
    if (!Number.isSafeInteger(subtotal) || subtotal !== Math.round(evidence.debtRub * 100)) return null;
    measured++;
    if (subtotal > 0) positive++;
    if (evidence.requiresAdvanceReview && subtotal > 0) advanceReview++;
    debtMinor += subtotal;
    if (!Number.isSafeInteger(debtMinor)) return null;
    bySupplier[row.supplierPartner] = (bySupplier[row.supplierPartner] || 0) + subtotal;
  }
  return { debtRub: debtMinor / 100, measured, positive, advanceReview,
    withoutReceiptEvidence: rows.length - measured,
    bySupplier: Object.fromEntries(Object.entries(bySupplier).map(([key, minor]) => [key, minor / 100])) };
}
