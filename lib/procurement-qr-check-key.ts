import {createHash} from 'node:crypto';
import {receiptPlanContext,type PaymentDocument,type qrIsConfirmed} from './procurement-document-policy';
export function qrCheckKey(plan:Parameters<typeof qrIsConfirmed>[1]&{managerUserId?:number},files:PaymentDocument[],day:string){
  const date=plan.plannedDate instanceof Date?plan.plannedDate.toISOString():plan.plannedDate;
  const context=JSON.stringify([receiptPlanContext({...plan,plannedDate:date}),date,plan.managerUserId??null,files.filter(f=>f.purpose==='QR'&&!f.replacedById).map(f=>[f.id,f.revision??0]).sort()]);
  return `procurement-qr-check:${plan.id}:manual:${day}:${createHash('sha256').update(context).digest('hex')}`;
}
