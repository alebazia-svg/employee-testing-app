import assert from 'node:assert/strict';
import test from 'node:test';
import {
  kkmShiftCloseOneCPeriod,
  kkmShiftCloseRequiresEmployeeAction,
  readKkmShiftCloseSimulation,
  simulateKkmShiftClose,
  syncKkmShiftCloseIssue,
} from '../lib/kkm-shift-close-control';

test('1C KKM check period uses an exclusive next-day upper bound', () => {
  assert.deepEqual(kkmShiftCloseOneCPeriod('2026-08-26'), {
    fromDate: '2026-08-26',
    toDate: '2026-08-27',
  });
});

const activatedAt = '2026-08-26T10:00:00.000Z';

test('accepts only a known and dated KKM close simulation', () => {
  assert.deepEqual(readKkmShiftCloseSimulation({ scenario: 'ofd_missing', activatedAt }), { scenario: 'ofd_missing', activatedAt });
  assert.equal(readKkmShiftCloseSimulation({ scenario: 'unknown', activatedAt }), null);
  assert.equal(readKkmShiftCloseSimulation({ scenario: 'confirmed', activatedAt: 'bad-date' }), null);
});

test('delayed simulation confirms only after its propagation delay', () => {
  const simulation = { scenario: 'delayed' as const, activatedAt };
  assert.equal(simulateKkmShiftClose(simulation, new Date('2026-08-26T10:00:44.999Z')).status, 'ofd_missing');
  assert.equal(simulateKkmShiftClose(simulation, new Date('2026-08-26T10:00:45.000Z')).status, 'confirmed');
});

test('failure simulations remain fail-closed and visibly simulated', () => {
  const evidence = simulateKkmShiftClose({ scenario: 'ofd_unavailable', activatedAt }, new Date('2026-08-26T10:02:00.000Z'));
  assert.equal(evidence.status, 'unavailable');
  assert.equal(evidence.simulated, true);
  assert.match(evidence.sourceError, /Dev\/Test/);
});

test('only a proven open shift or missing Z-report requires employee action', () => {
  const base = simulateKkmShiftClose({ scenario: 'ofd_unavailable', activatedAt }, new Date('2026-08-26T10:02:00.000Z'));
  assert.equal(kkmShiftCloseRequiresEmployeeAction(base), false);
  assert.equal(kkmShiftCloseRequiresEmployeeAction({ ...base, status: 'one_c_open' }), true);
  assert.equal(kkmShiftCloseRequiresEmployeeAction({ ...base, status: 'ofd_missing' }), true);
  assert.equal(kkmShiftCloseRequiresEmployeeAction({ ...base, status: 'confirmed' }), false);
});

