import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import webpush from 'web-push';
import { prisma } from '../lib/prisma';
import { DELIVERY_PERSON } from '../lib/procurement-delivery-policy';

test('isolated database: real expense/buyer producers, two push devices, completion, planned dates and shift history', { skip: process.env.ATTENTION_INTEGRATION !== '1' }, async () => {
  assert.ok(process.env.DATABASE_URL?.endsWith('@127.0.0.1:55448/admin_attention_20261012_test'));
  assert.equal(await prisma.user.count({where:{oneCManagerName:DELIVERY_PERSON.name}}),0);
  const prefix=`relevance-${Date.now()}`;
  const admin=await prisma.user.create({data:{name:prefix,login:prefix,passwordHash:'unused',role:'ADMIN'}});
  const buyer=await prisma.user.create({data:{name:'Астемир',login:`${prefix}-buyer`,passwordHash:'unused',role:'EMPLOYEE',portalArea:'PROCUREMENT',oneCManagerName:DELIVERY_PERSON.name}});
  const originalSend=webpush.sendNotification, originalConfigure=webpush.setVapidDetails;
  const saved=[process.env.WEB_PUSH_VAPID_PUBLIC_KEY,process.env.WEB_PUSH_VAPID_PRIVATE_KEY];
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY='test'; process.env.WEB_PUSH_VAPID_PRIVATE_KEY='test';
  webpush.setVapidDetails=()=>undefined;
  const sent:any[]=[];
  webpush.sendNotification=async(sub,payload)=>{sent.push({endpoint:sub.endpoint,...JSON.parse(String(payload))});return {statusCode:201,body:'',headers:{}};};
  let now=new Date('2026-10-12T09:00:00Z');
  let native:any={state:'unlinked'};
  const mocks:Record<string,any>={'./admin-inbox-source-health':{expenseSyncLastSuccess:async()=>now,sourceCheckIsStale:(at:Date,clock:Date)=>+clock-+at>=60*60000},
    './prisma':{prisma}, '@/lib/prisma':{prisma},
    './procurement-delivery-source':{fetchDeliveryCash:async()=>({balance:2000,checkedAt:new Date().toISOString(),lastIssue:null}),unavailableDeliveryCash:()=>({balance:null,checkedAt:'',lastIssue:null})},
    './procurement-delivery-native-source':{loadDeliveryNative:async()=>native.state==='linked'?{...native,status:{...native.status,checkedAt:now.toISOString()}}:native},
  };
  try {
    const out=await build({stdin:{contents:"export {loadAdminInbox} from './lib/admin-inbox-data'; export {dispatchAdminInboxWebPush} from './lib/admin-inbox-web-push'; export {syncDeliveryReminder} from './lib/procurement-delivery-reminders'; export {syncExpenseRequestAdminAudit} from './lib/expense-request-admin-sync';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
    const mod={exports:{} as any};const require=createRequire(import.meta.url);
    new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
    const api=mod.exports;
    const inbox=()=>api.loadAdminInbox({userId:admin.id,limit:100,view:'attention',now});
    const dispatch=()=>api.dispatchAdminInboxWebPush(now);
    for(const device of ['phone','computer']) await prisma.workdayPushSubscription.create({data:{userId:admin.id,endpoint:`https://test.invalid/${prefix}/${device}`,p256dh:'test',auth:'test',createdAt:new Date('2026-10-01')}});
    const ref=`${prefix}-expense`;
    const source:any={ref,posted:true,deletion_mark:false,number:'TEST',date:now.toISOString(),amount:1000,status:{key:'not_approved',name:'Не согласована'},requested_by:{ref:'test-manager',name:'Менеджер'},comment:'Тест',completeness:{complete:true},supporting_documents:{complete:true,rows:[]},attached_files:{complete:true,rows:[]},execution:{complete:true,state:'not_executed'}};
    await api.syncExpenseRequestAdminAudit({snapshot:{rows:[source],complete:true,checkedAt:now.toISOString(),pageCount:1,errors:[]},from:now,to:now,now,baseline:false,queueTelegramDelivery:false,db:prisma});
    assert.equal((await inbox()).attentionCount,1,'actual sync creates an owner task');
    assert.equal((await dispatch()).sent,2,'new 1C request reaches both devices');
    assert.ok(sent[0].title.includes('Менеджер') && sent[0].title.includes('1 000 ₽'));
    assert.ok(sent[0].body.includes('Тест'));
    const expenseCase = await prisma.expenseRequestAdminCase.findUniqueOrThrow({where:{oneCRequestRef:ref}});
    assert.equal(sent[0].url,`/admin/expense-requests/${expenseCase.id}`);
    source.amount=1200; source.comment='Уточнённое назначение';
    await api.syncExpenseRequestAdminAudit({snapshot:{rows:[source],complete:true,checkedAt:now.toISOString(),pageCount:1,errors:[]},from:now,to:now,now,queueTelegramDelivery:false,db:prisma});
    await prisma.adminInboxReceipt.updateMany({where:{userId:admin.id},data:{readAt:now}});
    now=new Date(+now+15*60000);assert.equal((await dispatch()).sent,2,'reading does not stop the reminder');
    assert.ok(sent.at(-1).title.includes('1 200 ₽') && sent.at(-1).body.includes('Уточнённое назначение'),'repeat uses current data, not historical event body');
    source.status={key:'payable',name:'К оплате'};
    await api.syncExpenseRequestAdminAudit({snapshot:{rows:[source],complete:true,checkedAt:now.toISOString(),pageCount:1,errors:[]},from:now,to:now,now,queueTelegramDelivery:false,db:prisma});
    assert.equal((await inbox()).attentionCount,0,'payable source stops owner approval reminders');
    now=new Date(+now+60*60000);assert.equal((await dispatch()).sent,0);

    await api.syncDeliveryReminder(true,{amount:5000,comment:'Две доставки'});
    assert.equal((await inbox()).attentionCount,1,'actual buyer request creates exactly one task');
    assert.equal((await dispatch()).sent,2,'buyer request reaches both devices');
    assert.ok(sent.at(-1).title.includes('Астемир') && sent.at(-1).title.includes('5 000 ₽'));
    assert.ok(sent.at(-1).url.startsWith('/admin/expense-requests?deliveryRequest='));
    now=new Date(+now+14*60000);assert.equal((await dispatch()).sent,0);
    now=new Date(+now+60000);assert.equal((await dispatch()).sent,2,'unresolved buyer request reminds after 15 minutes');
    native={state:'linked',status:{ref:'11111111-2222-3333-4444-555555555555',state:'payable',amount:5000,issued:0,remaining:5000,cashbox:'Учебная касса',canCollect:true}};
    assert.equal((await inbox()).attentionCount,0,'owner decision is complete while cashier still owes issue');
    now=new Date(+now+60*60000);assert.equal((await dispatch()).sent,0);
    const payable=native; native={state:'unavailable'};
    assert.equal((await inbox()).attentionCount,0,'unavailable evidence must not invent a new funding decision');
    assert.equal((await dispatch()).sent,0,'source outage cannot push a repeat funding request');
    assert.ok((await api.loadAdminInbox({userId:admin.id,limit:100,view:'system',now})).items.some((i:any)=>i.event.title==='Не удалось проверить выдачу денег'));
    native=payable;
    native.status.state='waiting';native.status.canCollect=false;
    assert.equal((await inbox()).attentionCount,1,'revoked approval returns to owner attention');
    native.status.state='issued';native.status.issued=5000;native.status.remaining=0;
    assert.equal((await inbox()).attentionCount,0,'full native issue removes the task');
    native={state:'unavailable'};
    now=new Date(+now+60*60000);
    assert.equal((await dispatch()).sent,0,'paid request cannot return during a later read failure');
    native={...payable,status:{...payable.status,state:'issued',issued:5000,remaining:0}};
    assert.ok(sent.every(x=>x.notificationId===`attention-${admin.id}`),'all repeats replace the same card');

    const plan=await prisma.supplierPaymentPlan.create({data:{managerUserId:buyer.id,planCode:prefix,supplierPartner:'Плановая оплата',orderRefs:[],orderNumbers:[],plannedDate:new Date('2026-10-14'),plannedAmount:1000,condition:'',paymentMethod:'CASH'}});
    assert.equal((await inbox()).attentionCount,0,'future plan does not crowd out urgent work');
    assert.equal((await dispatch()).sent,0,'future plan produces no push');
    now=new Date('2026-10-13T06:00:00Z');
    assert.equal((await inbox()).attention[0].event.title,'Оплата завтра · Плановая оплата');
    assert.equal((await dispatch()).sent,2,'one day before payment both devices are reminded');
    now=new Date(+now+15*60000);assert.equal((await dispatch()).sent,0);
    now=new Date(+now+60*60000);assert.equal((await dispatch()).sent,0,'no hourly reminders for plans alone');
    now=new Date('2026-10-14T06:00:00Z');assert.equal((await dispatch()).sent,2,'next-day reminder remains until decision');
    await prisma.supplierPaymentPlan.update({where:{id:plan.id},data:{status:'APPROVED',oneCCashEvidence:{pendingRevision:{id:'move-later',submittedAt:now.toISOString(),data:{plannedDate:'2026-10-20',plannedAmount:1000},changes:[]}}}});
    assert.equal((await inbox()).attentionCount,1,'unapproved postponement cannot conceal an existing due date');
    await prisma.supplierPaymentPlan.update({where:{id:plan.id},data:{oneCCashEvidence:{}}});
    assert.equal((await inbox()).attentionCount,0);

    now=new Date('2026-10-14T19:30:00Z');
    for(const [date,status] of [['2026-10-13','pending'],['2026-10-14','approved']]) {
      const day=await prisma.workDayEntry.create({data:{userId:buyer.id,date,department:'Тест',shiftCode:'test',shiftLabel:'Тест'}});
      const exception=await prisma.workdayCloseExceptionRequest.create({data:{employeeId:buyer.id,workDayEntryId:day.id,status,reasonCode:'cash_encashment_not_possible',comment:'Тест',issueIds:[]}});
      await prisma.adminInboxEvent.create({data:{eventKey:`${prefix}:${date}`,type:'workday.cash_encashment_exception_requested',sourceType:'workday_close_exception',sourceId:exception.id,title:'Инкассация',body:'Тест',href:'/admin/inbox',occurredAt:now,createdAt:now,receipts:{create:{userId:admin.id}}}});
    }
    assert.equal((await inbox()).attentionCount,0,'past shift and approved encashment leave attention');
    assert.equal((await dispatch()).sent,0,'late push channel cannot revive old or approved encashment');
    const history=await api.loadAdminInbox({userId:admin.id,limit:100,view:'history',now});
    assert.equal(history.items.filter((i:any)=>i.event.sourceType==='workday_close_exception').length,2,'history is retained');
    const pending=await prisma.workdayCloseExceptionRequest.findFirstOrThrow({where:{employeeId:buyer.id,status:'pending'}});
    assert.equal(pending.status,'pending','hiding past-shift notification does not invent approval');
  } finally {
    webpush.sendNotification=originalSend;webpush.setVapidDetails=originalConfigure;
    for(const [i,k] of ['WEB_PUSH_VAPID_PUBLIC_KEY','WEB_PUSH_VAPID_PRIVATE_KEY'].entries()){if(saved[i]===undefined)delete process.env[k];else process.env[k]=saved[i];}
    await prisma.adminInboxEvent.deleteMany({where:{OR:[{eventKey:{contains:prefix}},{sourceId:DELIVERY_PERSON.ref},{sourceId:String(admin.id),sourceType:'admin_attention_digest'},{receipts:{some:{userId:admin.id}}}]}});
    await prisma.expenseRequestAdminCase.deleteMany({where:{oneCRequestRef:{startsWith:prefix}}});
    await prisma.supplierPaymentPlan.deleteMany({where:{managerUserId:buyer.id}});
    await prisma.user.deleteMany({where:{id:{in:[admin.id,buyer.id]}}});
    await prisma.$disconnect();
  }
});
