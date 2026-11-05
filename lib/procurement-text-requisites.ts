import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import type {PrismaClient} from '@prisma/client';
import {paymentRequisites} from './procurement-document-policy';
import {ReceiptError,receiptPlan,receiptSelect,type ReceiptActor} from './procurement-receipts';
import {canAccessProcurementReceipts} from './procurement-receipt-policy';
import {savedPaymentEvidence} from './procurement-evidence-continuity';
export type TextRequisitesCommand={text:string;network?:string;planVersion:string;replaceId?:string;replaceRevision?:number};
export async function saveTextRequisites(db:PrismaClient,actor:ReceiptActor,id:string,command:TextRequisitesCommand){
  if(typeof command.text!=='string'||!command.text.trim()||command.text.length>2000||typeof command.planVersion!=='string'||command.network!=null&&(typeof command.network!=='string'||command.network.length>60))throw new ReceiptError('Проверьте реквизиты.',400);
  if(command.replaceId!=null&&(typeof command.replaceId!=='string'||command.replaceId.length>100||!Number.isInteger(command.replaceRevision)))throw new ReceiptError('Обновите реквизиты перед заменой.',400);
  await receiptPlan(db,actor,id);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "SupplierPaymentPlan" WHERE "id" = ${id} FOR UPDATE`;
    const plan=await tx.supplierPaymentPlan.findUnique({where:{id}}),user=await tx.user.findUnique({where:{id:actor.id}});
    if(!plan||!user||!canAccessProcurementReceipts(user,plan.managerUserId))throw new ReceiptError('Нет доступа к заявке.',403);
    if(!paymentRequisites(plan.paymentMethod))throw new ReceiptError('Для этого способа оплаты реквизиты не нужны.',409);
    if(plan.updatedAt.toISOString()!==command.planVersion)throw new ReceiptError('Заявка изменилась. Обновите её перед сохранением.',409);
    if(['CANCELLED','REJECTED'].includes(plan.status)||['PAID_BY_ONE_C','ISSUED_BY_ONE_C','SMALL_REMAINDER_COMPLETED'].includes(savedPaymentEvidence(plan)?.evidence.state||''))throw new ReceiptError('Заявка уже завершена.',409);
    const text=command.text.trim(),network=plan.paymentMethod==='USDT'?(command.network||'').trim():null;
    if(plan.paymentMethod==='USDT'&&!network)throw new ReceiptError('Укажите сеть кошелька.',400);
    const sha256=createHash('sha256').update(JSON.stringify(['text-requisites-v1',text,network])).digest('hex');
    const existing=await tx.supplierPaymentReceipt.findUnique({where:{planId_sha256:{planId:id,sha256}},select:receiptSelect});
    if(existing){
      if(existing.replacedById)throw new ReceiptError('Эти реквизиты уже были заменены. Проверьте актуальные данные.',409);
      if(command.replaceId&&command.replaceId!==existing.id){const prior=await tx.supplierPaymentReceipt.findUnique({where:{id:command.replaceId}});if(prior?.replacedById!==existing.id)throw new ReceiptError('Такие реквизиты уже есть в заявке.',409);}
      return {receipt:existing,duplicate:true};
    }
    const prior=command.replaceId?await tx.supplierPaymentReceipt.findFirst({where:{id:command.replaceId,planId:id}}):null;
    if(command.replaceId&&(!prior||prior.replacedById||!prior.textContent||prior.revision!==command.replaceRevision))throw new ReceiptError('Реквизиты изменились. Обновите заявку.',409);
    if(await tx.supplierPaymentReceipt.count({where:{planId:id}})>=50)throw new ReceiptError('Достигнут лимит документов заявки.',409);
    const receipt=await tx.supplierPaymentReceipt.create({data:{planId:id,authorUserId:actor.id,purpose:'REQUISITES',textContent:text,network,originalName:'Реквизиты для оплаты',storageKey:`text:${randomUUID()}`,mimeType:'text/plain',size:Buffer.byteLength(text),sha256},select:receiptSelect});
    if(prior)await tx.supplierPaymentReceipt.update({where:{id:prior.id},data:{replacedById:receipt.id,revision:{increment:1}}});
    await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actor.id,action:'PAYMENT_REQUISITES_ADDED',snapshot:{receiptId:receipt.id,purpose:'REQUISITES',replaces:prior?.id||null,format:'text'}}});
    // Requisites never count as receipts and never alter payment status or money.
    return {receipt,duplicate:false};
  });
}
