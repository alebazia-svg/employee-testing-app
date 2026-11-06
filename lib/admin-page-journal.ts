import 'server-only';
import { prisma } from './prisma';
import type { Prisma } from '@prisma/client';
import { adminPages, isAdminPage, type AdminVisitInput, type AdminJournalData, type AdminJournalBrowser } from './admin-page-policy';
import { validAccessBrowserId } from './portal-access-identity';
import { activityDayBounds, ACTIVITY_RETENTION_DAYS } from './employee-activity-policy';

let nextCleanup = 0;
/** Independent telemetry. Never changes session identity, device names, login or push state. */
export async function writeAdminVisit(userId: number, sessionHash: string, browserId: string, input: AdminVisitInput, now = new Date()) {
  const saved = await prisma.$transaction(async tx => {
    const actor = await tx.user.findUnique({where:{id:userId},select:{role:true,isActive:true}});
    if(actor?.role!=='ADMIN'||!actor.isActive)return false;
    const session = await tx.portalAccessSession.findUnique({ where: { sessionHash } });
    if (!session || session.userId !== userId || !validAccessBrowserId(browserId) || session.browserInstanceId !== browserId || session.observedBrowserId && session.observedBrowserId !== browserId || session.loggedOutAt || session.expiresAt <= now) return false;
    const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(73106271, ${userId}::integer) AS acquired`;
    if (!lock[0]?.acquired) return false;
    const last = await tx.portalActivityEvent.findFirst({ where: { sessionId: session.id, kind: 'admin_page' }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    if ((last?.context as {page?: string} | null)?.page === input.page && +now - +last!.createdAt < 30000) return true;
    if (await tx.portalActivityEvent.count({ where: { sessionId: session.id, kind: 'admin_page', createdAt: { gte: new Date(+now - 86400000) } } }) >= 600) return true;
    await tx.portalActivityEvent.createMany({ skipDuplicates: true, data: [{ userId, sessionId: session.id, kind: 'admin_page', section: input.page, eventKey: `admin:${input.key}`, context: { page: input.page, browserId, ...(input.previous ? {previous: input.previous} : {}) }, createdAt: now }] });
    await tx.portalActivityCoverage.upsert({ where: { id: 2 }, create: { id: 2, startedAt: now }, update: {} });
    return true;
  }, { maxWait: 1000, timeout: 4000 });
  if(+now>=nextCleanup){
    nextCleanup=+now+3600000;
    const cutoff=new Date(+now-ACTIVITY_RETENTION_DAYS*86400000);
    try {await prisma.$executeRaw`DELETE FROM "PortalActivityEvent" WHERE id IN (SELECT id FROM "PortalActivityEvent" WHERE kind = 'admin_page' AND "createdAt" < ${cutoff} ORDER BY "createdAt" LIMIT 1000)`;} catch { /* collection result remains valid */ }
  }
  return saved;
}


export async function readAdminJournal(params: URLSearchParams, now = new Date()): Promise<AdminJournalData> {
  const day = params.get('date');
  const bounds = day ? activityDayBounds(day) : null;
  if (day && (!bounds || +bounds.start > +now || +bounds.end < +now - ACTIVITY_RETENTION_DAYS * 86400000)) throw new RangeError('Дата вне срока хранения журнала.');
  const from = bounds?.start ?? new Date(new Date(new Date(+now + 10800000).toISOString().slice(0,10)+'T00:00:00+03:00').getTime()-6*86400000);
  const to = bounds?.end ?? new Date(+now + 1);
  const q = (params.get('q') || '').trim().toLowerCase();
  if (q.length > 100) throw new RangeError('Слишком длинный запрос.');
  const browserId = params.get('browser');
  if (browserId && !validAccessBrowserId(browserId)) throw new RangeError('Некорректный код подключения.');
  const cursor = params.get('cursor');
  if (cursor && !/^[a-z0-9]{10,40}$/.test(cursor)) throw new RangeError('Некорректная страница.');
  return prisma.$transaction(async tx => {
    const [owners, sessions, coverage] = await Promise.all([
      tx.portalAccessBrowserOwner.findMany({ where: { disabledAt: null } }),
      tx.portalAccessSession.findMany({ where: { browserInstanceId: {not:null}, OR: [{user:{role:'ADMIN'}}, {activityEvents:{some:{kind:'admin_page'}}}] }, select: {browserInstanceId:true,browser:true,device:true,isService:true}, take: 10001, orderBy:{firstSeenAt:'asc'} }),
      tx.portalActivityCoverage.findUnique({where:{id:2}}),
    ]);
    if (sessions.length > 10000) throw Error('Journal catalogue limit');
    const ownerMap = new Map(owners.map(o => [o.browserInstanceId,o]));
    const map = new Map<string, AdminJournalBrowser>();
    for (const s of sessions) {
      const id=s.browserInstanceId!; if (!validAccessBrowserId(id) || map.has(id)) continue;
      const owner=ownerMap.get(id), name=owner?.label || `${s.device} · ${s.browser}`;
      const group=owner?.deviceGroupId || id;
      map.set(id,{id,name,group,browser:s.browser,service:/codex|claude/i.test(name)||s.isService,connection:1});
    }
    const browsers=[...map.values()];
    const groupCodes=new Map<string, string[]>();
    for (const b of browsers) { const codes=groupCodes.get(b.group)||[]; codes.push(b.id); groupCodes.set(b.group,codes); b.connection=codes.length; }
    const target=browserId?map.get(browserId):null;
    const allowed=browserId ? target ? browsers.filter(b=> params.get('group')==='1' ? b.group===target.group : b.id===browserId).map(b=>b.id) : [] : browsers.filter(b=>b.service===(params.get('scope')==='service')).map(b=>b.id);
    const base: Prisma.PortalActivityEventWhereInput={kind:'admin_page',createdAt:{gte:from,lt:to},session:{browserInstanceId:{in:allowed}}};
    const matches=browsers.filter(b=>`${b.name} ${b.id} ${b.browser}`.toLowerCase().includes(q)).map(b=>b.id);
    const pages=Object.entries(adminPages).filter(([,v])=>v.join(' ').toLowerCase().includes(q)).map(([key])=>key);
    const where: Prisma.PortalActivityEventWhereInput=q?{AND:[base,{OR:[{section:{in:pages}},{session:{browserInstanceId:{in:matches}}}]}]}:base;
    let after: Prisma.PortalActivityEventWhereInput={};
    if (cursor) { const edge=await tx.portalActivityEvent.findFirst({where:{AND:[where,{id:cursor}]},select:{id:true,createdAt:true}}); if (!edge) throw new RangeError('Список изменился. Обновите журнал.'); after={OR:[{createdAt:{lt:edge.createdAt}},{createdAt:edge.createdAt,id:{lt:edge.id}}]}; }
    const [count,sections,latest,matched,events]=await Promise.all([
      tx.portalActivityEvent.count({where:base}), tx.portalActivityEvent.groupBy({by:['section'],where:base}),
      tx.portalActivityEvent.findFirst({where:base,orderBy:[{createdAt:'desc'},{id:'desc'}],select:{createdAt:true}}),
      tx.portalActivityEvent.count({where}), tx.portalActivityEvent.findMany({where:{AND:[where,after]},orderBy:[{createdAt:'desc'},{id:'desc'}],take:51,include:{session:{select:{browserInstanceId:true}},user:{select:{name:true,login:true}}}}),
    ]);
    const visits=events.slice(0,50).map(e=>{const c=e.context as {previous?:unknown}; if (!isAdminPage(e.section)) throw Error('Unknown journal section'); return {id:e.id,browserId:e.session.browserInstanceId!,page:e.section,createdAt:e.createdAt.toISOString(),account:`${e.user.name} · ${e.user.login}`,...(isAdminPage(c?.previous)?{previous:c.previous}:{})};});
    return {startedAt:coverage?.startedAt.toISOString()||null,browsers,visits,summary:{count,sections:sections.length,latest:latest?.createdAt.toISOString()||null},matched,nextCursor:events.length>50?events[49].id:null};
  },{isolationLevel:'RepeatableRead',maxWait:1000,timeout:8000});
}
