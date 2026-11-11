import { prisma } from '@/lib/prisma';
import { getTeamGoogleSnapshot } from '@/lib/team-control-source';
import { googleDay, resolveTeamSchedule, teamCalendarSourceLabel } from '@/lib/team-control';
import { formatTime } from '@/lib/workday';
import { calendarQrAccepted, calendarCorrectionSourceId, CALENDAR_CORRECTION_SOURCE, parseCalendarWorkingCorrection, resolveCalendarFact } from '@/lib/team-calendar-fact';
import { TeamSchedule } from './TeamSchedule';
export async function TeamScheduleServer({date,view,now = new Date()}:{date:string;view?:string;now?:Date}) {
 const month=date.slice(0,7),from=month+'-01',to=month+'-31';
 const [users,schedules,vacations,google]=await Promise.all([
  prisma.user.findMany({where:{role:'EMPLOYEE',isActive:true,department:{in:['retail','wholesale','procurement']}},select:{id:true,name:true,department:true},orderBy:[{department:'asc'},{name:'asc'}]}),
  prisma.workScheduleEntry.findMany({where:{date:{gte:from,lte:to}}}),
  prisma.employeeVacation.findMany({where:{status:'active',dateFrom:{lte:to},dateTo:{gte:from}}}),getTeamGoogleSnapshot()]);
 const [year,m]=month.split('-').map(Number),length=new Date(Date.UTC(year,m,0)).getUTCDate();
 const dates=Array.from({length},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));
 // Failed QR reads propagate as a page error. Never turn a failed read into an
 // empty attendance list and a calendar full of invented automatic days off.
 const ids=users.map(u=>u.id);
 const [workdays,intents,events]=await Promise.all([
  prisma.workDayEntry.findMany({where:{userId:{in:ids},date:{gte:from,lte:to}},select:{userId:true,date:true,qrAcceptedAt:true}}),
  prisma.workdayStartIntent.findMany({where:{userId:{in:ids},date:{gte:from,lte:to}},select:{userId:true,date:true,qrAcceptedAt:true}}),
  prisma.adminInboxEvent.findMany({where:{sourceType:CALENDAR_CORRECTION_SOURCE,sourceId:{in:users.flatMap(u=>dates.map(d=>calendarCorrectionSourceId(u.id,d)))}},orderBy:[{occurredAt:'desc'},{id:'desc'}],select:{id:true,sourceId:true,body:true,occurredAt:true}}),
 ]);
 const qr=new Map<string,Array<Date>>();
 for(const row of [...workdays,...intents])if(row.qrAcceptedAt){const key=calendarCorrectionSourceId(row.userId,row.date);qr.set(key,[...(qr.get(key)??[]),row.qrAcceptedAt]);}
 const people=users.map(u=>{const days=dates.map(d=>{
  const app=schedules.find(s=>s.userId===u.id&&s.date===d)?.status??'unset';
  const g=googleDay(u.name,d,google.plans,google.marks);const gp=google.planAvailable?g.plan??'unknown':'unavailable';
  const vacation=vacations.some(v=>v.userId===u.id&&v.dateFrom<=d&&v.dateTo>=d);
  const plan=resolveTeamSchedule({name:u.name,appStatus:app,googlePlan:g.plan,googleAvailable:google.planAvailable,vacation});
  const plannedState=plan.state==='unknown'&&plan.app?'unset':plan.state;
  const savedSource=teamCalendarSourceLabel(plan,g.ambiguous),key=calendarCorrectionSourceId(u.id,d);
  const history=events.filter(e=>e.sourceId===key).flatMap(e=>{
    const correction=parseCalendarWorkingCorrection(e.body);
    return correction?.userId===u.id&&correction.date===d ? [{id:e.id,...correction}] : [];
  });
  const fact=resolveCalendarFact({date:d,department:u.department,plan:plannedState,source:savedSource,vacation,qrAccepted:calendarQrAccepted(d,qr.get(key)??[],now),correction:history[0],now});
  return {date:d,app,google:gp,plan:fact.state,source:fact.source,vacation,note:g.note,savedPlan:plannedState,savedSource,
    factExplanation:fact.explanation,factual:fact.factual,canMarkWorking:fact.canMarkWorking,correctionId:history[0]?.id??null,
    correctionActive:history[0]?.status==='working',correctionHistory:history.map(h=>({actor:h.actorName,at:h.correctedAt,reason:h.reason,status:h.status}))};
 });return {...u,source:days.find(d=>d.date===date)?.source??'Приложение',days};});
 return <TeamSchedule people={people} month={month} date={date} initialView={view} readAt={formatTime(new Date(google.readAt))} warning={!google.planAvailable?'График Google сейчас недоступен.':''}/>;
}
