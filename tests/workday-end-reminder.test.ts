import assert from 'node:assert/strict';
import test from 'node:test';
import { attendanceWorkdayDefinition, needsWorkdayEndReminder, validateReportedWorkdayEnd, toMoscowDateTimeInput, workdayEndReminderAt, workdayEndReminderActive } from '../lib/workday-end-policy';
import { activeWorkdayEndReminders, queueWorkdayEndReminders, workdayEndReminderDelivery } from '../lib/workday-end-notifications';
import { parseWorkdayQrDepartment } from '../lib/workday-qr';
const now = new Date('2026-10-27T15:00:00Z');
const buyer = { department: 'procurement', name: 'Закупщик', login: 'buyer', isActive: true };
const day = { id: 7, userId: 1, date: '2026-10-27', status: 'active', endedAt: null as Date | null, shiftEndMinutes: 1080, user: buyer };

test('reminder scope includes buyers and Diana, excludes ordinary retail, wholesale and operations', () => {
  assert.equal(needsWorkdayEndReminder(buyer), true);
  assert.equal(needsWorkdayEndReminder({ department:'retail', name:'Кумахова Диана' }), true);
  assert.equal(needsWorkdayEndReminder({ department:'retail', login:'kumakhova' }), true);
  for (const department of ['retail','wholesale','operations']) assert.equal(needsWorkdayEndReminder({department,name:'Другой сотрудник'}), false);
});
test('attendance reminder is fixed at 18:00 Moscow and does not require selecting a shift', () => {
  assert.deepEqual(attendanceWorkdayDefinition,{code:'other',label:'Рабочий день',startMinutes:null,endMinutes:null});
  assert.equal(workdayEndReminderAt(day)?.toISOString(), now.toISOString());
  assert.equal(workdayEndReminderAt({...day,shiftEndMinutes:null})?.toISOString(),now.toISOString());
  assert.equal(workdayEndReminderAt({...day,shiftEndMinutes:1200})?.toISOString(),now.toISOString());
});
test('finished, disabled and old workdays do not retain active end reminders', () => {
  assert.equal(workdayEndReminderActive(day,now),true);
  assert.equal(workdayEndReminderActive({...day,endedAt:now},now),false);
  assert.equal(workdayEndReminderActive({...day,date:'2026-10-26'},now),false);
  assert.equal(workdayEndReminderActive({...day,user:{...buyer,isActive:false}},now),false);
});
test('reported time is required, strict, after start and not in future; timezone is Moscow', () => {
  const started = '2026-10-26T06:00:00Z';
  for (const value of ['',null,'2026-10-26T18:00Z','2026-02-30T18:00','2026-10-26T08:59','2026-10-27T18:01']) assert.equal(validateReportedWorkdayEnd(value,started,now).ok,false,String(value));
  const result=validateReportedWorkdayEnd('2026-10-26T18:17',started,now);
  assert.ok(result.ok);
  assert.equal(result.endedAt.toISOString(),'2026-10-26T15:17:00.000Z');
  assert.equal(toMoscowDateTimeInput(result.endedAt),'2026-10-26T18:17');
  assert.ok(validateReportedWorkdayEnd('2026-10-27T01:10','2026-10-26T18:00:00Z',now).ok,'overnight work is supported');
});
test('procurement QR has its own exact payload; other payloads remain rejected', () => {
  assert.equal(parseWorkdayQrDepartment('offonika-workday-start:procurement'),'procurement');
  assert.equal(parseWorkdayQrDepartment('offonika-workday-start:retail'),'retail');
  assert.equal(parseWorkdayQrDepartment('offonika-workday-start:operations'),null);
});
function fakeDb(initialDays = [day]) {
  const notices = new Map<string, any>();
  const db = {
    workDayEntry: { findMany: async () => initialDays, findUnique: async () => initialDays[0] ?? null },
    workdayNotification: {
      upsert: async ({where,create}:any) => { if(!notices.has(where.fingerprint)) notices.set(where.fingerprint,{...create,id:1,status:'pending'}); },
      updateMany: async ({where,data}:any) => { const row=notices.get(where.fingerprint); if(row && row.status===where.status) Object.assign(row,data); },
    },
  };
  return {db:db as any, notices};
}
test('producer queues three bounded notices per workday and does not replay a delivered reminder', async () => {
  const {db,notices}=fakeDb();
  await queueWorkdayEndReminders(db,now);await queueWorkdayEndReminders(db,now);
  assert.equal(notices.size,3);
  assert.equal(notices.get('workday-end:7:1').scheduledAt.toISOString(),'2026-10-27T15:30:00.000Z');
  assert.equal(notices.get('workday-end:7:2').scheduledAt.toISOString(),'2026-10-27T16:00:00.000Z');
  const notice=notices.get('workday-end:7');assert.equal(notice.scheduledAt.toISOString(),now.toISOString());
  notice.status='sent';notice.pushStatus='delivered';await queueWorkdayEndReminders(db,now);
  assert.equal(notice.status,'sent');assert.equal(notice.pushStatus,'delivered');
  assert.ok((await activeWorkdayEndReminders(db,[notice],now)).has(1));
  assert.equal((await activeWorkdayEndReminders(db,[{...notice,userId:99}],now)).size,0);
});
test('delivery rechecks actual workday and waits until 18:00', async () => {
  const {db}=fakeDb();const notice={userId:1,fingerprint:'workday-end:7'};
  assert.equal((await workdayEndReminderDelivery(db,notice,now)).state,'send');
  assert.equal((await workdayEndReminderDelivery(db,{...notice,userId:99},now)).state,'cancel');
  const extended=fakeDb([{...day,shiftEndMinutes:1200}]);
  const result=await workdayEndReminderDelivery(extended.db,notice,new Date('2026-10-27T14:59:00Z'));assert.equal(result.state,'defer');
  const closed=fakeDb([{...day,endedAt:now}]);
  assert.equal((await workdayEndReminderDelivery(closed.db,notice,now)).state,'cancel');
});

 test('printable procurement poster decodes to its own QR payload', async () => {
  const {default:sharp}=await import('sharp'); const {default:jsQR}=await import('jsqr');
  const {data,info}=await sharp('public/print/portal-workday-procurement-a5.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(jsQR(new Uint8ClampedArray(data),info.width,info.height)?.data,'offonika-workday-start:procurement');
});

test('late dispatch never sends missed reminder slots in a burst; closure cancels all slots',async()=>{
 const {db}=fakeDb(); const later=new Date('2026-10-27T15:45:00Z');
 assert.equal((await workdayEndReminderDelivery(db,{userId:1,fingerprint:'workday-end:7'},later)).state,'cancel');
 assert.equal((await workdayEndReminderDelivery(db,{userId:1,fingerprint:'workday-end:7:1'},later)).state,'send');
 assert.equal((await workdayEndReminderDelivery(db,{userId:1,fingerprint:'workday-end:7:2'},later)).state,'defer');
 const closed=fakeDb([{...day,endedAt:later}]);
 for(const fingerprint of ['workday-end:7','workday-end:7:1','workday-end:7:2'])assert.equal((await workdayEndReminderDelivery(closed.db,{userId:1,fingerprint},later)).state,'cancel');
 assert.equal((await workdayEndReminderDelivery(db,{userId:1,fingerprint:'workday-end:7:3'},later)).state,'cancel');
});
