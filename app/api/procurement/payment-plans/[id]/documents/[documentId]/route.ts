import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {changeProcurementDocument,receiptPlan,ReceiptError,type DocumentChange} from '@/lib/procurement-receipts';
import {verifyDocumentPaymentRefs} from '@/lib/procurement-document-coverage-server';
export async function PATCH(req:Request,props:{params:Promise<{id:string;documentId:string}>}) {
  const user=await getCurrentUser();
  if(!user)return Response.json({error:'Необходим вход.'},{status:401});
  try{
    const origin=new URL(req.headers.get('origin')||'');
    if(!['http:','https:'].includes(origin.protocol)||origin.host!==(req.headers.get('host')||new URL(req.url).host))throw Error();
  }catch{return Response.json({error:'Недопустимый источник запроса.'},{status:403});}
  try{
    const reader=req.body?.getReader();if(!reader)throw new ReceiptError('Нет данных изменения.',400);
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16384){await reader.cancel();throw new ReceiptError('Слишком большой запрос.',413);}chunks.push(chunk.value);}}finally{reader.releaseLock();}
    const text=Buffer.concat(chunks).toString('utf8');
    let body:DocumentChange;
    try{body=JSON.parse(text);}catch{throw new ReceiptError('Проверьте данные изменения.',400);}
    if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(key=>!['action','revision','purpose','planVersion','paymentRefs'].includes(key)))throw new ReceiptError('Проверьте данные изменения.',400);
    const {id,documentId}=await props.params;
    await receiptPlan(prisma,user,id);
    if(body.action==='LINK_PAYMENT'||body.action==='CLASSIFY'&&body.purpose==='RECEIPT')body={...body,...await verifyDocumentPaymentRefs(id,'RECEIPT',body.paymentRefs)};
    return Response.json(await changeProcurementDocument(prisma,user,id,documentId,body),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof ReceiptError?error.message:'Не удалось сохранить изменение. Обновите список файлов.'},{status:error instanceof ReceiptError?error.status:503});}
}
