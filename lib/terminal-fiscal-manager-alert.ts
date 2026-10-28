import 'server-only';
import type {PrismaClient} from '@prisma/client';
import {technicalHash} from './terminal-fiscal-sources';
import type {MatchingAuditRecord} from './terminal-fiscal-matching';
import {loadFiscalManager} from './terminal-fiscal-manager-loader';
export const FISCAL_MANAGER_SOURCE='fiscal_manager_attribution';
export async function syncFiscalManagerAlert(db:PrismaClient,record:MatchingAuditRecord,cashiers:Array<{ref:string;name:string}>){
  // Incomplete sources cannot accuse a cashier or retire an earlier discrepancy.
  if(!Object.values(record.sourceCompleteness).every(Boolean))return;
  const at=new Date(record.evidence.bankTransactionDate);
  if(!Number.isFinite(+at))return;
  const manager=await loadFiscalManager(db,{at,mappingId:record.mappingId,cashiers});
  const active=manager.state==='conflict'||manager.state==='unknown';
  // Normal source delay is not a configuration error.
  if(active&&+new Date(record.evaluatedAt)-+at<30*60000)return;
  const sourceId=technicalHash(record.matchingKey),eventKey=`fiscal-manager:${sourceId}`;
  await db.$transaction(async tx=>{
    const existing=await tx.adminInboxEvent.findUnique({where:{eventKey}});
    if(!active&&!existing)return;
    const type=`fiscal_manager.${active?'attention':'resolved'}`;
    const reopened=active&&existing?.type==='fiscal_manager.resolved';
    const date=at.toLocaleDateString('en-CA',{timeZone:'Europe/Moscow'});
    const title=active?'Проверить ответственного за оплату':'Ответственный за оплату определён';
    const body=`${(record.amountKopecks/100).toLocaleString('ru-RU')} ₽ · ${at.toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})}. ${manager.note} Финансовая сверка ведётся отдельно; повторный чек не требуется.`;
    const event=await tx.adminInboxEvent.upsert({where:{eventKey},create:{eventKey,type,title,body,sourceType:FISCAL_MANAGER_SOURCE,sourceId,href:`/admin/workday/tbank?date=${date}`,occurredAt:new Date(record.evaluatedAt)},update:{type,title,body,...(reopened?{occurredAt:new Date(record.evaluatedAt)}:{})}});
    if(active){
      const admins=await tx.user.findMany({where:{role:'ADMIN',isActive:true},select:{id:true}});
      await tx.adminInboxReceipt.createMany({data:admins.map(a=>({eventId:event.id,userId:a.id})),skipDuplicates:true});
      if(reopened)await tx.adminInboxReceipt.updateMany({where:{eventId:event.id},data:{readAt:null}});
    }
  });
}
