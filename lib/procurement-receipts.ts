import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import type {PrismaClient, User} from '@prisma/client';
import {canAccessProcurementReceipts,receiptFilename,receiptFormat,receiptHref,RECEIPT_ADMIN_EVENT,RECEIPT_EMPLOYEE_KIND} from './procurement-receipt-policy';

export class ReceiptError extends Error {
  constructor(message:string,public status:number) {super(message);}
}
export type ReceiptActor=Pick<User,'id'|'role'|'portalArea'|'isActive'>;
export const receiptSelect={id:true,planId:true,originalName:true,mimeType:true,size:true,createdAt:true,author:{select:{name:true}}} as const;
export async function receiptPlan(db:PrismaClient,user:ReceiptActor,id:string) {
  const plan=await db.supplierPaymentPlan.findUnique({where:{id}});
  if (!plan || !canAccessProcurementReceipts(user,plan.managerUserId)) throw new ReceiptError('Заявка не найдена.',404);
  return plan;
}
export function receiptStorageRoot() { return path.resolve(process.cwd(),'uploads','procurement-receipts'); }
export async function saveProcurementReceipt(db:PrismaClient,user:ReceiptActor,planId:string,file:File,root=receiptStorageRoot()) {
  await receiptPlan(db,user,planId);
  const bytes=Buffer.from(await file.arrayBuffer());
  let extension:string;
  try {extension=receiptFormat(bytes,file.type);} catch(error) {throw new ReceiptError((error as Error).message,400);}
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const storageKey=`${randomUUID()}.${extension}`;
  await mkdir(root,{recursive:true,mode:0o700});
  const absolute=path.join(root,storageKey);
  await writeFile(absolute,bytes,{flag:'wx',mode:0o600});
  try {
    const result=await db.$transaction(async tx=>{
      // Serialize retries on this plan; the unique index remains the final guard.
      await tx.$queryRaw`SELECT "id" FROM "SupplierPaymentPlan" WHERE "id" = ${planId} FOR UPDATE`;
      const plan=await tx.supplierPaymentPlan.findUnique({where:{id:planId}});
      const currentUser=await tx.user.findUnique({where:{id:user.id}});
      if (!plan || !currentUser || !canAccessProcurementReceipts(currentUser,plan.managerUserId)) throw new ReceiptError('Нет доступа к заявке.',403);
      const existing=await tx.supplierPaymentReceipt.findUnique({where:{planId_sha256:{planId,sha256}},select:receiptSelect});
      if (existing) return {receipt:existing,duplicate:true};
      const capacity=await tx.supplierPaymentReceipt.aggregate({where:{planId},_count:true,_sum:{size:true}});
      if(capacity._count>=50 || Number(capacity._sum.size||0)+bytes.length>100*1024*1024)throw new ReceiptError('Для одной заявки доступно до 50 файлов общим размером до 100 МБ.',409);
      const receipt=await tx.supplierPaymentReceipt.create({data:{planId,authorUserId:user.id,originalName:receiptFilename(file.name),storageKey,mimeType:file.type,size:bytes.length,sha256},select:receiptSelect});
      await tx.supplierPaymentPlanEvent.create({data:{planId,actorUserId:user.id,action:'RECEIPT_ADDED',snapshot:{receiptId:receipt.id,name:receipt.originalName}}});
      const now=new Date();
      const title='Добавлен чек оплаты';
      const body=`${plan.supplierPartner} · ${receipt.originalName}`;
      if (user.role==='ADMIN') {
        const owner=await tx.user.findUnique({where:{id:plan.managerUserId}});
        if(owner?.isActive) await tx.workdayNotification.create({data:{userId:owner.id,fingerprint:`procurement-receipt:${planId}:${receipt.id}`,kind:RECEIPT_EMPLOYEE_KIND,title,body,scheduledAt:now,nextPushAttemptAt:now}});
      } else {
        const event=await tx.adminInboxEvent.create({data:{eventKey:`procurement-receipt:${receipt.id}`,type:RECEIPT_ADMIN_EVENT,title,body,href:receiptHref(planId,true),sourceType:'supplier_payment_receipt',sourceId:receipt.id,occurredAt:now}});
        const admins=await tx.user.findMany({where:{role:'ADMIN',isActive:true,id:{not:user.id}},select:{id:true}});
        await tx.adminInboxReceipt.createMany({data:admins.map(admin=>({eventId:event.id,userId:admin.id})),skipDuplicates:true});
      }
      return {receipt,duplicate:false};
    });
    if(result.duplicate) await unlink(absolute).catch(()=>{});
    return result;
  } catch(error) {
    // An ambiguous commit must never delete a file that a committed row references.
    const saved=await db.supplierPaymentReceipt.findUnique({where:{storageKey},select:{id:true}}).catch(()=>undefined);
    if(saved===null) await unlink(absolute).catch(()=>{});
    throw error;
  }
}
export async function readProcurementReceipt(db:PrismaClient,user:ReceiptActor,planId:string,id:string,root=receiptStorageRoot()) {
  await receiptPlan(db,user,planId);
  const receipt=await db.supplierPaymentReceipt.findFirst({where:{id,planId}});
  if(!receipt || !/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(receipt.storageKey)) throw new ReceiptError('Чек не найден.',404);
  const bytes=await readFile(path.join(root,receipt.storageKey)).catch(()=>null);
  if(!bytes) throw new ReceiptError('Файл временно недоступен. Обратитесь к администратору.',503);
  return {receipt,bytes};
}
