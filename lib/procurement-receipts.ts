import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {Prisma, type PrismaClient, type User} from '@prisma/client';
import {documentPurpose, documentPaymentRefs,documentPaymentSnapshots, qrConfirmationContext, receiptPlanContext, type DocumentPurpose} from './procurement-document-policy';
import {receiptPaymentDate,canCollectQrReceiptBeforePayment,hasConfirmedReceiptPayment} from './procurement-receipt-policy';
import {savedPaymentEvidence} from './procurement-evidence-continuity';
import {canAccessProcurementReceipts,receiptFilename,receiptFormat,receiptHref,RECEIPT_ADMIN_EVENT,RECEIPT_EMPLOYEE_KIND} from './procurement-receipt-policy';

export class ReceiptError extends Error {
  constructor(message:string,public status:number) {super(message);}
}
export type ReceiptActor=Pick<User,'id'|'role'|'portalArea'|'isActive'>;
export const receiptSelect={id:true,planId:true,originalName:true,mimeType:true,size:true,createdAt:true,author:{select:{name:true}},purpose:true,revision:true,replacedById:true,qrConfirmedAt:true,qrConfirmationContext:true,qrConfirmedBy:{select:{name:true}},paymentRefs:true,paymentSnapshots:true,receiptPlanContext:true} as const;
export const legacyReceiptWhere={purpose:'RECEIPT',replacedById:null} as const;
export type ReceiptSaveOptions={purpose?:DocumentPurpose;replaceId?:string;replaceRevision?:number;paymentRefs?:string[];planVersion?:string};
/** Recheck under the plan lock as well as at the HTTP boundary. A refresh or
 * direct internal caller must not attach proof to an unrelated source record. */
