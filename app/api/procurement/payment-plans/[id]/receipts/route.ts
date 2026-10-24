import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {receiptPlan,receiptSelect,ReceiptError,saveProcurementReceipt,legacyReceiptWhere} from '@/lib/procurement-receipts';
import {documentPurpose} from '@/lib/procurement-document-policy';
import {verifyDocumentPaymentRefs} from '@/lib/procurement-document-coverage-server';
import {RECEIPT_MAX_BYTES} from '@/lib/procurement-receipt-policy';
export const runtime='nodejs';
type Props={params:Promise<{id:string}>};
const fail=(error:unknown)=>Response.json({error:error instanceof ReceiptError?error.message:'Не удалось обработать чек. Повторите позже.'},{status:error instanceof ReceiptError?error.status:503});
export async function GET(req:Request,props:Props) {
  const user=await getCurrentUser();if(!user)return Response.json({error:'Необходим вход.'},{status:401});
  try {
    const {id}=await props.params;await receiptPlan(prisma,user,id);
    return Response.json({receipts:await prisma.supplierPaymentReceipt.findMany({where:{planId:id,...(new URL(req.url).searchParams.get('documents')==='1'?{}:legacyReceiptWhere)},select:receiptSelect,orderBy:{createdAt:'asc'}})},{headers:{'Cache-Control':'no-store'}});
  } catch(error){return fail(error);}
}
export async function POST(req:Request,props:Props) {
  const user=await getCurrentUser();if(!user)return Response.json({error:'Необходим вход.'},{status:401});
  let sameOrigin=false;
  try {const origin=new URL(req.headers.get('origin')||'');sameOrigin=['http:','https:'].includes(origin.protocol)&&origin.host===(req.headers.get('host')||new URL(req.url).host);}catch{}
  if(!sameOrigin)return Response.json({error:'Недопустимый источник запроса.'},{status:403});
  try {
    const {id}=await props.params;await receiptPlan(prisma,user,id);
    // Bound actual streamed bytes too; Content-Length alone can be absent or untrusted.
    const limit=RECEIPT_MAX_BYTES+128*1024;
    if(Number(req.headers.get('content-length'))>limit)throw new ReceiptError('Файл превышает 10 МБ.',413);
    const reader=req.body?.getReader();if(!reader)throw new ReceiptError('Выберите файл.',400);
    const chunks:Uint8Array[]=[];let size=0;
    try {while(true){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>limit){await reader.cancel();throw new ReceiptError('Файл превышает 10 МБ.',413);}chunks.push(chunk.value);}}finally{reader.releaseLock();}
    let data:FormData;
    try {data=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData();}catch{throw new ReceiptError('Не удалось прочитать файл.',400);}
    const files=data.getAll('file');const file=files[0];
    if(files.length!==1||!(file instanceof File))throw new ReceiptError('Выберите один файл.',400);
    let purpose;
    try{purpose=documentPurpose(data.get('purpose')||'RECEIPT');}catch{throw new ReceiptError('Выберите назначение файла.',400);}
    const coverage=data.has('paymentRefs')?await verifyDocumentPaymentRefs(id,purpose,data.get('paymentRefs')):undefined;
    const replaceId=data.get('replaceId');
    if(replaceId!=null&&(typeof replaceId!=='string'||replaceId.length>100))throw new ReceiptError('Некорректный файл для замены.',400);
    const result=await saveProcurementReceipt(prisma,user,id,file,undefined,{purpose,...coverage,replaceId:replaceId||undefined,replaceRevision:data.has('replaceRevision')?Number(data.get('replaceRevision')):undefined});
    return Response.json(result,{status:result.duplicate?200:201});
  }catch(error){return fail(error);}
}
