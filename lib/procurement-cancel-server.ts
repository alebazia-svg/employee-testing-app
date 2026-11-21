import { prisma } from './prisma';
import { freshEvidence } from './procurement-plan-revision-server';
import { readPaymentRevision } from './procurement-plan-revision';
import { assertUnpaidAction } from './procurement-unpaid-action';
import { notifyAdminsAboutProcurementPlans, notifyProcurementManagerAboutDecision } from './procurement-payment-notifications';

type Actor = {id: number; name: string; role: string; portalArea?: string | null};

export async function cancelPayment(id: string, actor: Actor, version: unknown) {
  const admin=actor.role==='ADMIN';
  if(!admin && !(actor.role==='EMPLOYEE' && actor.portalArea==='PROCUREMENT')) throw Error('Нет доступа.');
  const where={id,...(admin?{}:{managerUserId:actor.id})};
  const candidate=await prisma.supplierPaymentPlan.findFirst({where});
  if(!candidate || !['SUBMITTED','APPROVED','NEEDS_CHANGES'].includes(candidate.status) ||
      candidate.updatedAt.toISOString()!==version) throw Error('Обновите заявку перед отменой.');
  if(readPaymentRevision(candidate.oneCCashEvidence))throw Error('Сначала рассмотрите предложенные изменения.');
  const evidence=await freshEvidence({guardPlanId:id});
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106241)`;
    const before=await tx.supplierPaymentPlan.findFirstOrThrow({where});
    if(before.updatedAt.toISOString()!==version || before.status!==candidate.status || evidence.versions.get(id)!==version) throw Error('Заявка изменилась. Обновите её перед отменой.');
    await assertUnpaidAction(tx,before,evidence.get(id));
    const updated=await tx.supplierPaymentPlan.update({where:{...where,updatedAt:before.updatedAt,status:before.status},data:{status:'CANCELLED'}});
    const event=await tx.supplierPaymentPlanEvent.create({data:{planId:id,actorUserId:actor.id,action:'CANCELLED',
      snapshot:JSON.parse(JSON.stringify({before,after:updated,actorName:actor.name}))}});
    if(admin)await notifyProcurementManagerAboutDecision({db:tx,plan:updated,decision:'CANCELLED',eventKey:event.id});
    else await notifyAdminsAboutProcurementPlans({db:tx,plans:[updated],managerName:actor.name,action:'CANCELLED',eventKey:'procurement-cancel:'+event.id});
    return {...updated,events:[event]};
  });
}
