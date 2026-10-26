import test from 'node:test';
import assert from 'node:assert/strict';

test('isolated notification worker creates current-day question, preserves it after reading and retires it after direct calendar save', {skip:process.env.SCHEDULE_REMINDER_TEST!=='1'},async()=>{
 const url=new URL(process.env.DATABASE_URL!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55471');assert.equal(url.pathname,'/schedule_preview_20261026');
 const {prisma}=await import('../lib/prisma');
 const {dispatchDueWorkdayNotifications}=await import('../lib/workday-notifications');
 const {loadEmployeeAttention}=await import('../lib/employee-attention-snapshot');
 const {getMoscowDateKey}=await import('../lib/workday');
 assert.equal(await prisma.workdayPushSubscription.count(),0,'No device delivery from the test');
 const date=getMoscowDateKey(),now=new Date(`${date}T08:31:00+03:00`);
 const user=await prisma.user.create({data:{login:`schedule-send-proof-${Date.now()}`,name:'Учебный участник',department:'retail',role:'EMPLOYEE',passwordHash:'disabled'}});
 try {
  const key=`schedule-coverage:retail:${date}:${user.id}`;
  await dispatchDueWorkdayNotifications(now);
  let notice=await prisma.workdayNotification.findUniqueOrThrow({where:{fingerprint:key}});
  assert.equal(notice.status,'sent');assert.equal(notice.kind,'schedule_fill_request');
  assert.ok((await loadEmployeeAttention(user)).items.some(i=>i.id===`schedule:${date}`));
  await prisma.workdayNotification.update({where:{id:notice.id},data:{readAt:now}});
  await dispatchDueWorkdayNotifications(new Date(+now+60000));
  assert.equal(await prisma.workdayNotification.count({where:{fingerprint:key}}),1);
  assert.ok((await loadEmployeeAttention(user)).items.some(i=>i.id===`schedule:${date}`));
  await prisma.workScheduleEntry.create({data:{userId:user.id,date,department:'retail',status:'off'}});
  assert.equal((await loadEmployeeAttention(user)).items.some(i=>i.id===`schedule:${date}`),false);
  await dispatchDueWorkdayNotifications(new Date(+now+120000));
  notice=await prisma.workdayNotification.findUniqueOrThrow({where:{fingerprint:key}});
  assert.ok(['answered','resolved'].includes(notice.status));
 } finally {await prisma.user.delete({where:{id:user.id}});await prisma.$disconnect();}
});