function validateReceiptAssociation(plan:Parameters<typeof savedPaymentEvidence>[0] & {paymentMethod:string;status:string;plannedDate:Date;createdAt:Date},purpose:DocumentPurpose,refs:string[]) {
  if(purpose!=='RECEIPT'||!Array.isArray(refs)||!refs.length||refs.length>100||new Set(refs).size!==refs.length||refs.some(ref=>typeof ref!=='string'||ref.length>150))throw new ReceiptError('Выберите оплату для чека.',400);
  const view={...plan,plannedDate:plan.plannedDate.toISOString(),createdAt:plan.createdAt.toISOString(),evidence:savedPaymentEvidence(plan)?.evidence};
  if(refs.length===1&&refs[0]==='pending-qr'){
    if(!canCollectQrReceiptBeforePayment(view))throw new ReceiptError('Для этой заявки выберите проведённую оплату.',409);
    return;
  }
  const allowed=new Set(documentPaymentRefs(view));
  if(!hasConfirmedReceiptPayment(view)||refs.some(ref=>!allowed.has(ref)))throw new ReceiptError('Выбранный расходник изменился. Обновите заявку.',409);
}
export async function receiptPlan(db:PrismaClient,user:ReceiptActor,id:string) {
  const plan=await db.supplierPaymentPlan.findUnique({where:{id}});
  if (!plan || !canAccessProcurementReceipts(user,plan.managerUserId)) throw new ReceiptError('Заявка не найдена.',404);
  return plan;
}
export function receiptStorageRoot() { return path.resolve(process.cwd(),'uploads','procurement-receipts'); }
export async function saveProcurementReceipt(db:PrismaClient,user:ReceiptActor,planId:string,file:File,root=receiptStorageRoot(),options:ReceiptSaveOptions={}) {
  const purpose=documentPurpose(options.purpose||'RECEIPT');
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
      if(options.planVersion && plan.updatedAt.toISOString()!==options.planVersion)throw new ReceiptError('Заявка изменилась. Обновите её перед добавлением файла.',409);
      if(options.paymentRefs)validateReceiptAssociation(plan,purpose,options.paymentRefs);
      const paymentSnapshots=options.paymentRefs?documentPaymentSnapshots({evidence:savedPaymentEvidence(plan)?.evidence},options.paymentRefs):null;
      const existing=await tx.supplierPaymentReceipt.findUnique({where:{planId_sha256:{planId,sha256}},select:receiptSelect});
      if (existing) {
        if(existing.purpose!==purpose||existing.replacedById)throw new ReceiptError('Этот файл уже сохранён с другим назначением или заменён. Откройте существующий документ.',409);
        if(options.paymentRefs&&JSON.stringify([...options.paymentRefs].sort())!==JSON.stringify(Array.isArray(existing.paymentRefs)?[...existing.paymentRefs].sort():null))throw new ReceiptError('Этот чек уже добавлен. Укажите нужный расходник у сохранённого чека.',409);
        if(paymentSnapshots&&existing.paymentSnapshots&&Object.entries(paymentSnapshots).some(([ref,value])=>(existing.paymentSnapshots as Record<string,unknown>)[ref]!==value))throw new ReceiptError('Расходник изменился. Проверьте сохранённый чек и заново укажите расходник.',409);
        if(options.replaceId){
          const prior=await tx.supplierPaymentReceipt.findFirst({where:{id:options.replaceId,planId}});
          if(prior?.replacedById!==existing.id)throw new ReceiptError('Выбранный файл уже есть в заявке. Для замены выберите новый файл.',409);
        }
        return {receipt:existing,duplicate:true};
      }
      const replaced=options.replaceId?await tx.supplierPaymentReceipt.findFirst({where:{id:options.replaceId,planId}}):null;
      if(options.replaceId&&(!replaced||replaced.replacedById||replaced.purpose==='RECEIPT'||purpose==='RECEIPT'||replaced.revision!==options.replaceRevision))throw new ReceiptError('Реквизиты изменились. Обновите список файлов.',409);
      const capacity=await tx.supplierPaymentReceipt.aggregate({where:{planId},_count:true,_sum:{size:true}});
      if(capacity._count>=50 || Number(capacity._sum.size||0)+bytes.length>100*1024*1024)throw new ReceiptError('Для одной заявки доступно до 50 файлов общим размером до 100 МБ.',409);
      const receipt=await tx.supplierPaymentReceipt.create({data:{planId,authorUserId:user.id,originalName:receiptFilename(file.name),storageKey,mimeType:file.type,size:bytes.length,sha256,purpose,...(options.paymentRefs?{paymentRefs:options.paymentRefs,paymentSnapshots:paymentSnapshots??Prisma.DbNull}:{}),receiptPlanContext:options.paymentRefs?.includes('pending-qr')?receiptPlanContext({...plan,plannedDate:plan.plannedDate.toISOString(),createdAt:plan.createdAt.toISOString()}):null},select:receiptSelect});
      if(replaced)await tx.supplierPaymentReceipt.update({where:{id:replaced.id},data:{replacedById:receipt.id,revision:{increment:1}}});
      await tx.supplierPaymentPlanEvent.create({data:{planId,actorUserId:user.id,action:purpose==='RECEIPT'?'RECEIPT_ADDED':'PAYMENT_REQUISITES_ADDED',snapshot:{receiptId:receipt.id,name:receipt.originalName,purpose,replaces:replaced?.id||null}}});
      // Requisites are not proof of payment. Never emit a receipt notification for them.
      if(purpose!=='RECEIPT')return {receipt,duplicate:false};
      const now=new Date();
      const title='Добавлен чек оплаты';
      const body=`${plan.supplierPartner} · ${receipt.originalName}`;
      if (currentUser.role==='ADMIN') {
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
export type DocumentChange = {revision:number;action:'CONFIRM_QR'|'CLASSIFY'|'LINK_PAYMENT';purpose?:DocumentPurpose;planVersion?:string;paymentRefs?:string[]};
export async function changeProcurementDocument(db:PrismaClient,user:ReceiptActor,planId:string,id:string,command:DocumentChange,now=new Date()) {
  await receiptPlan(db,user,planId);
  if(!Number.isInteger(command.revision)||command.revision<0)throw new ReceiptError('Обновите список файлов.',400);
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT "id" FROM "SupplierPaymentPlan" WHERE "id" = ${planId} FOR UPDATE`;
    const plan=await tx.supplierPaymentPlan.findUnique({where:{id:planId}});
    const actor=await tx.user.findUnique({where:{id:user.id}});
    if(!plan||!actor||!canAccessProcurementReceipts(actor,plan.managerUserId))throw new ReceiptError('Нет доступа к заявке.',403);
    const before=await tx.supplierPaymentReceipt.findFirst({where:{id,planId}});
    if(!before)throw new ReceiptError('Файл не найден.',404);
    if(before.replacedById||before.revision!==command.revision)throw new ReceiptError('Файл изменился. Обновите список.',409);
    let data:Prisma.SupplierPaymentReceiptUpdateInput;
    if(command.action==='CONFIRM_QR'){
      const meta=plan.oneCCashEvidence as Record<string,unknown>|null;
      if(before.purpose!=='QR'||plan.status!=='APPROVED'||meta?.pendingRevision||meta?.fundingDeferral)throw new ReceiptError('Сначала проверьте состояние заявки и дату оплаты.',409);
      if(command.planVersion!==plan.updatedAt.toISOString())throw new ReceiptError('Заявка изменилась. Обновите её перед подтверждением QR.',409);
      data={qrConfirmedAt:now,qrConfirmedBy:{connect:{id:actor.id}},qrConfirmationContext:qrConfirmationContext(plan,receiptPaymentDate(now.toISOString()))};
    }else if(command.action==='CLASSIFY'){
      if(actor.role!=='ADMIN')throw new ReceiptError('Изменить назначение сохранённого файла может руководитель.',403);
      let purpose:DocumentPurpose;
      try{purpose=documentPurpose(command.purpose);}catch{throw new ReceiptError('Выберите назначение файла.',400);}
      // Reclassifying to a receipt is not permission to associate it with every payment.
      if(purpose==='RECEIPT'){
        if(command.planVersion!==plan.updatedAt.toISOString())throw new ReceiptError('Заявка изменилась. Обновите её перед изменением файла.',409);
        validateReceiptAssociation(plan,purpose,command.paymentRefs||[]);
      }
      data={purpose,paymentRefs:purpose==='RECEIPT'?command.paymentRefs!:Prisma.DbNull,paymentSnapshots:purpose==='RECEIPT'?documentPaymentSnapshots({evidence:savedPaymentEvidence(plan)?.evidence},command.paymentRefs!):Prisma.DbNull,receiptPlanContext:purpose==='RECEIPT'&&command.paymentRefs?.includes('pending-qr')?receiptPlanContext({...plan,plannedDate:plan.plannedDate.toISOString(),createdAt:plan.createdAt.toISOString()}):null,qrConfirmedAt:null,qrConfirmedBy:{disconnect:true},qrConfirmationContext:null};
      if(purpose!=='RECEIPT'){
        // Preserve the audit event, but do not deliver obsolete receipt claims.
        await tx.workdayNotification.updateMany({where:{fingerprint:`procurement-receipt:${planId}:${id}`,status:{in:['pending','sent']}},data:{status:'cancelled',pushStatus:'cancelled',nextPushAttemptAt:null}});
        await tx.adminInboxDelivery.updateMany({where:{event:{eventKey:`procurement-receipt:${id}`},status:{in:['pending','failed']}},data:{status:'cancelled',lastErrorCode:'DOCUMENT_PURPOSE_CHANGED'}});
      }
    }else if(command.action==='LINK_PAYMENT'){
      if(before.purpose!=='RECEIPT'||!command.paymentRefs?.length||command.planVersion!==plan.updatedAt.toISOString())throw new ReceiptError('Оплата или файл изменились. Обновите заявку.',409);
      validateReceiptAssociation(plan,'RECEIPT',command.paymentRefs);
      data={paymentRefs:command.paymentRefs,paymentSnapshots:documentPaymentSnapshots({evidence:savedPaymentEvidence(plan)?.evidence},command.paymentRefs),receiptPlanContext:command.paymentRefs.includes('pending-qr')?receiptPlanContext({...plan,plannedDate:plan.plannedDate.toISOString(),createdAt:plan.createdAt.toISOString()}):null};
    }else throw new ReceiptError('Неизвестное действие.',400);
    const receipt=await tx.supplierPaymentReceipt.update({where:{id},data:{...data,revision:{increment:1}},select:receiptSelect});
    await tx.supplierPaymentPlanEvent.create({data:{planId,actorUserId:actor.id,action:command.action==='CONFIRM_QR'?'PAYMENT_QR_CONFIRMED':command.action==='LINK_PAYMENT'?'RECEIPT_PAYMENT_LINKED':'PAYMENT_DOCUMENT_CLASSIFIED',snapshot:{receiptId:id,from:before.purpose,to:receipt.purpose,revision:receipt.revision,paymentRefs:command.paymentRefs||null,confirmedAt:receipt.qrConfirmedAt?.toISOString()||null}}});
    return {receipt};
  });
}
export async function readProcurementReceipt(db:PrismaClient,user:ReceiptActor,planId:string,id:string,root=receiptStorageRoot()) {
  await receiptPlan(db,user,planId);
  const receipt=await db.supplierPaymentReceipt.findFirst({where:{id,planId}});
  if(!receipt || !/^[a-f0-9-]+\.(jpg|png|webp|pdf)$/.test(receipt.storageKey)) throw new ReceiptError('Чек не найден.',404);
  const bytes=await readFile(path.join(root,receipt.storageKey)).catch(()=>null);
  if(!bytes) throw new ReceiptError('Файл временно недоступен. Обратитесь к администратору.',503);
  return {receipt,bytes};
}
