import type {ShareEntry} from './procurement-share-manifest';
import {requisitesImageWithAmount,requisitesTextImage} from './procurement-share-image';
import {requisitesShareText} from './procurement-requisites-share';
export type PreparedTransfer={id:string;supplier:string;amount:number;currency:string;text:string;file:File};
export async function prepareTransfer(entry:ShareEntry,amount:number,index:number,fetchFile:typeof fetch=fetch):Promise<PreparedTransfer>{
 const text=requisitesShareText({amount,currency:entry.currency,text:entry.text,network:entry.network,hasFile:entry.files.length>0});
 let image:File;
 if(entry.files.length){
  if(entry.files.length!==1)throw Error('Для заявки требуется один актуальный QR.');
  const doc=entry.files[0];
  const response=await fetchFile(`/api/procurement/payment-plans/${encodeURIComponent(entry.id)}/receipts/${encodeURIComponent(doc.id)}`,{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw Error('Не удалось загрузить QR. Подготовьте комплект заново.');
  const bytes=await response.arrayBuffer();
  const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==doc.sha256||bytes.byteLength!==doc.size)throw Error('Файл не совпал с реквизитами заявки. Подготовьте комплект заново.');
  image=await requisitesImageWithAmount(new File([bytes],'qr',{type:doc.mimeType}),text);
 }else image=await requisitesTextImage(text);
 const name=`payment-${String(index+1).padStart(2,'0')}-${entry.currency}-${String(amount).replace('.','-')}.png`;
 return {id:entry.id,supplier:entry.supplier,amount,currency:entry.currency,text,file:new File([image],name,{type:'image/png'})};
}
