import { portalPersonName } from './portal-person';
import type { NotificationDecision } from './notification-detail';
import {loadFiscalReviewData} from './fiscal-review-data';
import {prisma} from '@/lib/prisma';
import {adminNotificationOpening,employeeNotificationOpening} from '@/lib/notification-opening';
import {readPaymentRevision} from '@/lib/procurement-plan-revision';
import {receiptPlanFromFingerprint,canAccessProcurementReceipts} from '@/lib/procurement-receipt-policy';
import {buyerPaymentComment} from '@/lib/procurement-buyer-comment';
import {expenseListItem} from '@/lib/expense-request-list-item';
import {savedPaymentEvidence} from '@/lib/procurement-evidence-continuity';
import {documentState} from '@/lib/procurement-document-policy';
import {QR_CHECK_KIND,qrCheckPlan} from './procurement-qr-check-policy';

export async function readNotificationDetail(user: { id: number; role: string; portalArea: string; isActive: boolean }, audience: string, id: string) {
  const admin=audience==='admin';
  if(!['admin','employee'].includes(audience)||admin&&user.role!=='ADMIN')return Response.json({error:'Нет доступа.'},{status:403});
  const missing=()=>Response.json({error:'Запись больше недоступна. Откройте раздел для проверки.'},{status:404});
  let planId:string|null=null,kind='page';
  let notificationFingerprint = '';
  let decision: NotificationDecision | undefined;
  const headers = {'Cache-Control':'private, no-store'};
  if(admin){
    // The attention list also contains DB-derived plan cards, not inbox receipts.
    // Admin-only: never accept these identifiers through the employee path.
    const attentionPlan=/^plan:([^:]+):.+$/.exec(id);
    if(attentionPlan){planId=attentionPlan[1];kind='payment';}
    else {
    const receipt=await prisma.adminInboxReceipt.findFirst({where:{id,userId:user.id},include:{event:true}});
    if(!receipt)return missing();
    const event=receipt.event;kind=adminNotificationOpening(event);
    if(kind==='fiscal'){
      const detail=await loadFiscalReviewData(event.sourceId,user.id);
      return detail?Response.json({kind,detail},{headers:{'Cache-Control':'private, no-store'}}):missing();
    }
    if(kind==='expense'){
      const caseId=event.href.split('/').at(-1)!;
      const item=await prisma.expenseRequestAdminCase.findFirst({where:{id:caseId,oneCRequestRef:event.sourceId},include:{evaluations:{orderBy:{evaluatedAt:'desc'},take:1}}});
      return item?Response.json({kind,item:expenseListItem(item)},{headers:{'Cache-Control':'private, no-store'}}):missing();
    }
    if(kind==='payment')planId=event.sourceId;
    if(kind==='receipts')planId=(await prisma.supplierPaymentReceipt.findUnique({where:{id:event.sourceId},select:{planId:true}}))?.planId||null;
    }
  }else{
    if(!Number.isSafeInteger(Number(id))||Number(id)<=0)return missing();
    const notification=await prisma.workdayNotification.findFirst({where:{id:Number(id),userId:user.id}});
    if(!notification)return missing();
    kind=employeeNotificationOpening(notification);
    notificationFingerprint=notification.fingerprint;
    if(kind==='notice') {
      const match=/^workday-close-exception:([^:]+):(approved|rejected)$/.exec(notification.fingerprint);
      if(!match)return missing();
      const request=await prisma.workdayCloseExceptionRequest.findFirst({where:{id:match[1],employeeId:user.id},include:{decidedBy:{select:{name:true,payrollName:true}},workDayEntry:{select:{date:true}}}});
      if(!request||!request.decidedAt)return missing();
      if(request.decidedBy)decision={label:match[2]==='approved'?'Согласовано':'Не согласовано',name:portalPersonName(request.decidedBy),at:request.decidedAt.toISOString()};
      return Response.json({kind,body:match[2]==='approved'?`Смена за ${request.workDayEntry.date} завершена. ${request.reasonCode.startsWith('cash_encashment_')?'Инкассация не подтверждена.':'Неисправленные проблемы остаются на контроле.'}`:request.decisionComment,...(decision?{decision}:{})},{headers});
    }
    planId=kind==='receipts'?(notification.kind===QR_CHECK_KIND?qrCheckPlan(notification.fingerprint):receiptPlanFromFingerprint(notification.fingerprint)):/^procurement-payment:([^:]+):/.exec(notification.fingerprint)?.[1]||null;
  }
  if(!planId||!['payment','receipts'].includes(kind))return missing();
  const plan=await prisma.supplierPaymentPlan.findUnique({where:{id:planId}});
  if(!plan||!canAccessProcurementReceipts(user,plan.managerUserId))return missing();
  // Match the exact immutable event referenced by this owned notification; never guess the latest approver.
  const eventId=/^procurement-payment:[^:]+:(?:approved|cancelled|needs_changes):([^:]+)$/.exec(notificationFingerprint)?.[1];
  if(eventId && eventId!=='decision') {
    const event=await prisma.supplierPaymentPlanEvent.findFirst({where:{id:eventId,planId:plan.id},select:{action:true,createdAt:true,actor:{select:{name:true,payrollName:true}}}});
    if(event && ['APPROVED','NEEDS_CHANGES','CANCELLED','REVISION_APPROVED','REVISION_REJECTED','RESCHEDULED'].includes(event.action))decision={label:event.action==='APPROVED'||event.action==='REVISION_APPROVED'?'Согласовано':event.action==='NEEDS_CHANGES'?'Возвращено на исправление':event.action==='CANCELLED'?'Отменено':event.action==='RESCHEDULED'?'Дата изменена':'Изменения не согласованы',name:portalPersonName(event.actor),at:event.createdAt.toISOString()};
  }
  // DB-only opening; financial mutations retain their existing fresh 1C guards.
  const saved=kind==='receipts'?savedPaymentEvidence(plan):null;
  const receiptEvidence=kind==='receipts'?{evidence:saved?{
    state:saved.evidence.state,verification:'last-confirmed',
    issuedAmount:saved.evidence.issuedAmount,paidAmount:saved.evidence.paidAmount,
    paidForeignAmount:saved.evidence.paidForeignAmount,
    cashOrders:saved.evidence.cashOrders,currencyPayments:saved.evidence.currencyPayments,
    qrFunding:saved.evidence.qrFunding,
  }:{state:'SOURCE_UNAVAILABLE',verification:'unavailable'}}:{};
  plan.orderNumbers=Array.isArray(plan.orderNumbers)?plan.orderNumbers.filter(value=>typeof value==='string'):[];
  return Response.json({kind,admin,...(decision?{decision}:{}),plan:{...receiptEvidence,id:plan.id,planCode:plan.planCode,supplierPartner:plan.supplierPartner,supplierCounterparty:plan.supplierCounterparty,currency:plan.currency,orderRefs:plan.orderRefs,documentState:documentState(plan.oneCCashEvidence),plannedDate:plan.plannedDate.toISOString(),updatedAt:plan.updatedAt.toISOString(),plannedAmount:String(plan.plannedAmount),foreignAmount:plan.foreignAmount===null?null:String(plan.foreignAmount),exchangeRate:plan.exchangeRate===null?null:String(plan.exchangeRate),paymentMethod:plan.paymentMethod,condition:buyerPaymentComment(plan.condition),orderNumbers:plan.orderNumbers,status:plan.status,paymentPurpose:plan.paymentPurpose,revision:readPaymentRevision(plan.oneCCashEvidence)}},{headers:{'Cache-Control':'private, no-store'}});
}
