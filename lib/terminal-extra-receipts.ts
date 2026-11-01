import {canonicalFiscalKey,normalizeMatchingItemName,type BankOperation,type OneCCheck,type OfdReceipt,type TerminalMapping,type MatchingItem} from './terminal-fiscal-matching';
export const EXTRA_RECEIPT_RULE='terminal_extra_receipt';
export type ExtraReceiptSnapshot={now:string;periodFrom?:string;periodTo?:string;complete:{bank:boolean;oneC:boolean;ofd:boolean;peers:boolean};banks:BankOperation[];checks:OneCCheck[];receipts:OfdReceipt[];mapping:TerminalMapping};
export type ExtraReceiptCase={key:string;mappingId:string;cashierRef:string;amountKopecks:number;bankKey:string;bankAt:string;checkRefs:string[];facts:Array<[string,string]>};
const minute=60_000;
const day=(s:string)=>new Date(Date.parse(s)+180*minute).toISOString().slice(0,10);
const bankKey=(b:BankOperation)=>[b.terminalKey,b.rrn,b.transactionDate,b.type,b.amountKopecks].join('|');
const time=(s:string)=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'}).format(new Date(s));
function itemKey(i:MatchingItem){return JSON.stringify([normalizeMatchingItemName(i.name.replace(/\s*\(шт\.?\)\s*$/iu,'')),i.quantity,i.priceKopecks,i.sumKopecks]);}
function sameItems(a:MatchingItem[],b:MatchingItem[]){return a.length>0&&a.length===b.length&&JSON.stringify(a.map(itemKey).sort())===JSON.stringify(b.map(itemKey).sort());}
export function extraReceiptSnapshotComplete(s:ExtraReceiptSnapshot){return Object.values(s.complete).every(Boolean)&&Number.isFinite(Date.parse(s.now));}
function proven(c:OneCCheck,s:ExtraReceiptSnapshot){
 const key=canonicalFiscalKey(c);if(!key||c.fiscalState!=='confirmed'||c.fiscalConflict||!c.items.length||!Number.isSafeInteger(c.totalKopecks)||c.totalKopecks<=0||c.items.some(i=>!Number.isFinite(i.quantity)||i.quantity<=0||!Number.isSafeInteger(i.priceKopecks)||i.priceKopecks<0||!Number.isSafeInteger(i.sumKopecks)||Math.round(i.quantity*i.priceKopecks)!==i.sumKopecks)||c.items.reduce((n,i)=>n+i.sumKopecks,0)!==c.totalKopecks)return false;
 const same=s.receipts.filter(r=>canonicalFiscalKey(r)===key);
 if(same.length!==1)return false;const r=same[0];
 return r.operationType===(c.operationType==='sale'?1:c.operationType==='refund'?2:-1)&&r.kktRegistrationNumber===c.kktRegistrationNumber&&r.totalKopecks===c.totalKopecks&&r.electronicKopecks===c.electronicKopecks&&sameItems(c.items,r.items);
}
/** Remove only a proven fiscal reversal of an explicitly referenced sale.
 * A real terminal refund remains in the financial matching path. */
export function netConfirmedReceiptReversals(s:ExtraReceiptSnapshot){
 const removed=new Set<string>();const pairs:Array<{originalRef:string;refundRef:string}>=[];
 if(!extraReceiptSnapshotComplete(s))return {checks:s.checks,pairs};
 for(const refund of s.checks){
  if(refund.sourceType!=='refund_check'||refund.operationType!=='refund'||!refund.originalCheckRef||!proven(refund,s))continue;
  const originals=s.checks.filter(c=>c.sourceRef===refund.originalCheckRef);
  if(originals.length!==1)continue;const original=originals[0];
  if(original.sourceType!=='sale_check'||original.operationType!=='sale'||!proven(original,s)||removed.has(original.sourceRef)
   ||original.cashRegisterRef!==refund.cashRegisterRef||original.kktRegistrationNumber!==refund.kktRegistrationNumber
   ||original.totalKopecks!==refund.totalKopecks||original.electronicKopecks!==refund.electronicKopecks
   ||original.electronicKopecks!==original.totalKopecks||!sameItems(original.items,refund.items)
   ||!Number.isFinite(Date.parse(refund.dateTime))||Date.parse(refund.dateTime)<Date.parse(original.dateTime)||day(original.dateTime)!==day(refund.dateTime))continue;
  if(s.checks.filter(c=>c.originalCheckRef===original.sourceRef&&c.operationType==='refund').length!==1)continue;
  if(s.banks.some(b=>b.type==='Credit'&&b.amountKopecks===refund.electronicKopecks&&Date.parse(b.transactionDate)>=Date.parse(original.dateTime)&&day(b.transactionDate)===day(refund.dateTime)))continue;
  removed.add(original.sourceRef);removed.add(refund.sourceRef);pairs.push({originalRef:original.sourceRef,refundRef:refund.sourceRef});
 }
 return {checks:s.checks.filter(c=>!removed.has(c.sourceRef)),pairs};
}
/** Conservative possible duplicate: complete reads, one payment, two distinct
 * OFD-backed equal-goods checks from one actual cashier. Never assigns which is wrong. */
