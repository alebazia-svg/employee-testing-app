import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { writeEmployeeActivity } from '../lib/employee-activity';
import { employeeActivityReport } from '../lib/employee-activity-report';
// Explicitly isolated local database, never run against a restored production database.
if (!/^postgresql:\/\/postgres:activity-local-only@127\.0\.0\.1:55464\/activity_test(?:\?|$)/.test(process.env.DATABASE_URL || '')) throw new Error('Use the isolated activity_test database on 55464.');
const ids: number[] = [];
after(async () => { await prisma.user.deleteMany({ where: { id: { in: ids } } }); await prisma.$disconnect(); });
test('journal deduplicates concurrent retries, excludes service sessions and separates open from auto-read', async () => {
  const u = await prisma.user.create({ data: { login: `activity-test-${Date.now()}`, name: 'Тест журнала', passwordHash: 'not-a-real-login', role: 'EMPLOYEE' } }); ids.push(u.id);
  const now = new Date('2026-10-24T08:00:00Z');
  const session = await prisma.portalAccessSession.create({ data: { userId: u.id, sessionHash: `test-${u.id}`, device: 'test', browser: 'test', expiresAt: new Date(+now+86400000) } });
  const visit = { key: 'test-visit-1', kind: 'visit' as const, section: 'day' as const };
  await Promise.all(Array.from({ length: 6 }, () => writeEmployeeActivity(u.id, session.sessionHash, visit, now)));
  assert.equal(await prisma.portalActivityEvent.count({ where: { userId: u.id } }), 1);
  await writeEmployeeActivity(u.id, session.sessionHash, {...visit,key:'test-reload-2'}, new Date(+now+1000));
  assert.equal(await prisma.portalActivityEvent.count({ where: { userId: u.id } }), 1);
  await writeEmployeeActivity(u.id, session.sessionHash, {...visit,key:'test-tab-3',section:'schedule'}, new Date(+now+2000));
  await writeEmployeeActivity(u.id, session.sessionHash, {...visit,key:'test-tab-4'}, new Date(+now+3000));
  assert.equal(await prisma.portalActivityEvent.count({ where: { userId: u.id } }), 3);
  assert.equal(await writeEmployeeActivity(u.id+999,session.sessionHash,visit,now), false);
  const n = await prisma.workdayNotification.create({ data: { userId: u.id, fingerprint: `test-${u.id}`, kind: 'task', title: 'Касса', body: 'Проверить', scheduledAt: now, sentAt: now, readAt: now, status: 'cancelled' } });
  let report = await employeeActivityReport(u.id,'2026-10-24',now);
  assert.equal(report.obligations[0].openedAt, null);
  assert.equal(report.obligations[0].result,'Выполнение не подтверждено');
  assert.equal(await writeEmployeeActivity(u.id,session.sessionHash,{key:'test-open-1',kind:'notification_open',notificationId:n.id+999999},now),false);
  await writeEmployeeActivity(u.id,session.sessionHash,{key:'test-open-1',kind:'notification_open',notificationId:n.id},new Date(+now+5000));
  await writeEmployeeActivity(u.id,session.sessionHash,{key:'test-open-2',kind:'notification_open',notificationId:n.id},new Date(+now+6000));
  report=await employeeActivityReport(u.id,'2026-10-24',now);
  assert.equal(report.obligations[0].openedAt,new Date(+now+5000).toISOString());
  assert.equal(await prisma.portalActivityEvent.count({where:{userId:u.id,kind:'notification_open'}}),1);
  await prisma.portalAccessSession.update({where:{id:session.id},data:{isService:true}});
  assert.equal(await writeEmployeeActivity(u.id,session.sessionHash,{...visit,key:'test-service-1'},now),false);
  report=await employeeActivityReport(u.id,'2026-10-24',now);
  assert.equal(report.sections.reduce((sum,s)=>sum+s.visits,0),0);
  assert.equal(report.obligations[0].openedAt,null);
  await prisma.portalAccessSession.update({where:{id:session.id},data:{isService:false}});
  await prisma.portalActivityEvent.createMany({data:Array.from({length:600},(_,i)=>({userId:u.id,sessionId:session.id,eventKey:`limit-${i}`,section:'day',kind:'visit',createdAt:now}))});
  assert.equal(await writeEmployeeActivity(u.id,session.sessionHash,{...visit,key:'test-limit'},now),false);
  assert.equal((await employeeActivityReport(u.id,'2026-10-24',now)).truncated,true);
});
test('unavailable journal table does not throw or mutate business data', async () => {
  const u = await prisma.user.create({data:{login:`offline-test-${Date.now()}`,name:'Offline journal',role:'EMPLOYEE',passwordHash:'not-a-login'}}); ids.push(u.id);
  await prisma.portalAccessSession.create({data:{userId:u.id,sessionHash:'test-offline',device:'test',browser:'test',expiresAt:new Date(Date.now()+86400000)}});
  const n = await prisma.workdayNotification.count();
  await prisma.$executeRawUnsafe('ALTER TABLE "PortalActivityEvent" RENAME TO "PortalActivityEvent_test_offline"');
  try { assert.equal(await writeEmployeeActivity(u.id,'test-offline',{key:'test-failure',kind:'visit',section:'day'}),false); }
  finally { await prisma.$executeRawUnsafe('ALTER TABLE "PortalActivityEvent_test_offline" RENAME TO "PortalActivityEvent"'); }
  assert.equal(await prisma.workdayNotification.count(),n);
});
