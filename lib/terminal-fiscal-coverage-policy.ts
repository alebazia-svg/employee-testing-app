import type {MatchingAuditRecord} from './terminal-fiscal-matching';
export const AMOUNT_COVERED_REASON='MATCH_AMOUNT_COVERED' as const;
const eligible=new Set(['OFD_CANDIDATE_REQUIRES_LINK','ONE_C_CANDIDATE_PENDING','ONE_C_CANDIDATE_NOT_FOUND','ONE_C_MULTIPLE_CANDIDATES','ONE_C_CHECK_REUSED','ONE_C_SPLIT_RECEIPTS_REVIEW','ONE_C_COMBINED_PAYMENTS_REVIEW','ONE_C_EXCHANGE_REVIEW']);
/** Amount coverage must never retire a proven fiscal mismatch or source failure. */
export function fiscalAmountCoverageEligible(record:MatchingAuditRecord){
 return (record.status==='pending'||record.status==='needs_review'||record.reasonCode===AMOUNT_COVERED_REASON)
  &&(eligible.has(record.reasonCode)||record.reasonCode===AMOUNT_COVERED_REASON)
  &&record.sourceCompleteness?.tbank===true&&record.sourceCompleteness?.oneC===true&&record.sourceCompleteness?.ofd===true;
}
