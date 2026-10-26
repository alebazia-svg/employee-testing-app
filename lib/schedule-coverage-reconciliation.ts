import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { getMoscowDateKey } from './workday';
import { reconcileScheduleQuestions } from './work-schedule-notifications';
import { scheduleCoverageQuestion, scheduleCoverageRef, scheduleQuestionDates } from './schedule-coverage-question';

type Db = Prisma.TransactionClient;
export async function loadScheduleCoverageQuestions(db: Db, refs: string[], now = new Date()) {
  const parsed = [...new Set(refs)].flatMap(ref => {const p=scheduleCoverageRef(ref);return p?[{...p,ref}]:[];});
  if (!parsed.length) return new Map<string,ReturnType<typeof scheduleCoverageQuestion>>();
  const dates=parsed.map(p=>p.date).sort(), departments=[...new Set(parsed.map(p=>p.department))];
  const [employees,entries,vacations] = await Promise.all([
    db.user.findMany({where:{role:'EMPLOYEE',isActive:true,department:{in:departments}},select:{id:true,name:true,department:true}}),
    db.workScheduleEntry.findMany({where:{date:{in:dates},department:{in:departments},user:{role:'EMPLOYEE',isActive:true}},select:{userId:true,date:true,status:true,department:true}}),
    db.employeeVacation.findMany({where:{status:'active',department:{in:departments},dateFrom:{lte:dates.at(-1)!},dateTo:{gte:dates[0]}},select:{userId:true,dateFrom:true,dateTo:true}}),
  ]);
  return new Map(parsed.map(p=>[p.ref,scheduleCoverageQuestion({...p,today:getMoscowDateKey(now),employees:employees.filter(e=>e.department===p.department),entries:entries.filter(e=>e.date===p.date&&e.department===p.department),vacations})]));
}
export async function reconcileScheduleCoverageQuestion(db: Db, department: string, date: string, now = new Date(), create = true) {
  const ref=`${department}:${date}`, question=(await loadScheduleCoverageQuestions(db,[ref],now)).get(ref);
  if (!question) return;
  const key=`schedule-coverage:${ref}`, previous=await db.adminInboxEvent.findUnique({where:{eventKey:key}});
  if (!question.active) {
    if (previous) await db.adminInboxReceipt.updateMany({where:{eventId:previous.id,readAt:null},data:{readAt:now}});
    return;
  }
  if (!previous && !create) return;
  const changed=!previous || previous.title!==question.title || previous.body!==question.body;
  const event=await db.adminInboxEvent.upsert({where:{eventKey:key},create:{eventKey:key,type:'work_schedule.coverage_gap',title:question.title,body:question.body,href:`/admin/attendance?date=${date}`,sourceType:'work_schedule_coverage',sourceId:ref,occurredAt:now},update:changed?{title:question.title,body:question.body,href:`/admin/attendance?date=${date}`,occurredAt:now}:{}});
  const admins=await db.user.findMany({where:{role:'ADMIN',isActive:true},select:{id:true}});
  if (admins.length) await db.adminInboxReceipt.createMany({data:admins.map(a=>({eventId:event.id,userId:a.id})),skipDuplicates:true});
}
/** Reuses the existing minute notification worker. One question per employee/date. */
export async function queueScheduleFillQuestions(db: PrismaClient, now = new Date()) {
  const dates=scheduleQuestionDates(now);
  const result={processed:0,failed:0};
  for (const date of dates) for (const department of ['retail','wholesale']) {
    try { await db.$transaction(async tx => {
      await reconcileScheduleQuestions(tx,{actorId:0,department,date,requestKnownOff:false,now});
      await reconcileScheduleCoverageQuestion(tx,department,date,now);
    }, {isolationLevel:'Serializable',timeout:10000}); result.processed++; } catch { result.failed++; }
  }
  return result;
}
