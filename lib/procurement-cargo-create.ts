import 'server-only';
import {readFundingBalance,assertFundingBalance} from './procurement-usdt-funding-server';
import {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {cargoRequestError,PROCUREMENT_CARGO} from './procurement-cargo';
import {validatePaymentPlan,buildPaymentPlanCode} from './procurement-payment-control';
import {freshEvidence} from './procurement-plan-revision-server';
import {planningRequestOverlap} from './procurement-planning-overlap';
import {notifyAdminsAboutProcurementPlans} from './procurement-payment-notifications';

/** Same plan, audit and notification flow as goods; no synthetic supplier order. */
export async function createCargoPayment(payload:Record<string,unknown>,user:{id:number;name:string;oneCManagerName:string|null},readEvidence:typeof freshEvidence=freshEvidence) {
  const error=cargoRequestError(payload,user.oneCManagerName?.trim()||user.name);
  if(error)return Response.json({error},{status:400});
  const checked=validatePaymentPlan({...payload,paymentPurpose:'DELIVERY',supplierPartner:PROCUREMENT_CARGO.supplierPartner,
    supplierCounterparty:PROCUREMENT_CARGO.supplierCounterparty,condition:typeof payload.condition==='string'&&payload.condition.trim()?payload.condition:'Доставка',
    commissionAmount:null,exchangerName:'',supplierConfirmation:''},true);
  if(!checked.ok||!checked.data.plannedAmount)return Response.json({error:checked.errors.join(' ')||'Укажите сумму и курс.'},{status:400});
  try {
    const evidence=await readEvidence();
    const fundingBalance=await readFundingBalance([checked.data]);
    const result=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
      await assertFundingBalance(tx,[checked.data],fundingBalance,evidence);
      const existing=await tx.supplierPaymentPlan.findMany({where:{status:{in:['SUBMITTED','APPROVED','NEEDS_CHANGES']}}});
      if(planningRequestOverlap([checked.data],existing,evidence))return null;
      const plan=await tx.supplierPaymentPlan.create({data:{...checked.data,managerUserId:user.id,planCode:buildPaymentPlanCode(),
        plannedDate:new Date(checked.data.plannedDate+'T00:00:00Z'),plannedAmount:new Prisma.Decimal(checked.data.plannedAmount!)}});
      const event=await tx.supplierPaymentPlanEvent.create({data:{planId:plan.id,actorUserId:user.id,action:'SUBMITTED',snapshot:JSON.parse(JSON.stringify(plan))}});
      await notifyAdminsAboutProcurementPlans({db:tx,eventKey:`procurement-payment:${event.id}:submitted`,action:'SUBMITTED',managerName:user.name,plans:[plan]});
      return plan;
    });
    return result?Response.json(JSON.parse(JSON.stringify(result)),{status:201}):Response.json({error:'Оплата перевозчику уже есть в календаре. Измените существующую заявку.'},{status:409});
  }catch(error){return Response.json({error:error instanceof Error&&/^[А-ЯЁ]/.test(error.message)?error.message:'Не удалось проверить действующие оплаты или подтвердить сохранение. Проверьте календарь перед повторной отправкой.'},{status:503});}
}
