import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {readProcurementReceipt,ReceiptError} from '@/lib/procurement-receipts';
export const runtime='nodejs';
export async function GET(_req:Request,props:{params:Promise<{id:string;receiptId:string}>}) {
  const user=await getCurrentUser();if(!user)return Response.json({error:'Необходим вход.'},{status:401});
  try {
    const {id,receiptId}=await props.params;
    const {receipt,bytes}=await readProcurementReceipt(prisma,user,id,receiptId);
    // PDF is downloaded, not embedded: receipt contents are untrusted.
    return new Response(bytes,{headers:{'Content-Type':receipt.mimeType,'Content-Length':String(bytes.length),'Content-Disposition':`attachment; filename="receipt.${receipt.storageKey.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(receipt.originalName).replace(/'/g,'%27')}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
  }catch(error){return Response.json({error:error instanceof ReceiptError?error.message:'Не удалось открыть чек.'},{status:error instanceof ReceiptError?error.status:503});}
}
