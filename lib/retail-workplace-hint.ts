import {attendanceEmployeeKey} from './attendance-identity';
import type {TeamGoogleDay} from './team-control';
export type RetailWorkplacePerson={name:string;homeKkm:string|null;day:TeamGoogleDay;source?:string};
/** Display hypothesis only. Never financial proof, attendance import or recipient assignment. */
export function retailWorkplaceHint(people:RetailWorkplacePerson[],kkm:string,minute:number) {
 const find=(name:string)=>people.filter(p=>attendanceEmployeeKey(p.name)===attendanceEmployeeKey(name));
 const [z,m,g]=['Зухра','Милана','Магомед'].map(find);
 if(z.length!==1||m.length!==1||g.length!==1)return null;
 const [zuhra,milana,magomed]=[z[0],m[0],g[0]];
 if(!zuhra.homeKkm||!milana.homeKkm||zuhra.homeKkm===milana.homeKkm)return null;
 const owner=[zuhra,milana].find(p=>p.homeKkm===kkm);
 if(!owner)return null;
 const other=owner===zuhra?milana:zuhra;
 const started=(p:RetailWorkplacePerson)=>p.day.arrival!==null&&p.day.arrival<=minute&&(p.day.departure===null||p.day.departure>minute);
 if(people.some(p=>p.day.ambiguous))return null;
 const marked=people.filter(started);
 if(marked.length>2||marked.some(p=>![zuhra,milana,magomed].includes(p)))return null;
 if(started(owner))return {name:owner.name,basis:`По отметке ${owner.source||'Google'}`};
 if(!started(magomed))return null;
 if(owner.day.plan==='off'&&other.day.plan!=='off')return {name:magomed.name,basis:started(other)?`По отметкам ${[...new Set([other.source||'Google',magomed.source||'Google'])].join(' + ')} и графику`:'Предположительно по составу смены'};
 if(started(other))return {name:magomed.name,basis:'Предположительно по составу смены'};
 if(other.day.plan==='off'&&owner.day.plan!=='off')return {name:owner.name,basis:'Предположительно по составу смены'};
 return null;
}
