import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../lib/prisma';
import { writeEmployeeActivity } from '../lib/employee-activity';
import { employeeActivityReport } from '../lib/employee-activity-report';
import { managerActivity } from '../lib/employee-activity-presentation';
import { parseActivityInput } from '../lib/employee-activity-policy';
if(process.env.DATABASE_URL!=='postgresql://activity:local-activity-review-only@127.0.0.1:55508/activity_live_review')throw Error('Isolated activity review DB only');
const users:number[]=[];
async function fixture(){
 const user=await prisma.user.create({data:{login:'receipt-'+crypto.randomUUID(),name:'Receipt test only',role:'EMPLOYEE',department:'procurement',passwordHash:'not-a-login'}});users.push(user.id);
 const session=await prisma.portalAccessSession.create({data:{userId:user.id,sessionHash:crypto.randomUUID(),device:'iPhone',browser:'Safari',browserInstanceId:crypto.randomUUID(),expiresAt:new Date(Date.now()+86400000)}});
 const notification=await prisma.workdayNotification.create({data:{userId:user.id,fingerprint:'receipt-test-'+user.id,kind:'workday_closed_by_admin',title:'Receipt test',body:'Local only',sentAt:new Date(),scheduledAt:new Date()}});
 const connect=async()=>{const sub=await prisma.workdayPushSubscription.create({data:{userId:user.id,endpoint:'https://local.invalid/receipt/'+user.id,p256dh:'test',auth:'test'}});await prisma.portalAccessSession.update({where:{id:session.id},data:{pushSubscriptionId:sub.id}});return sub;};
 return {user,session,notification,connect};
}
test('receipts require an owned notification and active subscription bound to this exact session',async()=>{
 const a=await fixture(),b=await fixture();const input={kind:'push_receipt' as const,key:'receipt-owned-123',notificationId:a.notification.id,stage:'received' as const};
 assert.equal(await writeEmployeeActivity(a.user.id,a.session.sessionHash,input),false);
 const sub=await a.connect();assert.equal(await writeEmployeeActivity(a.user.id,a.session.sessionHash,input),true);assert.equal(await writeEmployeeActivity(a.user.id,a.session.sessionHash,input),true);
 assert.equal(await prisma.portalActivityEvent.count({where:{userId:a.user.id,kind:'push_receipt'}}),1);
 assert.equal(await writeEmployeeActivity(a.user.id,a.session.sessionHash,{...input,key:'foreign-notice-123',notificationId:b.notification.id}),false);
 const other=await prisma.portalAccessSession.create({data:{userId:a.user.id,sessionHash:crypto.randomUUID(),device:'Mac',browser:'Chrome',expiresAt:new Date(Date.now()+86400000)}});
 assert.equal(await writeEmployeeActivity(a.user.id,other.sessionHash,{...input,key:'other-browser-123'}),false);
 await prisma.workdayPushSubscription.update({where:{id:sub.id},data:{disabledAt:new Date()}});assert.equal(await writeEmployeeActivity(a.user.id,a.session.sessionHash,{...input,key:'disabled-receipt-123'}),false);
});
test('receipt persistence and report do not acknowledge, mark read, alter notification or invent an in-app opening',async()=>{
 const f=await fixture();await f.connect();const before=await prisma.workdayNotification.findUnique({where:{id:f.notification.id}});
 assert.equal(await writeEmployeeActivity(f.user.id,f.session.sessionHash,{kind:'push_receipt',key:'receipt-click-123',notificationId:f.notification.id,stage:'clicked'}),true);
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow'}).format(new Date());const report=await employeeActivityReport(f.user.id,date);const row=managerActivity(report).rows[0];
 assert.equal(row.openings.length,0);assert.equal(row.push.label,'Есть нажатие на push');assert.equal(row.push.source?.id,f.session.id);assert.equal(row.item.confirmed,false);
 assert.deepEqual(await prisma.workdayNotification.findUnique({where:{id:f.notification.id}}),before);
 assert.doesNotMatch(JSON.stringify(report),/sessionHash|p256dh|passwordHash/);
});
test('same-time events of different sessions survive deduplication while repeats on one session remain bounded',async()=>{
 const f=await fixture(),now=new Date();const other=await prisma.portalAccessSession.create({data:{userId:f.user.id,sessionHash:crypto.randomUUID(),device:'Mac',browser:'Chrome',expiresAt:new Date(Date.now()+86400000)}});
 const visit={kind:'visit' as const,key:'visit-first-123',section:'schedule' as const};
 assert.equal(await writeEmployeeActivity(f.user.id,f.session.sessionHash,visit,now),true);assert.equal(await writeEmployeeActivity(f.user.id,other.sessionHash,{...visit,key:'visit-other-123'},now),true);
 assert.equal(await writeEmployeeActivity(f.user.id,f.session.sessionHash,{...visit,key:'visit-repeat-123'},now),true);assert.equal(await prisma.portalActivityEvent.count({where:{userId:f.user.id,kind:'visit'}}),2);
 const interaction={kind:'interaction' as const,key:'shown-first-123',context:{target:'notification' as const,ref:String(f.notification.id),stage:'shown' as const}};
 assert.equal(await writeEmployeeActivity(f.user.id,f.session.sessionHash,interaction,now),true);assert.equal(await writeEmployeeActivity(f.user.id,other.sessionHash,{...interaction,key:'shown-other-123'},now),true);
 assert.equal(await writeEmployeeActivity(f.user.id,f.session.sessionHash,{...interaction,key:'shown-repeat-123'},now),true);assert.equal(await prisma.portalActivityEvent.count({where:{userId:f.user.id,kind:'interaction'}}),2);
});
test('receipt vocabulary is strict and does not admit arbitrary data or claimed reading',()=>{
 const input={kind:'push_receipt',key:'receipt-parse-123',notificationId:1,stage:'received'};assert.ok(parseActivityInput(input));
 for(const patch of [{stage:'read'},{stage:'delivered_to_os'},{notificationId:0},{notificationId:'1'},{body:'sensitive'},{device:'guessed'}])assert.equal(parseActivityInput({...input,...patch}),null);
});
after(async()=>{await prisma.user.deleteMany({where:{id:{in:users}}});await prisma.$disconnect();});
