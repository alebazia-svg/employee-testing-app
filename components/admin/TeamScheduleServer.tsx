import { prisma } from '@/lib/prisma';
import { getTeamGoogleSnapshot } from '@/lib/team-control-source';
import { googleDay, resolveTeamSchedule } from '@/lib/team-control';
import { formatTime } from '@/lib/workday';
import { TeamSchedule } from './TeamSchedule';
export async function TeamScheduleServer({date,view}:{date:string;view?:string}) {
 const month=date.slice(0,7),from=month+'-01',to=month+'-31';
 const [users,schedules,vacations,google]=await Promise.all([
  prisma.user.findMany({where:{role:'EMPLOYEE',isActive:true,department:{in:['retail','wholesale']}},select:{id:true,name:true,department:true},orderBy:[{department:'asc'},{name:'asc'}]}),
  prisma.workScheduleEntry.findMany({where:{date:{gte:from,lte:to}}}),
  prisma.employeeVacation.findMany({where:{status:'active',dateFrom:{lte:to},dateTo:{gte:from}}}),getTeamGoogleSnapshot()]);
 const [year,m]=month.split('-').map(Number),length=new Date(Date.UTC(year,m,0)).getUTCDate();
 const dates=Array.from({length},(_,i)=>month+'-'+String(i+1).padStart(2,'0'));
 const people=users.map(u=>{const days=dates.map(d=>{
  const app=schedules.find(s=>s.userId===u.id&&s.date===d)?.status??'unset';
  const g=googleDay(u.name,d,google.plans,google.marks);const gp=google.planAvailable?g.plan??'unknown':'unavailable';
  const vacation=vacations.some(v=>v.userId===u.id&&v.dateFrom<=d&&v.dateTo>=d);
  const plan=resolveTeamSchedule({name:u.name,appStatus:app,googlePlan:g.plan,googleAvailable:google.planAvailable,vacation});
  return {date:d,app,google:gp,plan:plan.state==='unknown'&&plan.app?'unset':plan.state,source:plan.source,vacation,note:g.note};
 });return {...u,source:days.find(d=>d.date===date)?.source??'Приложение',days};});
 return <TeamSchedule people={people} month={month} date={date} initialView={view} readAt={formatTime(new Date(google.readAt))} warning={!google.planAvailable?'График Google сейчас недоступен.':''}/>;
}
