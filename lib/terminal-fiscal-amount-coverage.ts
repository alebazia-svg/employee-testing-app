import {buildFiscalTransactions} from './terminal-fiscal-transaction-report';
import {AMOUNT_COVERED_REASON,fiscalAmountCoverageEligible} from './terminal-fiscal-coverage-policy';
import type {TerminalFiscalMatchingOutput,TerminalMapping,BankOperation,OneCCheck,OfdReceipt} from './terminal-fiscal-matching';
/** Shared read-only coverage projection. Exact document assignments remain separate. */
export function applyFiscalAmountCoverage(input:{output:TerminalFiscalMatchingOutput;mapping:TerminalMapping;bankOperations:BankOperation[];oneCChecks:OneCCheck[];ofdReceipts:OfdReceipt[];from:Date;to:Date;complete:{bank:boolean;oneC:boolean;ofd:boolean}}):TerminalFiscalMatchingOutput {
 if(!Object.values(input.complete).every(Boolean))return input.output;
 const mappedChecks=input.oneCChecks.filter(c=>c.sourceType==='acquiring_operation'?c.cardPayments.some(p=>p.acquiringTerminalRef===input.mapping.oneCAcquiringTerminalRef):c.cashRegisterRef===input.mapping.oneCCashRegisterRef);
 const byBank=new Map(input.output.records.map(r=>[r.bankOperationKey,r]));
 const coverage=new Map<string,{refs:string[];bankKeys:string[];cashier?:OneCCheck['cashier']}>();
 const first=new Date(input.from.getTime()+10800000).toISOString().slice(0,10);
 for(let day=Date.parse(`${first}T00:00:00+03:00`);day<input.to.getTime();day+=86400000){
  const rows=buildFiscalTransactions({from:new Date(day),to:new Date(day+86400000),parts:[{mapping:input.mapping,bankOperations:input.bankOperations,oneCChecks:mappedChecks,ofdReceipts:input.ofdReceipts,records:input.output.records,complete:input.complete}]});
  for(const row of rows.filter(r=>r.status==='covered')){
   if(row.bank.some(b=>{const r=byBank.get(b.key);return !r||(!(r.status==='confirmed'&&r.reasonCode!==AMOUNT_COVERED_REASON)&&!fiscalAmountCoverageEligible(r));}))continue;
   const cs=row.oneC.flatMap(v=>mappedChecks.filter(c=>c.sourceRef===v.key)),cashiers=cs.filter(c=>c.cashier.ref).map(c=>c.cashier);
   const cashier=cashiers.length===cs.length&&new Set(cashiers.map(c=>c.ref)).size===1?cashiers[0]:undefined;
   const proof={refs:row.oneC.map(c=>c.key),bankKeys:row.bank.map(b=>b.key),cashier};
   for(const b of row.bank)if(fiscalAmountCoverageEligible(byBank.get(b.key)!))coverage.set(b.key,proof);
  }
 }
 return {...input.output,records:input.output.records.map(r=>{
  const proof=coverage.get(r.bankOperationKey);if(!proof)return r;
  const changed={...r,status:'confirmed' as const,reasonCode:AMOUNT_COVERED_REASON,
   oneCCheckKey:undefined,ofdReceiptKey:undefined,oneCCashierRef:proof.cashier?.ref,oneCCashierName:proof.cashier?.name,
   evidence:{...r.evidence,amountCoverage:{bankKeys:proof.bankKeys,oneCRefs:proof.refs}},
   history:[...r.history.filter(h=>h.at!==r.evaluatedAt),{at:r.evaluatedAt,status:'confirmed' as const,reasonCode:AMOUNT_COVERED_REASON}]};
  return changed;
 })};
}
