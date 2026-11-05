import {createHash} from 'node:crypto';
import {requisitesShareAmount} from './procurement-requisites-share';
import {isFinishedPaymentState} from './procurement-small-remainder';
import {readPaymentRevision} from './procurement-plan-revision';
export class SharePreparationError extends Error {constructor(message:string,public status=409){super(message);}}
export type ShareSelection={id:string;version:string};
export type ShareEntry={id:string;version:string;supplier:string;currency:string;amount:number|null;text:string;network:string;files:{id:string;sha256:string;mimeType:string;size:number;originalName?:string;createdAt?:string}[]};
export type ShareManifest={entries:ShareEntry[];stamp:string;checkedAt:string};
/** Every attachment is selected by its own planId, never by list position or supplier name. */
export async function prepareShareManifest(db:any,actor:{role:string},selection:ShareSelection[],readEvidence:()=>Promise<any>,expectedStamp?:string):Promise<ShareManifest>{
 if(actor.role!=='ADMIN')throw new SharePreparationError('Нет доступа.',403);
 if(!Array.isArray(selection)||selection.length<1||selection.length>10||selection.some(s=>!s||typeof s.id!=='string'||s.id.length>100||typeof s.version!=='string')||new Set(selection.map(s=>s.id)).size!==selection.length)throw new SharePreparationError('Выберите от 1 до 10 разных заявок.',400);
 const plans=await db.supplierPaymentPlan.findMany({where:{id:{in:selection.map(s=>s.id)}}});
 if(plans.length!==selection.length)throw new SharePreparationError('Одна из заявок не найдена. Обновите список.');
 for(const s of selection){const p=plans.find((p:any)=>p.id===s.id);if(p.updatedAt.toISOString()!==s.version)throw new SharePreparationError('Заявка изменилась. Обновите комплект.');if(p.status!=='APPROVED'||!['CNY','USDT'].includes(p.paymentMethod)||readPaymentRevision(p.oneCCashEvidence))throw new SharePreparationError('В комплект входят только согласованные оплаты в USDT и юанях без изменений на согласовании.');}
 const evidence=await readEvidence();
 const docs=await db.supplierPaymentReceipt.findMany({where:{planId:{in:selection.map(s=>s.id)},replacedById:null,purpose:{in:['QR','REQUISITES']}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
 const entries:ShareEntry[]=selection.map(s=>{
  const p=plans.find((p:any)=>p.id===s.id),e=evidence.get(p.id);
  if(evidence.versions.get(p.id)!==s.version||!e||['MISMATCH','NEEDS_REVIEW','SOURCE_UNAVAILABLE'].includes(e.state)||e.paymentAmountNeedsConfirmation||e.rubleAllocationNeedsReview||isFinishedPaymentState(e.state))throw new SharePreparationError('Оплата изменилась или требует сверки. Обновите комплект.');
  const own=docs.filter((d:any)=>d.planId===p.id);
  const images=own.filter((d:any)=>!d.textContent&&['image/png','image/jpeg','image/webp'].includes(d.mimeType));


  const texts=own.filter((d:any)=>d.textContent?.trim());
  if(!images.length&&texts.length!==1)throw new SharePreparationError(`${p.supplierPartner}: добавьте один адрес получателя или QR в формате фото для отправки с суммой.`);
  const chosen=texts.at(-1);
  return {id:p.id,version:s.version,supplier:p.supplierPartner,currency:p.paymentMethod,amount:requisitesShareAmount({paymentMethod:p.paymentMethod,foreignAmount:p.foreignAmount,evidence:{...e,verification:'current'}}),text:images.length?'':chosen.textContent.trim(),network:images.length?'':chosen.network||'',files:images.map((d:any)=>({id:d.id,sha256:d.sha256,mimeType:d.mimeType,size:d.size,originalName:d.originalName,createdAt:d.createdAt?.toISOString()}))};
 });
 if(entries.reduce((sum,e)=>sum+e.files.reduce((n,f)=>n+f.size,0),0)>40*1024*1024)throw new SharePreparationError('Комплект больше 40 МБ. Отправьте его частями.');
 // Include revisions and text as well as exact file hashes; replacing an attachment invalidates a prepared bundle.
 const documentSignature=(rows:any[])=>JSON.stringify(rows.map(d=>[d.planId,d.id,d.revision,d.sha256,d.textContent,d.network]));
 const paymentProof=selection.map(s=>{const e=evidence.get(s.id);return [s.id,e.state,e.issuedAmount,e.paidAmount,e.paidForeignAmount,e.remainingAmount,e.remainingForeignAmount,e.cashOrders,e.currencyPayments];});
 const stamp=createHash('sha256').update(JSON.stringify({entries,docs:documentSignature(docs),paymentProof})).digest('hex');
 const current=await db.supplierPaymentPlan.findMany({where:{id:{in:selection.map(s=>s.id)}}});
 if(current.length!==selection.length||selection.some(s=>current.find((p:any)=>p.id===s.id)?.updatedAt.toISOString()!==s.version))throw new SharePreparationError('Заявка изменилась во время подготовки. Обновите комплект.');
 const currentDocs=await db.supplierPaymentReceipt.findMany({where:{planId:{in:selection.map(s=>s.id)},replacedById:null,purpose:{in:['QR','REQUISITES']}},orderBy:[{createdAt:'asc'},{id:'asc'}]});
 if(documentSignature(currentDocs)!==documentSignature(docs))throw new SharePreparationError('Реквизиты изменились во время проверки. Подготовьте комплект заново.');
 if(expectedStamp&&expectedStamp!==stamp)throw new SharePreparationError('Реквизиты или суммы изменились. Подготовьте комплект заново.');
 return {entries,stamp,checkedAt:new Date().toISOString()};
}
