import 'server-only';
import {getCashStatementDimensions} from './one-c';
import {readOneCRuntimeEnv} from './one-c-env';
import {createInFlightRead} from './procurement-inflight-read';
import {matchQrFunding,type QrFunding,type QrFundingPlan} from './procurement-qr-funding';
import type {ProcurementPaymentEvidence} from './procurement-currency-payment-evidence';

const read=createInFlightRead<{payload:unknown;target:string}>();
export async function readQrFunding(plans:QrFundingPlan[],today:string) {
 const checkedAt=new Date().toISOString();
 const unavailable=()=>new Map(plans.map(p=>[p.id,{state:'unavailable',checkedAt} as QrFunding]));
 if(!plans.some(p=>p.paymentMethod==='ACCOUNTABLE_QR'&&p.status==='APPROVED'))return new Map<string,QrFunding>();
 const from=new Date(Date.parse(today+'T12:00:00Z')-30*86400000).toISOString().slice(0,10);
 try {
  const {payload,target}=await read(today,async()=>{
   const dims=await getCashStatementDimensions();
   const orgs=dims.ok?dims.organizations.filter(o=>!o.deleted&&o.name.trim().toLocaleLowerCase('ru-RU')==='оффоника'):[];
   const boxes=dims.ok?dims.cashboxes.filter(o=>!o.deleted&&o.name.trim().toLocaleLowerCase('ru-RU')==='касса подотчетника'):[];
   if(orgs.length!==1||boxes.length!==1)throw Error('QR_DIMENSIONS_AMBIGUOUS');
   const env=readOneCRuntimeEnv();if(!env.baseUrl||!env.user||!env.password)throw Error('QR_SOURCE_UNCONFIGURED');
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
   try {
    const query=new URLSearchParams({date_from:from,date_to:today,money_type:'cash',organization_ref:orgs[0].ref,limit:'3000'});
    const response=await fetch(`${env.baseUrl}/money-statement?${query}`,{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json',Authorization:`Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}`}});
    if(!response.ok)throw Error('QR_SOURCE_UNAVAILABLE');
    return {payload:await response.json(),target:boxes[0].ref};
   }finally{clearTimeout(timer);}
  });
  return matchQrFunding(plans,payload,target,from,today,checkedAt);
 }catch{return unavailable();}
}
/** Adds an operational annotation only. Never modifies paid/issued amounts,
 * collection, matched expenses, reserves or financial completion state. */
export function attachQrFunding(evidence:Map<string,ProcurementPaymentEvidence>,funding:Map<string,QrFunding>) {
 for(const [id,row] of evidence){const value=funding.get(id);if(value)row.qrFunding=value;}
}
