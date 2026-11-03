import { isDeepStrictEqual } from 'node:util';
import type { MatchingAuditRecord, OneCCheck, OfdReceipt } from './terminal-fiscal-matching';

/** Employee routing only: retain the acquiring document in the financial audit. */
export function missingReceiptReviewRecord(
  record: MatchingAuditRecord, checks: OneCCheck[], receipts?: OfdReceipt[],
): MatchingAuditRecord {
  if (record.status !== 'needs_review' || record.reasonCode !== 'OFD_RECEIPT_NOT_FOUND'
    || record.operationType !== 'sale' || !record.oneCCheckKey || record.candidateCount !== 1
    || record.ofdReceiptKey || !Object.values(record.sourceCompleteness).every(Boolean)
    || !receipts) return record;
  const linked = checks.filter(check => check.sourceRef === record.oneCCheckKey);
  if (linked.length === 0 || linked.some(check => !isDeepStrictEqual(check, linked[0])) || linked[0].sourceType !== 'acquiring_operation'
    || linked[0].operationType !== 'sale' || linked[0].fiscalState !== 'unconfirmed'
    || linked[0].fiscalDriveNumber || linked[0].fiscalDocumentNumber || linked[0].fiscalSign
    || linked[0].electronicKopecks !== record.amountKopecks) return record;
  // A possible fiscal receipt on either known workplace requires document linking,
  // not a second fiscalization. The existing coverage guard also checks 1C peers.
  if (receipts.some(receipt => receipt.operationType === 1
    && receipt.electronicKopecks === record.amountKopecks
    && receipt.totalKopecks >= record.amountKopecks)) return record;
  return { ...record, oneCCheckKey: undefined, candidateCount: 0, reasonCode: 'ONE_C_CANDIDATE_NOT_FOUND' };
}
