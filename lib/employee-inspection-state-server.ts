import 'server-only';
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
  return inspectionDeviceSnapshot(records,userId,selectedId,new Set(admins.flatMap(r=>r.browserInstanceId ? [r.browserInstanceId]:[])),new Set(owners.map(r=>r.browserInstanceId)),now);
}
