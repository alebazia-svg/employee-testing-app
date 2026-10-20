import type { BankOperation, MatchingAuditRecord, OneCCheck, TerminalFiscalMatchingInput, TerminalMapping } from './terminal-fiscal-matching';

export const FISCAL_CHAIN_REASONS = ['ONE_C_SPLIT_RECEIPTS_REVIEW', 'ONE_C_COMBINED_PAYMENTS_REVIEW', 'ONE_C_EXCHANGE_REVIEW'] as const;
export type FiscalChainEvidence = {
  alternatives: number;
  payments: Array<{ at: string; amountKopecks: number }>;
  checks: Array<{ ref: string; at: string; amountKopecks: number; refund: boolean; fiscalDocumentNumber: string; cashierName: string }>;
};
export type FiscalChainReason = typeof FISCAL_CHAIN_REASONS[number];
export const isFiscalChainReason = (reason: string): reason is FiscalChainReason => (FISCAL_CHAIN_REASONS as readonly string[]).includes(reason);

// A balanced sum is evidence for an administrator, not proof of a bank link.
// Keep grouped evidence outside the unique one-payment/one-receipt assignment.
export function fiscalChainReview(input: TerminalFiscalMatchingInput, records: MatchingAuditRecord[], proof: (check: OneCCheck, mapping: TerminalMapping) => boolean) {
  const minute = 60_000;
  const checks = [...new Map(input.oneCChecks.map(c => [c.sourceRef, c])).values()];
  const byKey = new Map(records.map(r => [r.bankOperationKey, r]));
  const used = new Set(records.filter(r => r.oneCCheckKey).map(r => r.oneCCheckKey));
  const key = (b: BankOperation) => [b.terminalKey, b.rrn, b.transactionDate, b.type, b.amountKopecks].join('|');
  const day = (s: string) => Number.isFinite(Date.parse(s)) ? new Date(Date.parse(s) + 180 * minute).toISOString().slice(0, 10) : '';
  return records.map(record => {
    if (record.status !== 'needs_review' || record.reasonCode !== 'ONE_C_CANDIDATE_NOT_FOUND') return record;
    const bank = input.bankOperations.find(b => key(b) === record.bankOperationKey);
    const mapping = input.mappings.find(m => m.id === record.mappingId);
    if (!bank || !mapping || bank.type !== 'Debit') return record;
    const at = Date.parse(bank.transactionDate);
    const near = checks.filter(c => c.sourceType === 'sale_check' && c.operationType === 'sale'
      && c.cardPayments.length === 1 && c.cardPayments[0].acquiringTerminalRef === mapping.oneCAcquiringTerminalRef
      && c.cardPayments[0].amountKopecks === c.electronicKopecks
      && day(c.dateTime) === day(bank.transactionDate)
      && Date.parse(c.dateTime) >= at - 5 * minute && Date.parse(c.dateTime) <= at + 180 * minute
      && proof(c, mapping));
    const free = near.filter(c => !used.has(c.sourceRef));
    let reason: FiscalChainReason | undefined;
    const hypotheses = new Map<string, {reason: FiscalChainReason; payments: BankOperation[]; checks: OneCCheck[]}>();
    const add = (kind: FiscalChainReason, payments: BankOperation[], checks: OneCCheck[]) => {
      const id = [kind, ...payments.map(key).sort(), ...checks.map(c => c.sourceRef).sort()].join('|');
      hypotheses.set(id, {reason: kind, payments, checks});
    };
    free.forEach((a, i) => free.slice(i + 1).forEach(b => {
      if (a.electronicKopecks > 0 && b.electronicKopecks > 0 && a.electronicKopecks + b.electronicKopecks === bank.amountKopecks) {
        reason = 'ONE_C_SPLIT_RECEIPTS_REVIEW'; add(reason, [bank], [a, b]);
      }
    }));
    const peers = input.bankOperations.filter(b => b !== bank && b.type === 'Debit' && b.terminalKey === bank.terminalKey
      && b.rrn !== bank.rrn && Math.abs(Date.parse(b.transactionDate) - at) <= 10 * minute
      && day(b.transactionDate) === day(bank.transactionDate));
    for (const peer of peers) {
      const peerRecord = byKey.get(key(peer));
      for (const sale of free.filter(c => c.electronicKopecks === bank.amountKopecks + peer.amountKopecks)) {
        if (Date.parse(sale.dateTime) < Date.parse(peer.transactionDate) - 5 * minute) continue;
        if (peerRecord && (!peerRecord.oneCCheckKey || checks.some(c => c.sourceRef === peerRecord.oneCCheckKey
          && day(c.dateTime) !== day(peer.transactionDate)))) {
          reason ??= 'ONE_C_COMBINED_PAYMENTS_REVIEW'; add('ONE_C_COMBINED_PAYMENTS_REVIEW', [bank, peer], [sale]);
        }
        const original = checks.find(c => c.sourceRef === peerRecord?.oneCCheckKey);
        if (!original || original.sourceType !== 'sale_check' || original.electronicKopecks !== peer.amountKopecks || !proof(original, mapping)) continue;
        const refunds = checks.filter(c => c.sourceType === 'refund_check' && c.operationType === 'refund'
          && c.electronicKopecks === original.electronicKopecks && proof(c, mapping)
          && Math.abs(Date.parse(c.dateTime) - Date.parse(sale.dateTime)) <= 10 * minute
          && Date.parse(c.dateTime) >= Date.parse(original.dateTime)
          && JSON.stringify(c.items) === JSON.stringify(original.items));
        const bankRefund = input.bankOperations.some(b => b.type === 'Credit' && b.terminalKey === bank.terminalKey
          && b.amountKopecks === peer.amountKopecks && Math.abs(Date.parse(b.transactionDate) - at) <= 180 * minute);
        if (refunds.length === 1 && !bankRefund) { reason = 'ONE_C_EXCHANGE_REVIEW'; add(reason, [bank, peer], [original, refunds[0], sale]); }
      }
    }
    if (!reason) return record;
    const selected = [...hypotheses.values()].filter(h => h.reason === reason);
    const unique = selected.length === 1 ? selected[0] : null;
    const chain: FiscalChainEvidence = { alternatives: selected.length,
      payments: unique?.payments.map(b => ({at: b.transactionDate, amountKopecks: b.amountKopecks})) ?? [],
      checks: unique?.checks.map(c => ({ref: c.sourceRef, at: c.dateTime, amountKopecks: c.electronicKopecks,
        refund: c.operationType === 'refund', fiscalDocumentNumber: c.fiscalDocumentNumber ?? '', cashierName: c.cashier.name})) ?? [],
    };
    return { ...record, reasonCode: reason, candidateCount: selected.length, evidence: {...record.evidence, chain} };
  });
}
