import assert from 'node:assert/strict';
import test from 'node:test';
import { PrismaClient } from '@prisma/client';
import { createSessionToken } from '../lib/session';
const url = process.env.DIANA_SCHEDULE_TEST_DATABASE_URL;
const base = process.env.DIANA_SCHEDULE_TEST_ORIGIN;
test('isolated real HTTP: Diana backfills October without QR; other users and payroll stay unchanged', { skip: !url || !base }, async () => {
  const parsed = new URL(url!); assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.port,'55438');assert.equal(parsed.pathname,'/astemir_local_demo');assert.equal(base,'http://localhost:3235');
  const db = new PrismaClient({datasources:{db:{url}}});
  const diana = await db.user.findUniqueOrThrow({where:{login:'diana-local-demo'}});
  const other = await db.user.findUniqueOrThrow({where:{login:'m.kumykov'}});
  assert.equal(diana.name,'Кумахова Диана');
  assert.equal(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date()).slice(0,7),'2026-10');
  const old = await db.workScheduleEntry.findMany({where:{userId:diana.id,date:{startsWith:'2026-10-'}}});
  const otherDays = await db.workScheduleEntry.findMany({where:{userId:other.id}});
  const payrollState = () => Promise.all([db.payrollRun.findMany({orderBy:{id:'asc'}}),db.payrollDraftRevision.findMany({orderBy:{id:'asc'}}),db.payrollAttendanceSnapshot.findMany({orderBy:{id:'asc'}})]);
  const payrollBefore = await payrollState();
  const facts = await db.workDayEntry.findMany({orderBy:{id:'asc'}});
  const req = (path:string, body?:unknown, user = diana) => fetch(base+path,{method:body?'POST':'GET',headers:{origin:base!,'content-type':'application/json',cookie:'offonika_session='+createSessionToken(user.id,Date.now(),{sessionVersion:user.sessionVersion})},...(body?{body:JSON.stringify(body)}:{})});
  try {
    await db.workScheduleEntry.deleteMany({where:{userId:diana.id,date:{startsWith:'2026-10-'}}});
    const path='/api/employee/workday/schedule';
    assert.equal((await req(path,{date:'2026-10-01',status:'working'},other)).status,409);
    assert.equal((await req(path,{date:'2026-09-01',status:'working'})).status,409);
    const changes=Array.from({length:31},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,status:i<20?'working':'off',previousStatus:null}));
    const saved=await req(path+'/bulk',{confirmed:true,monthKey:'2026-10',mode:'plan',changes});assert.equal(saved.status,200);assert.equal((await saved.json()).changedCount,31);
    assert.deepEqual(await payrollState(),payrollBefore,'calendar edits never modify payroll runs, drafts or attendance sources');
    assert.deepEqual(await db.workDayEntry.findMany({orderBy:{id:'asc'}}),facts,'calendar never creates or modifies QR attendance');
    assert.deepEqual(await db.workScheduleEntry.findMany({where:{userId:other.id}}),otherDays);
    assert.equal((await req(path,{date:'2026-10-01',status:'working'})).status,200);
    assert.equal(await db.workScheduleEntry.count({where:{userId:diana.id,status:'working',date:{startsWith:'2026-10-'}}}),20);
  } finally {
    await db.workScheduleEntry.deleteMany({where:{userId:diana.id,date:{startsWith:'2026-10-'}}});if(old.length)await db.workScheduleEntry.createMany({data:old});
    await db.$disconnect();
  }
});
