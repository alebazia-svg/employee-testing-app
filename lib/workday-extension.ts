import { Prisma, type PrismaClient } from '@prisma/client';
import { getMoscowDateKey, getMoscowMinutes, getShiftOption } from './workday';

export type ExtensionDay = {
  id: number; userId: number; date: string; department: string; status: string;
  startedAt: Date; endedAt: Date | null; shiftCode: string; shiftEndMinutes: number | null;
};
export type ExtensionProposal = { workDayId: number; userId: number; departedId: number; date: string; fromShiftCode: string; toShiftCode: '09_20'; endMinutes: number };
export function deriveExtensionProposal(days: ExtensionDay[], now = new Date()): ExtensionProposal | null {
  const date = getMoscowDateKey(now), minute = getMoscowMinutes(now);
  const retail = days.filter(d => d.department === 'retail' && d.date === date && d.startedAt <= now);
  const active = retail.filter(d => d.status === 'active' && !d.endedAt);
  if (active.length !== 1 || minute >= 1200) return null;
  const current = active[0];
  if (current.shiftCode !== '09_18' || current.shiftEndMinutes !== 1080) return null;
  const departed = retail.filter(d => d.userId !== current.userId && d.status === 'completed' && d.endedAt && d.endedAt <= now
    && d.shiftEndMinutes === 1200 && getMoscowMinutes(d.endedAt) < 1200 && d.endedAt > current.startedAt)
    .sort((a,b) => +b.endedAt! - +a.endedAt!)[0];
  return departed ? {workDayId:current.id,userId:current.userId,departedId:departed.id,date,fromShiftCode:current.shiftCode,toShiftCode:'09_20',endMinutes:1200} : null;
}
export const extensionKey = (id:number) => `workday-extension:${id}:09_20`;
export class ExtensionChanged extends Error {}

/** No attendance timestamps, payroll snapshots, completed tasks or money are rewritten. */
export async function approveWorkdayExtension(db:PrismaClient, input:{adminId:number;proposal:ExtensionProposal;now?:Date}) {
  const now=input.now??new Date(), expected=input.proposal;
  for(let attempt=0;attempt<3;attempt++) {
    try { return await db.$transaction(async tx=>{
      const admin=await tx.user.findFirst({where:{id:input.adminId,role:'ADMIN',isActive:true},select:{id:true,name:true}});
      if(!admin) throw new ExtensionChanged('Нет доступа.');
      // Same lock order as workday completion. Serializable isolation also guards a new replacement.
      await tx.$queryRaw`SELECT "id" FROM "WorkDayEntry" WHERE "date" = ${expected.date} AND "department" = 'retail' ORDER BY "id" FOR UPDATE`;
      const existing=await tx.adminInboxEvent.findUnique({where:{eventKey:extensionKey(expected.workDayId)}});
      if(existing) return {alreadyApproved:true};
      const days=await tx.workDayEntry.findMany({where:{date:expected.date,department:'retail'},include:{user:{select:{name:true}}}});
      const fresh=deriveExtensionProposal(days,now);
      if(!fresh || (['workDayId','userId','departedId','date','fromShiftCode','toShiftCode','endMinutes'] as const).some(k=>fresh[k]!==expected[k])) throw new ExtensionChanged('Состав смены изменился. Обновите экран: возможно, уже вышла замена.');
      const day=days.find(d=>d.id===fresh.workDayId)!;
      const run=await tx.shiftControlRun.findUnique({where:{workDayEntryId:day.id},include:{tasks:true}});
      if(run && (run.status!=='active' || run.tasks.some(t=>['closing','handover'].includes(t.category) && (t.status!=='pending'||t.completedAt))))
        throw new ExtensionChanged('Сдача смены уже началась. Продление требует проверки администратора.');
      const shift=getShiftOption('09_20');
      await tx.workDayEntry.update({where:{id:day.id},data:{shiftCode:shift.code,shiftLabel:shift.label,shiftEndMinutes:shift.endMinutes}});
      await tx.workdayShiftChange.create({data:{workDayEntryId:day.id,userId:day.userId,source:'admin_extension',fromShiftCode:day.shiftCode,fromShiftLabel:day.shiftLabel,
        toShiftCode:shift.code,toShiftLabel:shift.label,fromLateMinutes:day.lateMinutes,toLateMinutes:day.lateMinutes,
        fromShadowPointsX2:day.latenessShadowPointsX2,toShadowPointsX2:day.latenessShadowPointsX2,latenessPolicyVersion:day.latenessPolicyVersion,changedAt:now}});
      for(const task of run?.tasks??[]) {
        if(!['closing','handover'].includes(task.category) || task.plannedTimeMinutes===null) continue;
        const target=task.plannedTimeMinutes+120;
        await tx.shiftControlTask.update({where:{id:task.id},data:{plannedTimeMinutes:target}});
        // Preserve delivery/read state and every notification identity; move only unsent deadlines.
        const reminders=await tx.workdayNotification.findMany({where:{taskId:task.id,status:'pending',kind:{in:['planned','overdue','overdue_repeat','early_finish_reminder']}}});
        for(const reminder of reminders) await tx.workdayNotification.update({where:{id:reminder.id},data:{scheduledAt:new Date(+reminder.scheduledAt+120*60000),nextPushAttemptAt:null}});
      }
      await tx.adminInboxEvent.create({data:{eventKey:extensionKey(day.id),type:'workday.shift_extended',title:'Смена продлена до 20:00',
        body:`${admin.name}: ${day.user.name}, ${day.shiftLabel} → ${shift.label}. Досрочный уход: рабочий день №${fresh.departedId}.`,
        href:`/admin/workday?date=${day.date}&employee=${day.userId}`,sourceType:'workday_shift_extension',sourceId:String(day.id),occurredAt:now}});
      await tx.workdayNotification.create({data:{userId:day.userId,fingerprint:extensionKey(day.id),kind:'workday_shift_extension',title:'Смена продлена до 20:00',
        body:'Администратор подтвердил продление смены до 20:00. Изменение сохранено в истории рабочего дня.',scheduledAt:now}});
      return {alreadyApproved:false};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable}); }
    catch(error) { if(error instanceof Prisma.PrismaClientKnownRequestError&&(error.code==='P2034'||(error.code==='P2010'&&error.meta?.code==='40001'))&&attempt<2)continue; throw error; }
  }
  throw new ExtensionChanged('Повторите подтверждение.');
}
