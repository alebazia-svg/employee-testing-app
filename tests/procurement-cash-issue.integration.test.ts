import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { getMoscowDateKey } from '../lib/workday';
import { CASH_ISSUE_KIND } from '../lib/procurement-cash-issue-policy';
import { DELIVERY_PHONE_RESERVE_REF } from '../lib/procurement-delivery-reserve';

test('isolated PostgreSQL: cashier assignment, partial issue, reassignment, re-entry and no duplicate tasks', { skip: process.env.CASH_ISSUE_INTEGRATION !== '1' }, async () => {
  assert.equal(process.env.DATABASE_URL, 'postgresql://attention:local-attention-only@127.0.0.1:55448/admin_attention_20261012_test');
  const db = new PrismaClient();
  const marker = `cash-issue-${crypto.randomUUID()}`;
  const a = await db.user.create({ data: { login: `${marker}-a`, name: 'Cashier A', role: 'EMPLOYEE', passwordHash: 'unused' } });
  const b = await db.user.create({ data: { login: `${marker}-b`, name: 'Cashier B', role: 'EMPLOYEE', passwordHash: 'unused' } });
  const cashA = crypto.randomUUID(), cashB = crypto.randomUUID(), ref = crypto.randomUUID();
  let source = 'ready', cashboxRef = cashA, remaining = 5000;
  try {
    await db.userOneCCashboxMapping.createMany({ data: [{ userId: a.id, oneCCashboxRef: cashA, oneCCashboxName: 'A' }, { userId: b.id, oneCCashboxRef: cashB, oneCCashboxName: 'B' }] });
    const mocks: Record<string, any> = { './prisma': { prisma: db }, './procurement-delivery-reminders': { loadDeliveryView: async () => {
      if (source === 'offline') throw Error('offline');
      return { requestStateAvailable: true, nativeRequest: { state: 'linked', status: {
        ref, number: marker, date: new Date().toISOString(), amount: 5000, issued: 5000 - remaining, remaining,
        state: source === 'rejected' ? 'rejected' : remaining === 0 ? 'issued' : remaining === 5000 ? 'payable' : 'partial',
        canCollect: source !== 'rejected' && remaining > 0, cashboxRef, cashbox: cashboxRef === cashA ? 'A' : 'B',
        recipientName: 'Test recipient', desiredDate: null, checkedAt: new Date(Date.now() + 1000).toISOString(),
      } } };
    } } };
    const out = await build({ entryPoints: ['lib/procurement-cash-issue-notifications.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'test', setup(build) { build.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
    const mod = { exports: {} as any }, require = createRequire(import.meta.url);
    new Function('require','module','exports',out.outputFiles[0].text)((name: string) => mocks[name] ?? require(name),mod,mod.exports);
    const queue = () => mod.exports.queueCashIssuePush();
    const rows = () => db.workdayNotification.findMany({ where: { userId: { in: [a.id, b.id] }, kind: CASH_ISSUE_KIND }, orderBy: { id: 'asc' } });
    // A valid payable source alone must not notify an off-shift cashier.
    await queue(); assert.equal((await rows()).length, 0);
    const at = new Date();
    const shiftData = { department:'retail', shiftCode:'09_20', shiftLabel:'09:00–20:00', status:'active', startedAt:new Date(at.getTime()-60_000) };
    await db.workDayEntry.create({data:{...shiftData,userId:a.id,date:getMoscowDateKey(new Date(at.getTime()-86_400_000))}});
    await queue(); assert.equal((await rows()).length, 0, 'yesterday unclosed shift is insufficient');
    const shiftA = await db.workDayEntry.create({data:{...shiftData,userId:a.id,date:getMoscowDateKey(at),startedAt:new Date(at.getTime()+3_600_000)}});
    await queue(); assert.equal((await rows()).length, 0, 'future shift cannot authorize cash issue');
    await db.workDayEntry.update({where:{id:shiftA.id},data:{startedAt:shiftData.startedAt}});
    await db.workDayEntry.create({data:{...shiftData,userId:b.id,date:getMoscowDateKey(at)}});
    await Promise.all([queue(),queue()]);
    let records = await rows(); assert.equal(records.length,1); assert.equal(records[0].userId,a.id);
    const first = records[0];
    await db.workDayEntry.update({where:{id:shiftA.id},data:{status:'completed',endedAt:new Date()}});
    await queue(); records=await rows(); assert.equal(records[0].status,'cancelled');
    assert.equal((await mod.exports.currentCashIssue(new Date(),true)).state,'waiting_shift');
    assert.equal(remaining,5000,'ending shift must not change the financial source');
    assert.equal((await mod.exports.cashIssuePushDecision({userId:a.id,fingerprint:first.fingerprint})).state,'defer');
    await db.workDayEntry.update({where:{id:shiftA.id},data:{status:'active',endedAt:null}});
    await queue(); records=await rows(); assert.equal(records.length,1); assert.equal(records[0].id,first.id); assert.equal(records[0].status,'pending');
    await db.workdayNotification.update({where:{id:first.id},data:{status:'sent',pushStatus:'delivered',readAt:new Date()}});
    remaining = 3000;
    await queue(); records=await rows();assert.equal(records.length,1);assert.equal(records[0].status,'sent');
    assert.equal((await mod.exports.currentCashIssue(new Date(),true)).request.amount,3000);
    source='offline';await queue();assert.equal((await rows())[0].status,'sent');
    source='ready';cashboxRef=cashB;await queue();records=await rows();assert.equal(records.length,2);
    assert.equal(records[0].status,'cancelled');assert.equal(records[1].userId,b.id);assert.equal(records[1].status,'pending');
    cashboxRef=cashA;await queue();records=await rows();assert.equal(records.length,2);assert.equal(records[0].id,first.id);assert.equal(records[0].status,'pending');assert.equal(records[0].readAt,null);assert.equal(records[1].status,'cancelled');
    // A second active mapping blocks routing instead of choosing one arbitrarily.
    await db.userOneCCashboxMapping.update({where:{userId:b.id},data:{oneCCashboxRef:cashA}});
    assert.equal((await mod.exports.currentCashIssue(new Date(),true)).state,'unknown');await queue();assert.equal((await rows()).length,2);
    await db.userOneCCashboxMapping.update({where:{userId:b.id},data:{oneCCashboxRef:cashB}});
    remaining=0;await queue();assert.ok((await rows()).every(r=>r.status==='cancelled'));
    remaining=3000;await queue();records=await rows();assert.equal(records.length,2);assert.equal(records[0].status,'pending');
    source='rejected';await queue();assert.ok((await rows()).every(r=>r.status==='cancelled'));
    // Shared reserve fans out to actual retail cash managers, without duplicate
    // tasks. Leaving the shift revokes access; full issue cancels for everyone.
    source='ready'; cashboxRef=DELIVERY_PHONE_RESERVE_REF; remaining=5000;
    await Promise.all([queue(),queue()]);
    records=await rows();
    const shared=records.filter(r=>r.status!=='cancelled');
    assert.deepEqual(shared.map(r=>r.userId).sort(),[a.id,b.id].sort());
    await queue();assert.equal((await rows()).length,records.length);
    await db.user.update({where:{id:b.id},data:{department:'wholesale'}});
    await queue(); assert.deepEqual((await rows()).filter(r=>r.status!=='cancelled').map(r=>r.userId),[a.id]);
    await db.user.update({where:{id:b.id},data:{department:'retail'}});
    await db.userOneCCashboxMapping.update({where:{userId:b.id},data:{isActive:false}});
    await queue();assert.equal((await rows()).filter(r=>r.status!=='cancelled').length,1);
    await db.userOneCCashboxMapping.update({where:{userId:b.id},data:{isActive:true}});
    await db.workDayEntry.update({where:{id:shiftA.id},data:{status:'completed',endedAt:new Date()}});
    await queue();assert.deepEqual((await rows()).filter(r=>r.status!=='cancelled').map(r=>r.userId),[b.id]);
    assert.equal((await mod.exports.cashIssuePushDecision({userId:a.id,fingerprint:shared.find(r=>r.userId===a.id)!.fingerprint})).state,'cancel');
    await db.workDayEntry.update({where:{id:shiftA.id},data:{status:'active',endedAt:null}});
    await queue();remaining=3000;await queue();
    assert.ok((await mod.exports.currentCashIssue(new Date(),true)).notices.every((n:any)=>n.request.amount===3000));
    remaining=0;await queue();assert.ok((await rows()).every(r=>r.status==='cancelled'));
    assert.equal(await db.workdayNotification.count({where:{userId:{in:[a.id,b.id]},kind:{not:CASH_ISSUE_KIND}}}),0);
  } finally {
    await db.workdayNotification.deleteMany({where:{userId:{in:[a.id,b.id]}}});
    await db.userOneCCashboxMapping.deleteMany({where:{userId:{in:[a.id,b.id]}}});
    await db.user.deleteMany({where:{id:{in:[a.id,b.id]}}});await db.$disconnect();
  }
});
