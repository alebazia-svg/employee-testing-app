import {getCurrentUser} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {receiptSelect,legacyReceiptWhere} from '@/lib/procurement-receipts';
export async function GET(req:Request) {
  const user=await getCurrentUser();
  if(!user)return Response.json({error:'Необходим вход.'},{status:401});
  if(user.role!=='ADMIN' && !(user.role==='EMPLOYEE' && user.portalArea==='PROCUREMENT'))return Response.json({error:'Нет доступа.'},{status:403});
  const ids=new URL(req.url).searchParams.getAll('plan');
  if(!ids.length||ids.length>100||ids.some(id=>id.length>100))return Response.json({error:'Неверный список заявок.'},{status:400});
  try {
    const documents=new URL(req.url).searchParams.get('documents')==='1';
    const receipts=await prisma.supplierPaymentReceipt.findMany({where:{planId:{in:ids},...(!documents?legacyReceiptWhere:{}),...(user.role==='ADMIN'?{}:{plan:{managerUserId:user.id}})},select:receiptSelect,orderBy:{createdAt:'asc'}});
    return Response.json({receipts},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Не удалось загрузить чеки. Повторите позже.'},{status:503});}
}
