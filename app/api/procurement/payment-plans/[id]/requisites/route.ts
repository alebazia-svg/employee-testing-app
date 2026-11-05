import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ReceiptError} from '@/lib/procurement-receipts';
import {saveTextRequisites} from '@/lib/procurement-text-requisites';
export async function POST(req:Request,props:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();if(!user)return Response.json({error:'Необходим вход.'},{status:401});
  try{const origin=new URL(req.headers.get('origin')||'');if(!['http:','https:'].includes(origin.protocol)||origin.host!==(req.headers.get('host')||new URL(req.url).host))throw Error();}catch{return Response.json({error:'Недопустимый источник запроса.'},{status:403});}
  try{
    const reader=req.body?.getReader();if(!reader)throw new ReceiptError('Введите реквизиты.',400);
    const chunks:Uint8Array[]=[];let size=0;
    try{while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16384){await reader.cancel();throw new ReceiptError('Слишком длинные реквизиты.',413);}chunks.push(chunk.value);}}finally{reader.releaseLock();}
    let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ReceiptError('Проверьте реквизиты.',400);}
    if(!body||typeof body!=='object')throw new ReceiptError('Проверьте реквизиты.',400);
    return Response.json(await saveTextRequisites(prisma,user,(await props.params).id,body),{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error instanceof ReceiptError?error.message:'Реквизиты не сохранены. Попробуйте ещё раз.'},{status:error instanceof ReceiptError?error.status:503});}
}
