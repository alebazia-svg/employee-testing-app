import 'server-only';
import {prisma} from './prisma';
import {getMoscowDateKey} from './workday';
import {loadKkmCloseReports} from './kkm-close-report-cache';

/** Warm source evidence only. Never create a photo request or complete a task. */
export async function prefetchKkmCloseReports(now=new Date(),db=prisma,load=loadKkmCloseReports) {
 const date=getMoscowDateKey(now);
 const working=await db.workDayEntry.count({where:{date,department:'retail',user:{role:'EMPLOYEE',isActive:true,portalArea:'WORKDAY'}}});
 if(!working)return {checked:0,complete:0};
 const mappings=await db.terminalFiscalMapping.findMany({where:{isActive:true,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},select:{kktRegistrationNumber:true}});
 const next=new Date(`${date}T12:00:00Z`);next.setUTCDate(next.getUTCDate()+1);
 const from=`${date}T00:00:00+03:00`,to=`${next.toISOString().slice(0,10)}T00:00:00+03:00`;
 const registers=[...new Set(mappings.map(row=>row.kktRegistrationNumber).filter(Boolean))];
 const results=await Promise.allSettled(registers.map(kktRegistrationNumber=>load({kktRegistrationNumber,from,to},{force:true,prefetch:true})));
 return {checked:registers.length,complete:results.filter(r=>r.status==='fulfilled'&&r.value.complete).length};
}
