import type {TeamGoogleDay} from './team-control';
type AppMark={startedAt:Date;endedAt:Date|null;status:string};
function minute(at:Date) {
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(at);
 return Number(p.find(v=>v.type==='hour')?.value)*60+Number(p.find(v=>v.type==='minute')?.value);
}
/** Day-local priority: a real app shift overrides duplicate Google marks. No absence is fabricated. */
export function retailAttendanceSource(google:TeamGoogleDay,app:AppMark|null,appPlan?:string|null) {
 if(app&&['active','completed'].includes(app.status)&&Number.isFinite(app.startedAt.getTime()))return {
  source:'Приложение' as const,
  day:{...google,plan:'working' as const,arrival:minute(app.startedAt),departure:app.endedAt?minute(app.endedAt):null,ambiguous:false,note:'',shift:'',lateMinutes:0},
 };
 return {source:'Google' as const,day:google.arrival!==null?{...google,plan:'working' as const}:google};
}
