import {isFinishedPaymentState} from './procurement-small-remainder';
import {paymentPreparationDate} from './procurement-schedule';
import type {QrFunding} from './procurement-qr-funding';

export type PreparationPlan={id:string;status:string;plannedDate:string;oneCCashEvidence?:unknown;plannedAmount:string|number;paymentMethod:string;fundingSource?:string|null;foreignAmount:string|number|null;exchangeRate?:string|number|null;commissionAmount?:string|number|null;evidence:{state:string;verification?:string;issuedAmount:number;paidAmount:number;paidForeignAmount?:number;remainingAmount:number;remainingForeignAmount:number|null;paymentAmountNeedsConfirmation?:boolean;qrFunding?:QrFunding}};
export type DayPreparation={id:string;day:string|null;route:'cash'|'bank'|'wallet'|'unknown';amount:number|null;estimated:boolean;reason:string};
const number=(v:unknown)=>v===null||v===undefined||v===''?null:Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const minor=(n:number)=>Number.isSafeInteger(Math.round(n*100))?Math.round(n*100):NaN;
const unknown=(p:PreparationPlan,reason:string):DayPreparation=>({id:p.id,day:paymentPreparationDate(p),route:p.fundingSource==='WALLET'?'wallet':['CASH','CNY','USDT'].includes(p.paymentMethod)?'cash':['BANK','ACCOUNTABLE_QR'].includes(p.paymentMethod)?'bank':'unknown',amount:null,estimated:false,reason});
/** Read-only projection of reconciled evidence. Does not match documents, issue
 * money, close requests or alter reservations in 1C. Pass ALL plans, not a tab.
 * Wallet choices reserve first; automatic funding consumes a whole request only.
 */
export function calculateDayPreparation(plans:PreparationPlan[],wallet:{balance:number|null;current:boolean},evidenceCurrent=true){
 const seen=new Set<string>();
 for(const p of plans){if(seen.has(p.id))throw Error('DUPLICATE_PREPARATION_PLAN');seen.add(p.id);}
 const active=plans.filter(p=>['SUBMITTED','APPROVED'].includes(p.status)&&!isFinishedPaymentState(p.evidence.state));
 const results=new Map<string,DayPreparation>();
 const foreign=new Map<string,number|null>();
 for(const p of active){
  const e=p.evidence, planned=number(p.plannedAmount),issued=number(e.issuedAmount),paid=number(e.paidAmount);
  if(!evidenceCurrent||e.verification!=='current'||!['NO_EVIDENCE','PARTIALLY_ISSUED','PARTIALLY_PAID_BY_ONE_C'].includes(e.state)||e.paymentAmountNeedsConfirmation||planned===null||issued===null||paid===null||!Number.isFinite(minor(planned))){results.set(p.id,unknown(p,'Оплата уточняется'));continue;}
  let amount=number(e.remainingAmount);
  if(amount===null||!Number.isFinite(minor(amount))||amount>planned||Math.abs(minor(amount)-Math.max(0,minor(planned)-minor(issued)-minor(paid)))>1){results.set(p.id,unknown(p,'Остаток оплаты уточняется'));continue;}
  const fx=['USDT','CNY'].includes(p.paymentMethod);
  let foreignLeft=number(p.foreignAmount);
  if(fx&&(issued>0||paid>0||Number(e.paidForeignAmount)>0)){
   // RUB cash already issued is confirmed funding; never invent foreign units.
   if(issued>0){foreignLeft=null;}
   else {
    foreignLeft=number(e.remainingForeignAmount);
    const rate=number(p.exchangeRate), commission=number(p.commissionAmount??0);
    if(foreignLeft===null||rate===null||rate===0||commission!==0){results.set(p.id,unknown(p,'Курс или остаток валюты уточняется'));continue;}
    amount=minor(foreignLeft*rate)/100;
   }
  }
  foreign.set(p.id,foreignLeft);
  const route=p.paymentMethod==='BANK'||p.paymentMethod==='ACCOUNTABLE_QR'?'bank':fx||p.paymentMethod==='CASH'?'cash':'unknown';
  if(route==='unknown'){results.set(p.id,unknown(p,'Источник денег уточняется'));continue;}
  if(p.paymentMethod==='ACCOUNTABLE_QR'){
   const q=e.qrFunding;
   if(!q||q.state==='unavailable'||q.lastConfirmed){results.set(p.id,unknown(p,'Перемещение уточняется'));continue;}
   if(q.state==='confirmed'){
    // Supplier RKO spends the same transferred money: use max, not sum.
    const funded=number(q.amount);
    const owners=plans.filter(other=>other.evidence.qrFunding?.state==='confirmed'&&other.evidence.qrFunding.documentRef===q.documentRef);
    if(!q.documentRef||owners.length!==1||funded===null||funded!==planned){results.set(p.id,unknown(p,'Связь перемещения уточняется'));continue;}
    amount=0;
   }
  }
  results.set(p.id,{id:p.id,day:paymentPreparationDate(p),route,amount:minor(amount)/100,estimated:fx,reason:amount===0?'Деньги уже выделены':''});
 }
 let available=wallet.current?number(wallet.balance):null;
 for(const p of plans.filter(p=>!['CANCELLED','COMPLETED_WITHOUT_TOPUP','SUBMITTED','APPROVED'].includes(p.status)&&p.paymentMethod==='USDT'&&p.fundingSource==='WALLET'&&!isFinishedPaymentState(p.evidence.state))){
  const n=number(p.evidence.remainingForeignAmount??p.foreignAmount);
  available=available===null||n===null||p.evidence.verification!=='current'?null:Math.max(0,available-n);
 }
 const usdt=active.filter(p=>p.paymentMethod==='USDT'&&p.fundingSource!=='CASH_EXCHANGE');
 // Undated explicit reservations still consume the wallet; an unknown reservation
 // blocks automatic reuse rather than making money apparently available.
 const explicit=usdt.filter(p=>p.fundingSource==='WALLET');
 let reserve=0,invalidReserve=false;
 for(const p of explicit){const r=results.get(p.id)!;const n=foreign.get(p.id);if(r.amount===null||n==null||n<=0){invalidReserve=true;continue;}reserve+=n;}
 const walletEnough=available!==null&&!invalidReserve&&available+1e-8>=reserve;
 for(const p of explicit){const r=results.get(p.id)!;results.set(p.id,walletEnough&&r.amount!==null?{...r,route:'wallet',amount:0,estimated:false,reason:'Из кассы USDT'}:unknown(p,'Остаток кассы USDT уточняется'));}
 available=available===null||invalidReserve?null:Math.max(0,available-reserve);
 const automatic=usdt.filter(p=>p.fundingSource!=='WALLET').sort((a,b)=>(paymentPreparationDate(a)||'9999').localeCompare(paymentPreparationDate(b)||'9999')||a.id.localeCompare(b.id));
 for(const p of automatic){
  const r=results.get(p.id)!;if(r.amount===null){available=null;continue;}
  // Already-issued RUB funds must not also consume wallet money.
  if(p.evidence.issuedAmount>0)continue;
  const n=foreign.get(p.id);
  if(available===0)continue;
  if(available===null||n==null||n<=0){available=null;results.set(p.id,unknown(p,'Остаток кассы USDT уточняется'));continue;}
  if(available+1e-8>=n){available=Math.max(0,Math.round((available-n)*1e8)/1e8);results.set(p.id,{...r,route:'wallet',amount:0,estimated:false,reason:'Из кассы USDT'});}
 }
 return results;
}