test('technical KKT uncertainty becomes admin-only and keeps the original incident date', async () => {
  const detectedAt = new Date('2026-09-18T17:35:49.539Z');
  const now = new Date('2026-09-30T15:10:01.742Z');
  const evidence = simulateKkmShiftClose({ scenario: 'ofd_unavailable', activatedAt }, now);
  let issueUpdate: any = null;
  let notificationUpdate: any = null;
  let eventUpdate: any = null;
  const db: any = {
    workdayControlIssue: {
      findUnique: async () => ({ id: 8057, status: 'open', detectedAt }),
      upsert: async ({ update }: any) => {
        issueUpdate = update;
        return { id: 8057, detectedAt };
      },
    },
    workdayNotification: {
      updateMany: async (args: any) => {
        notificationUpdate = args;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async () => ({ name: 'Чеченова Милана' }),
      findMany: async () => [{ id: 1 }],
    },
    adminInboxEvent: {
      upsert: async ({ update }: any) => {
        eventUpdate = update;
        return { id: 'event-1' };
      },
    },
    adminInboxReceipt: { createMany: async () => ({ count: 1 }) },
  };

  await syncKkmShiftCloseIssue(db, {
    userId: 3,
    taskId: 439,
    workDayEntryId: 96,
    date: '2026-09-18',
    evidence,
    now, workdayCompleted:true,
  });

  assert.equal(issueUpdate.employeeActionRequired, false);
  assert.equal(issueUpdate.severity, 'warning');
  assert.deepEqual(notificationUpdate.where, { issueId: 8057, status: 'pending' });
  assert.equal(notificationUpdate.data.status, 'cancelled');
  assert.equal(eventUpdate.occurredAt.toISOString(), detectedAt.toISOString());
});

test('OFD closes the exact fiscal shift even when 1C still reports it open', async () => {
  const { verifyEmployeeKkmShiftClose } = await import('../lib/kkm-shift-close-control');
  const db: any = { userOneCCashboxMapping: { findUnique: async () => ({ oneCCashierRef: 'cashier' }) } };
  const check = { cashier: { ref: 'cashier' }, cashRegisterRef: 'kkm', kktRegistrationNumber: 'kkt', dateTime: '2026-10-25T14:22:00+03:00' };
  const shift = { cashRegister: { ref: 'kkm', name: 'Касса' }, posted: true, deletionMark: false, number: '75', fiscalShiftNumber: '75', openedAt: '2026-10-25T08:48:00+03:00', closedAt: '', status: 'Открыта', datetime: '2026-10-25T08:48:00+03:00' };
  const report = { kktRegistrationNumber: 'kkt', shiftNumber: '75', openedAt: shift.openedAt, closedAt: '2026-10-25T17:52:00+03:00', documentLink: 'report' };
  let reports: any[] = [report], complete = true;
  const sources: any = {
    loadOneCKkmChecks: async () => ({ complete: true, data: [check] }),
    getCashShifts: async () => ({ ok: true, shifts: [shift] }),
    loadPlatformaOfdZReports: async () => ({ complete, data: reports }),
  };
  const verify = () => verifyEmployeeKkmShiftClose({ db, userId: 5, date: '2026-10-25' }, sources);
  const confirmed = await verify();
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.oneCClosedAt, '');
  assert.equal(confirmed.ofdClosedAt, report.closedAt);
  assert.equal(kkmShiftCloseRequiresEmployeeAction(confirmed), false);
  for (const invalid of [{ ...report, shiftNumber: '74' }, { ...report, kktRegistrationNumber: 'other' }, { ...report, closedAt: '2026-10-25T13:00:00+03:00' }, { ...report, closedAt: 'bad' }]) {
    reports = [invalid];
    assert.equal((await verify()).status, 'unavailable');
  }
  reports = [report]; complete = false;
  assert.equal((await verify()).status, 'unavailable');
  complete = true; reports = [];
  assert.equal((await verify()).status, 'unavailable');
  shift.status = 'Закрыта'; shift.closedAt = report.closedAt;
  assert.equal((await verify()).status, 'ofd_missing');
});

