import 'server-only';
import { readExperience } from './employee-experience-policy';
import { prisma } from './prisma';
import { inspectionDeviceSnapshot, type InspectionDeviceSnapshot } from './employee-inspection-state';

/** Called only after actor-bound ADMIN preview authorization. Read-only. */
export async function loadEmployeeInspectionDevices(userId: number, selectedId: string | null, now = new Date()): Promise<InspectionDeviceSnapshot> {
  const records = await prisma.portalAccessSession.findMany({ where:{userId}, orderBy:[{lastSeenAt:'desc'},{id:'asc'}], take:500,
    select:{id:true,userId:true,device:true,browser:true,browserInstanceId:true,observedBrowserId:true,isService:true,serviceMarkedAt:true,listArchivedAt:true,lastSeenAt:true,expiresAt:true,loggedOutAt:true,displayMode:true,contextCheckedAt:true,deviceObservation:true,appObservation:true,appCheckedAt:true,pushState:true,pushCheckedAt:true,pushSubscription:{select:{userId:true,disabledAt:true}}} });
  const ids = [...new Set(records.flatMap(r=>r.browserInstanceId ? [r.browserInstanceId] : []))];
  const [admins,owners] = ids.length ? await Promise.all([
    prisma.portalAccessSession.findMany({where:{browserInstanceId:{in:ids},user:{role:'ADMIN'}},select:{browserInstanceId:true},distinct:['browserInstanceId']}),
    prisma.portalAccessBrowserOwner.findMany({where:{browserInstanceId:{in:ids},disabledAt:null,owner:{isActive:true,role:'ADMIN'}},select:{browserInstanceId:true}}),
  ]) : [[],[]];
  const visibilityEvents=await prisma.portalActivityEvent.findMany({where:{userId,kind:'experience',createdAt:{gte:new Date(now.getTime()-60000)},context:{path:['action'],equals:'app'}},orderBy:{createdAt:'desc'},take:100});
  const hidden=new Map<string,Date>();
  const seen=new Set<string>();for(const e of visibilityEvents){if(seen.has(e.sessionId))continue;seen.add(e.sessionId);const c=readExperience(e.context);if(c?.target==='workflow'&&c.stage==='background')hidden.set(e.sessionId,e.createdAt);}
  const snapshot=inspectionDeviceSnapshot(records,userId,selectedId,new Set(admins.flatMap(r=>r.browserInstanceId ? [r.browserInstanceId]:[])),new Set(owners.map(r=>r.browserInstanceId)),now);
  for(const c of snapshot.connections)if(hidden.has(c.id)&&(!c.runtimeAt||hidden.get(c.id)!.getTime()>=Date.parse(c.runtimeAt)))c.live=false;
  return snapshot;
}
