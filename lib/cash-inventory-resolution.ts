import { parseOneCDateTime } from './one-c-date';
import type { OneCCashStatementSummaryResult } from './one-c';

export type CashInventoryResolution = {
  documentRef:string; documentName:string; occurredAt:string; checkedAt:string; difference:number;
};
const minor=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?Math.round(value*100):null;
/** Derived display evidence only. Never alter the original count or its 1C snapshot. */
export function cashInventoryResolution(input:{actual:number|null;expected:number|null;capturedAt:string;cashboxRef:string;statement:OneCCashStatementSummaryResult|null},now=new Date()):CashInventoryResolution|null {
 const s=input.statement,actual=minor(input.actual),expected=minor(input.expected),captured=Date.parse(input.capturedAt);
 if(!s?.ok || actual===null || expected===null || actual===expected || !Number.isFinite(captured) || !input.cashboxRef || s.params.cashboxRef.toLowerCase()!==input.cashboxRef.toLowerCase() || s.cashbox?.ref.toLowerCase()!==input.cashboxRef.toLowerCase())return null;
 const checked=Date.parse(s.checkedAt);
 if(!Number.isFinite(checked)||checked>+now||+now-checked>6*60_000||captured>checked||s.params.date!==s.date||s.date!==new Date(captured).toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'})||s.movementsCount!==s.movements.length)return null;
 const opening=minor(s.openingBalance),incoming=minor(s.incomingTotal),outgoing=minor(s.outgoingTotal),closing=minor(s.closingBalance);
 if(opening===null||incoming===null||outgoing===null||closing!==actual||opening+incoming-outgoing!==closing)return null;
 let totalIn=0,totalOut=0;
 const later=[];
 for(const movement of s.movements){
  const at=parseOneCDateTime(movement.period),inc=minor(movement.incoming),out=minor(movement.outgoing);
  if(!at||at.toLocaleDateString('sv-SE',{timeZone:'Europe/Moscow'})!==s.date||+at>checked||inc===null||out===null||inc<0||out<0)return null;
  totalIn+=inc;totalOut+=out;
  if(+at>captured)later.push({movement,at,inc,out});
 }
 if(totalIn!==incoming||totalOut!==outgoing||later.length!==1)return null;
 const {movement,at,inc,out}=later[0];
 if(movement.documentType!=='Инвентаризация наличных денежных средств'||!movement.document.ref||inc-out!==actual-expected||(inc>0&&out>0))return null;
 return {documentRef:movement.document.ref,documentName:movement.document.name,occurredAt:at.toISOString(),checkedAt:s.checkedAt,difference:(actual-expected)/100};
}