test('reopened shift closes by fiscal check time even when the 1C document clock is ahead', async () => {
  const { verifyEmployeeKkmShiftClose } = await import('../lib/kkm-shift-close-control');
  const db: any = { userOneCCashboxMapping: { findUnique: async () => ({ oneCCashierRef: 'cashier' }) } };
  const check = {
    cashier: { ref: 'cashier' }, cashRegisterRef: 'kkm', kktRegistrationNumber: 'kkt',
    dateTime: '2026-10-26T18:33:43+03:00', fiscalDateTime: '2026-10-26T18:26:00+03:00',
  };
  const shift = {
    cashRegister: { ref: 'kkm', name: 'Касса' }, posted: true, deletionMark: false,
    number: '1081', fiscalShiftNumber: '341', status: 'Закрыта',
    datetime: '2026-10-26T18:33:23+03:00', openedAt: '2026-10-26T18:33:23+03:00', closedAt: '2026-10-26T18:34:13+03:00',
  };
  const report = { kktRegistrationNumber: 'kkt', shiftNumber: '341', openedAt: '2026-10-26T18:25:00+03:00', closedAt: '2026-10-26T18:26:00+03:00', documentLink: 'report-341' };
  const previous = { ...report, shiftNumber: '340', openedAt: '2026-10-26T09:02:00+03:00', closedAt: '2026-10-26T18:02:00+03:00', documentLink: 'report-340' };
  let reports = [previous, report];
  const sources: any = {
    loadOneCKkmChecks: async () => ({ complete: true, data: [check] }),
    getCashShifts: async () => ({ ok: true, shifts: [shift, { ...shift, fiscalShiftNumber: '340', closedAt: '2026-10-26T18:09:56+03:00' }] }),
    loadPlatformaOfdZReports: async () => ({ complete: true, data: reports }),
  };
  const verify = () => verifyEmployeeKkmShiftClose({ db, userId: 4, date: '2026-10-26' }, sources);
  const evidence = await verify();
  assert.equal(evidence.status, 'confirmed');
  assert.equal(evidence.fiscalShiftNumber, '341');
  assert.equal(evidence.ofdDocumentLink, 'report-341');
  // First closure, another KKT, and closure before the fiscal check remain insufficient.
  for (const invalid of [previous, { ...report, kktRegistrationNumber: 'other' }, { ...report, closedAt: '2026-10-26T18:25:00+03:00' }]) {
    reports = [invalid];
    assert.equal((await verify()).status, 'ofd_missing');
  }
  reports = [report];
  // Without a fiscal timestamp retain the conservative document-time check.
  check.fiscalDateTime = '';
  assert.equal((await verify()).status, 'ofd_missing');
});

 test('Milana: fiscal closure at 21:06 is authoritative while the 1C shift number is not yet filled', async()=>{
 const {verifyEmployeeKkmShiftClose}=await import('../lib/kkm-shift-close-control');
 const db:any={userOneCCashboxMapping:{findUnique:async()=>({oneCCashierRef:'cashier'})}};
 const check={cashier:{ref:'cashier'},cashRegisterRef:'kkm',kktRegistrationNumber:'0010475338013250',dateTime:'2026-10-26T21:05:00+03:00',fiscalDateTime:'2026-10-26T21:05:00+03:00',fiscalDriveNumber:'7384441001649597',fiscalDocumentNumber:'123',fiscalSign:'456'};
 const report={kktRegistrationNumber:check.kktRegistrationNumber,fiscalDriveNumber:check.fiscalDriveNumber,shiftNumber:'76',openedAt:'2026-10-26T10:45:00+03:00',closedAt:'2026-10-26T21:06:00+03:00',documentLink:'report-76'};
 let shifts:any={ok:true,shifts:[{cashRegister:{ref:'kkm',name:'Касса'},posted:true,deletionMark:false,number:'1080',fiscalShiftNumber:'',status:'Открыта',datetime:'2026-10-26T10:56:20+03:00',openedAt:'2026-10-26T10:56:20+03:00',closedAt:''}]};
 let reports=[report];
 let checks:any[]=[check];
 const sources:any={loadOneCKkmChecks:async()=>({complete:true,data:checks}),getCashShifts:async()=>shifts,loadPlatformaOfdZReports:async()=>({complete:true,data:reports})};
 const verify=()=>verifyEmployeeKkmShiftClose({db,userId:3,date:'2026-10-26'},sources);
 assert.equal((await verify()).status,'confirmed');assert.equal((await verify()).fiscalShiftNumber,'76');
 shifts={ok:false,shifts:[]};assert.equal((await verify()).status,'confirmed','1C shift endpoint is not required for exact fiscal proof');
 for(const invalid of [{...report,fiscalDriveNumber:'other'},{...report,kktRegistrationNumber:'other'},{...report,openedAt:'2026-10-26T21:05:01+03:00'},{...report,closedAt:'2026-10-26T21:04:00+03:00'}]){reports=[invalid];assert.equal((await verify()).status,'unavailable');}
 reports=[report,{...report,shiftNumber:'77'}];assert.equal((await verify()).status,'unavailable','ambiguous intervals cannot confirm closure');
 reports=[report];
 checks=[check,{...check,cashier:{ref:'other-cashier'},fiscalDateTime:'2026-10-26T21:07:00+03:00'}];assert.equal((await verify()).status,'unavailable','later check by another cashier on the same KKT invalidates the old closure');checks=[check];
 shifts={ok:true,shifts:[{cashRegister:{ref:'kkm',name:'Касса'},posted:true,deletionMark:false,number:'1081',fiscalShiftNumber:'77',status:'Открыта',datetime:'2026-10-26T21:10:00+03:00',openedAt:'2026-10-26T21:10:00+03:00',closedAt:''}]};assert.equal((await verify()).status,'confirmed','a later 1C document timestamp cannot override exact OFD proof; actual later fiscal checks remain the guard');
 shifts={ok:false,shifts:[]};check.fiscalDateTime='';assert.equal((await verify()).status,'unavailable');
 });

