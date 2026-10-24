import 'server-only';
import {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {procurementNotificationEvidence} from './procurement-notification-evidence';
import {receiptPaymentDate} from './procurement-receipt-policy';
import {savedPaymentEvidence} from './procurement-evidence-continuity';
import {ReceiptError,type ReceiptActor} from './procurement-receipts';
import {employeePushNotBefore} from './employee-push-policy';
import {QR_CHECK_KIND,needsQrCheck,qrCheckPlan,qrCheckRequestDay,qrPaymentState} from './procurement-qr-check-policy';
import {qrCheckKey} from './procurement-qr-check-key';

const include={receipts:{where:{purpose:'QR',replacedById:null}},manager:{select:{isActive:true}}};
const copy=(supplier:string,hasQr:boolean)=>hasQr
  ?{title:'Проверьте актуальность QR-кода',body:`${supplier} · руководитель просит уточнить QR у поставщика. Подтвердите актуальность или добавьте новый код.`}
  :{title:'Добавьте QR-код для оплаты',body:`${supplier} · руководитель запросил QR-код. Добавьте его в реквизиты заявки.`};

/** The sole producer is an authenticated admin action. No periodic reminders. */
export type QrRequestCommand={planVersion:string;qrFiles:{id:string;revision:number}[]};
export async function requestQrCheck(actor:ReceiptActor,id:string,command:QrRequestCommand,now=new Date()){
  if(!actor.isActive||actor.role!=='ADMIN')throw new ReceiptError('Запросить QR-код может руководитель.',403);
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "SupplierPaymentPlan" WHERE id=${id} FOR UPDATE`);
    const user=await tx.user.findUnique({where:{id:actor.id},select:{role:true,isActive:true}});
    if(!user?.isActive||user.role!=='ADMIN')throw new ReceiptError('Доступ запрещён.',403);
    const plan=await tx.supplierPaymentPlan.findUnique({where:{id},include});
    const today=receiptPaymentDate(now.toISOString());
    if(!plan||!plan.manager.isActive)throw new ReceiptError('Заявка не найдена.',404);
    const signature=(files:{id:string;revision:number}[])=>JSON.stringify(files.map(f=>[f.id,f.revision]).sort());
    if(plan.updatedAt.toISOString()!==command.planVersion||signature(plan.receipts)!==signature(command.qrFiles))throw new ReceiptError('Заявка или QR-код изменились. Обновите документы перед запросом.',409);
    if(!needsQrCheck(plan,plan.receipts,today)||qrPaymentState(savedPaymentEvidence(plan)?.evidence.state)==='closed')throw new ReceiptError('Запрос уже не требуется. Обновите заявку.',409);
    const fingerprint=qrCheckKey(plan,plan.receipts,today);
    const existing=await tx.workdayNotification.findUnique({where:{fingerprint},select:{id:true}});
    if(existing)return {alreadyRequested:true};
    const scheduledAt=employeePushNotBefore(now);
    await tx.workdayNotification.create({data:{userId:plan.managerUserId,fingerprint,kind:QR_CHECK_KIND,...copy(plan.supplierPartner,plan.receipts.length>0),scheduledAt,nextPushAttemptAt:scheduledAt}});
    return {alreadyRequested:false};
  });
}

export async function qrCheckPushDecision(notification:{fingerprint:string;userId:number},now=new Date()){
  const id=qrCheckPlan(notification.fingerprint),day=qrCheckRequestDay(notification.fingerprint);
  if(!id||!day)return {state:'cancel' as const};
  const read=()=>prisma.supplierPaymentPlan.findUnique({where:{id},include});
  const matches=(plan:Awaited<ReturnType<typeof read>>)=>plan&&plan.manager.isActive&&plan.managerUserId===notification.userId&&needsQrCheck(plan,plan.receipts,day)&&qrCheckKey(plan,plan.receipts,day)===notification.fingerprint;
  if(!matches(await read()))return {state:'cancel' as const};
  const evidence=await procurementNotificationEvidence();
  const plan=await read();
  if(!matches(plan)||!plan)return {state:'cancel' as const};
  if(!evidence||evidence.versions.get(id)!==plan.updatedAt.toISOString()||qrPaymentState(evidence.get(id)?.state)==='unknown')return {state:'defer' as const,until:new Date(now.getTime()+60000)};
  if(qrPaymentState(evidence.get(id)?.state)==='closed')return {state:'cancel' as const};
  const until=employeePushNotBefore(now);
  return until>now?{state:'defer' as const,until}:{state:'send' as const,...copy(plan.supplierPartner,plan.receipts.length>0)};
}
