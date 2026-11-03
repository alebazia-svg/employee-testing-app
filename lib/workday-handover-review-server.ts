import 'server-only';
import { Prisma } from '@prisma/client';
import { HANDOVER_REVIEW_DECISION, HANDOVER_REVIEW_EVENT, HANDOVER_REVIEW_SOURCE, handoverReviewCheckId, handoverReviewHref, handoverReviewRecord, needsHandoverReview } from './workday-handover-review';

type Db = Pick<Prisma.TransactionClient, 'shiftControlTask' | 'shiftControlManualReview' | 'user' | 'adminInboxEvent' | 'adminInboxReceipt'>;
export const handoverReviewInclude = {
  run: {include: {workDayEntry: true, user: {select: {id:true,name:true,department:true}}}},
  manualReviews: {where: {decision: HANDOVER_REVIEW_DECISION}, orderBy: [{reviewedAt:'desc'},{id:'desc'}], include: {reviewedBy: {select:{id:true,name:true}}}},
} satisfies Prisma.ShiftControlTaskInclude;

export async function loadOpenHandoverReviews(db: Db, input: {dateBefore?: string; workDayEntryId?: number} = {}) {
  const tasks = await db.shiftControlTask.findMany({
    where: {category:'handover',required:true,status:{not:'done'},
      run:{department:{in:['retail','wholesale']},workDayEntry:{endedAt:{not:null}},
        ...(input.dateBefore ? {date:{lt:input.dateBefore}} : {}),
        ...(input.workDayEntryId ? {workDayEntryId:input.workDayEntryId} : {})},
    }, include:handoverReviewInclude, orderBy:[{run:{date:'asc'}},{id:'asc'}],
  });
  return tasks.filter(task => needsHandoverReview(task,task.run.workDayEntry) && !handoverReviewRecord(task.id,task.manualReviews));
}

/** One event per handover. Existing late closures are recovered by the normal runner. */
export async function syncClosedHandoverReviews(db: Db, input: {now:Date; workDayEntryId?:number}) {
  const tasks = await loadOpenHandoverReviews(db, {workDayEntryId:input.workDayEntryId});
  const admins = tasks.length ? await db.user.findMany({where:{role:'ADMIN',isActive:true},select:{id:true}}) : [];
  for (const task of tasks) {
    const dateLabel = new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'}).format(new Date(`${task.run.date}T12:00:00Z`));
    const event = await db.adminInboxEvent.upsert({where:{eventKey:`workday:handover-review:${task.id}`},
      create:{eventKey:`workday:handover-review:${task.id}`,type:HANDOVER_REVIEW_EVENT,sourceType:HANDOVER_REVIEW_SOURCE,sourceId:String(task.id),
        title:'Не сдана смена',body:`${task.run.user.name} · ${dateLabel}`,href:handoverReviewHref(task.run.date,task.run.userId),occurredAt:task.run.workDayEntry.endedAt!},update:{}});
    if(admins.length) await db.adminInboxReceipt.createMany({data:admins.map(admin=>({eventId:event.id,userId:admin.id})),skipDuplicates:true});
  }
  return tasks.length;
}

/** Call inside a transaction. Locking also makes a double click/retry idempotent. */
export async function acknowledgeHandoverReview(tx: Prisma.TransactionClient, taskId:number, adminId:number, now:Date) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106311, ${taskId}::integer)`;
  const task = await tx.shiftControlTask.findUnique({where:{id:taskId},include:handoverReviewInclude});
  if(!task) return {ok:false as const,status:404,error:'Сдача смены не найдена.'};
  const existing = handoverReviewRecord(taskId,task.manualReviews);
  if(!existing && !needsHandoverReview(task,task.run.workDayEntry)) return {ok:false as const,status:409,error:'Эта смена не требует такой проверки. Обновите карточку.'};
  const review = existing ?? await tx.shiftControlManualReview.create({data:{taskId,checkId:handoverReviewCheckId(taskId),checkLabel:'Сдача смены не заполнена',decision:HANDOVER_REVIEW_DECISION,
    comment:'Проверено администратором. Сдача смены осталась незаполненной.',reviewedById:adminId,reviewedAt:now},include:{reviewedBy:{select:{id:true,name:true}}}});
  await tx.adminInboxReceipt.updateMany({where:{event:{sourceType:HANDOVER_REVIEW_SOURCE,sourceId:String(taskId)},readAt:null},data:{readAt:now}});
  return {ok:true as const,review:{id:review.id,reviewedAt:review.reviewedAt.toISOString(),reviewedBy:review.reviewedBy.name}};
}