import { createKkmCloseConfirmation, kkmCloseConfirmation } from '../lib/kkm-close-confirmation';
test('photo confirmation requires the actual uploaded image of this task and cannot reuse another task photo',()=>{
 const data={photos:{zReport:{storagePath:'uploads/shift-control/117/508/z-report-demo.jpg',mimeType:'image/jpeg',sizeBytes:100}}};
 const confirmed=createKkmCloseConfirmation(data,4,117,508,new Date('2026-10-26T18:00:00Z'))!;
 assert.ok(confirmed);assert.equal(createKkmCloseConfirmation(data,4,117,509),null);
 assert.equal(kkmCloseConfirmation({...data,kkmCloseConfirmation:confirmed})?.userId,4);
 assert.equal(kkmCloseConfirmation({...data,kkmCloseConfirmation:{...confirmed,storagePath:'uploads/shift-control/117/508/z-report-other.jpg'}}),null);
 assert.equal(createKkmCloseConfirmation({photos:{zReport:{...data.photos.zReport,sizeBytes:0}}},4,117,508),null);
 assert.equal(kkmCloseConfirmation({photos:{zReport:data.photos.zReport}}),null,'upload alone is not an employee confirmation');
});
test('a photo removes only the KKM employee blocker and keeps automatic source verification pending for ADMIN',async()=>{
 let update:any,notification:any;const db:any={workdayControlIssue:{findUnique:async()=>({id:42,status:'open',detectedAt:new Date()}),upsert:async(args:any)=>{update=args.update;return{id:42,detectedAt:new Date()}}},workdayNotification:{updateMany:async(args:any)=>{notification=args;return{count:1}}},user:{findUnique:async()=>({name:'Учебный сотрудник'}),findMany:async()=>[]},adminInboxEvent:{upsert:async()=>({id:'event'})}};
 const evidence=simulateKkmShiftClose({scenario:'ofd_missing',activatedAt},new Date());
 await syncKkmShiftCloseIssue(db,{userId:4,taskId:508,workDayEntryId:117,date:'2026-10-26',evidence,now:new Date(),confirmationMethod:'photo'});
 assert.equal(update.status,'open');assert.equal(update.employeeActionRequired,false);assert.equal(update.severity,'warning');assert.equal(update.sourceData.status,'ofd_missing');assert.equal(update.sourceData.confirmationMethod,'photo');assert.equal(notification.where.issueId,42);assert.equal(notification.data.status,'cancelled');
 // Subsequent failed source reads must keep the employee free of the same blocker.
 await syncKkmShiftCloseIssue(db,{userId:4,taskId:508,workDayEntryId:117,date:'2026-10-26',evidence:{...evidence,status:'one_c_open'},now:new Date(),confirmationMethod:'photo'});
 assert.equal(update.employeeActionRequired,false);
});

test('no printed receipt is an explicit employee response, distinct from a photo and from OFD proof',()=>{
 const confirmation=createKkmCloseConfirmation({},4,117,508,new Date('2026-10-26T18:00:00Z'),'not_printed')!;
 assert.ok(confirmation);assert.equal(kkmCloseConfirmation({kkmCloseConfirmation:confirmation})?.method,'not_printed');
 assert.equal(createKkmCloseConfirmation({},4,117,508),null,'photo still requires an uploaded image');
 assert.equal(kkmCloseConfirmation({kkmCloseConfirmation:{...confirmation,userId:0}}),null);
});
test('one KKM reminder is due after fifteen minutes, and neither a response nor a finished day repeats it',async()=>{
 const started=new Date('2026-10-26T18:00:00Z'),now=new Date('2026-10-26T18:15:00Z');
 let existing:any={id:42,status:'open',detectedAt:started,nextReminderAt:now};let active=true;const reminders=new Map<string,unknown>();
 const db:any={workdayControlIssue:{findUnique:async()=>existing,upsert:async(args:any)=>{existing={...existing,...args.update};return existing;},update:async({data}:any)=>{existing={...existing,...data};return existing;}},workdayNotification:{upsert:async({where,create}:any)=>{reminders.set(where.fingerprint,create);return create;},updateMany:async()=>({count:1})},workDayEntry:{findUnique:async()=>({status:active?'active':'completed',endedAt:active?null:now})},user:{findUnique:async()=>({name:'Учебный сотрудник'}),findMany:async()=>[]},adminInboxEvent:{upsert:async()=>({id:'event'})}};
 const evidence=simulateKkmShiftClose({scenario:'ofd_missing',activatedAt},now);
 const input={userId:4,taskId:508,workDayEntryId:117,date:'2026-10-26',evidence,now};
 existing.nextReminderAt=new Date(+now+1);await syncKkmShiftCloseIssue(db,input);assert.equal(reminders.size,0);
 existing.nextReminderAt=now;await syncKkmShiftCloseIssue(db,input);assert.equal(reminders.size,1);await syncKkmShiftCloseIssue(db,input);assert.equal(reminders.size,1);
 await syncKkmShiftCloseIssue(db,{...input,confirmationMethod:'not_printed'});assert.equal(existing.employeeActionRequired,false);assert.equal(existing.nextReminderAt,null);
 active=false;await syncKkmShiftCloseIssue(db,{...input,workdayCompleted:true});assert.equal(existing.employeeActionRequired,false);assert.equal(reminders.size,1);
});