export function detectPossibleExtraReceipts(s:ExtraReceiptSnapshot):ExtraReceiptCase[]{
 if(!extraReceiptSnapshotComplete(s))return [];
 const checks=netConfirmedReceiptReversals(s).checks;
 const uniqueBanks=[...new Map(s.banks.map(b=>[bankKey(b),b])).values()];
 const out=new Map<string,ExtraReceiptCase>();
 for(const bank of uniqueBanks){
  const at=Date.parse(bank.transactionDate);if(bank.type!=='Debit'||bank.terminalKey!==s.mapping.terminalKey||!Number.isFinite(at)||!Number.isSafeInteger(bank.amountKopecks)||bank.amountKopecks<=0)continue;
  if(s.periodFrom&&at<Date.parse(s.periodFrom)||s.periodTo&&at>=Date.parse(s.periodTo))continue;
  if(at<Date.parse(s.mapping.activeFrom)||s.mapping.activeTo&&at>=Date.parse(s.mapping.activeTo))continue;
  const near=checks.filter(c=>c.cashRegisterRef===s.mapping.oneCCashRegisterRef&&c.electronicKopecks===bank.amountKopecks&&Number.isFinite(Date.parse(c.dateTime))&&day(c.dateTime)===day(bank.transactionDate)&&Date.parse(c.dateTime)>=at-5*minute&&Date.parse(c.dateTime)<=at+30*minute);
  if(near.length!==2)continue;const [a,b]=near;
  if(a.sourceRef===b.sourceRef||canonicalFiscalKey(a)===canonicalFiscalKey(b)||!a.cashier.ref||a.cashier.ref!==b.cashier.ref||!sameItems(a.items,b.items))continue;
  if(near.some(c=>c.sourceType!=='sale_check'||c.operationType!=='sale'||c.totalKopecks!==c.electronicKopecks||c.cardPayments.length!==1||c.cardPayments[0].amountKopecks!==c.electronicKopecks||c.cardPayments[0].acquiringTerminalRef!==s.mapping.oneCAcquiringTerminalRef||!proven(c,s)))continue;
  const latest=Math.max(...near.map(c=>Date.parse(c.dateTime)));
  if(Date.parse(s.now)-latest<30*minute)continue;
  // Any equal-amount competing payment/refund on either workplace prevents a personal question.
  if(uniqueBanks.filter(p=>p.amountKopecks===bank.amountKopecks&&Number.isFinite(Date.parse(p.transactionDate))&&day(p.transactionDate)===day(bank.transactionDate)&&Date.parse(p.transactionDate)>=at-30*minute&&Date.parse(p.transactionDate)<=latest+30*minute).length!==1)continue;
  const refs=near.map(c=>c.sourceRef).sort(),ordered=[...near].sort((a,b)=>a.dateTime.localeCompare(b.dateTime));
  const amount=`${(bank.amountKopecks/100).toLocaleString('ru-RU')} ₽`;
  const key=[s.mapping.id,bankKey(bank),...refs].join('|');
  out.set(key,{key,mappingId:s.mapping.id,cashierRef:a.cashier.ref,amountKopecks:bank.amountKopecks,bankKey:bankKey(bank),bankAt:bank.transactionDate,checkRefs:refs,
   facts:[['Оплата',`${amount} · ${time(bank.transactionDate)} · ${bank.rawType==='TERM_SBP'?'СБП':'терминал'}`],...(bank.terminalReceiptNumber?[['Чек терминала',`№${bank.terminalReceiptNumber}`] as [string,string]]:[]),...ordered.map((c,i)=>[`Чек 1С ${i+1}`,`${c.documentNumber?'№'+c.documentNumber:'ФД №'+c.fiscalDocumentNumber} · ${time(c.dateTime)}`] as [string,string]),['Сумма каждого',amount]]});
 }
 return [...out.values()];
}
