import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {acknowledgeEmployeeNotification,employeeInboxSections,isNewEmployeeNotification} from '../lib/employee-inbox-view';
import {selectAdminAttention} from '../lib/admin-inbox-attention-policy';

const row={id:1,kind:'procurement_payment_approved',active:true,readAt:null,sentAt:'2026-10-22T09:00:00Z'};
test('39 returned records do not mean 39 new notifications',()=>{
 const rows=[row,{...row,id:2},...Array.from({length:20},(_,i)=>({...row,id:3+i,readAt:'2026-10-22T10:00:00Z'})),...Array.from({length:17},(_,i)=>({...row,id:23+i,active:false}))];
 const result=employeeInboxSections(rows);
 assert.equal(rows.length,39);assert.equal(result.fresh.length,2);assert.equal(result.history.length,37);
 assert.equal(result.fresh.length,rows.filter(isNewEmployeeNotification).length);
 assert.equal(new Set([...result.fresh,...result.history].map(n=>n.id)).size,39);
});
test('reading retains history, does not modify active/business state, and cannot revive on refresh',()=>{
 const old=[row];const read=acknowledgeEmployeeNotification(old,row,'2026-10-22T10:00:00Z');
 assert.equal(old[0].readAt,null);assert.equal(read[0].active,true);
 assert.equal(employeeInboxSections(read).fresh.length,0);assert.equal(employeeInboxSections(read).history.length,1);
 assert.equal(employeeInboxSections(JSON.parse(JSON.stringify(read))).fresh.length,0);
});
test('only the acknowledged thread up to the opened event is read',()=>{
 const opened={...row,taskId:7};
 const rows=[{...opened,id:2,sentAt:'2026-10-22T08:00:00Z'},opened,{...opened,id:3,sentAt:'2026-10-22T11:00:00Z'},{...row,id:4,taskId:8}];
 const read=acknowledgeEmployeeNotification(rows,opened,'2026-10-22T10:00:00Z');
 assert.deepEqual(read.filter(n=>n.readAt).map(n=>n.id),[2,1]);
 assert.deepEqual(employeeInboxSections(read).fresh.map(n=>n.id),[3,4]);
});
test('reading one procurement decision does not read a different supplier notification',()=>{
 const result=acknowledgeEmployeeNotification([row,{...row,id:2}],row,'now');
 assert.equal(result[1].readAt,null);
});
test('inactive unread belongs only to history; empty inbox stays empty',()=>{
 assert.equal(isNewEmployeeNotification({...row,active:false}),false);
 assert.deepEqual(employeeInboxSections([]),{fresh:[],history:[]});
});
test('ADMIN reading does not clear an unresolved decision or its count',()=>{
 const item={id:'a',readAt:null,event:{type:'expense_request.created',sourceType:'expense_request',sourceId:'a',occurredAt:row.sentAt},meta:{category:'requests'},sourceState:{active:true}};
 assert.equal(selectAdminAttention([item]).length,1);
 assert.equal(selectAdminAttention([{...item,readAt:'2026-10-22T10:00:00Z'}]).length,1);
 assert.equal(selectAdminAttention([{...item,sourceState:{active:false}}]).length,0);
});
test('both employee clients use acknowledged read, filtered badge and shared inbox',()=>{
 for(const file of ['components/ProcurementNotificationsButton.tsx','app/(dashboard)/employee/WorkdayNotificationsClient.tsx']){
  const source=readFileSync(file,'utf8');
  assert.match(source,/filter\(isNewEmployeeNotification\)/);
  assert.match(source,/acknowledgeEmployeeNotification\(current/);
  assert.match(source,/if\s*\(!response\?\.ok\)/);
  assert.ok(source.indexOf('failedRead.current=')<source.indexOf('acknowledgeEmployeeNotification(current'));
  assert.match(source,/<EmployeeNotificationInbox/);
  assert.doesNotMatch(source,/syncPwaAppBadge\((nextItems|nextNotifications|next)\.length\)/);
 }
});
test('ADMIN history is isolated from attention badge; details preserve source routing',()=>{
 const source=readFileSync('components/AdminInboxBell.tsx','utf8');
 const history=source.slice(source.indexOf('async function loadHistory'),source.indexOf('function changeView'));
 assert.match(history,/view=history/);assert.doesNotMatch(history,/syncPwaAppBadge|setUnreadCount/);
 assert.match(source,/Number\(payload.attentionCount\)/);
 assert.match(source,/sourceType:item.event.sourceType/);
});
