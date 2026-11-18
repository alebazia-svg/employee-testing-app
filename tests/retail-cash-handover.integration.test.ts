import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma';import {recipientOffer,recountRetailCash,prepareRetailCash,confirmRetailCash,processRetailCash,serializeRetailHandover} from '../lib/retail-cash-handover-server';import {getMoscowDateKey} from '../lib/workday';
if(process.env.DATABASE_URL!=='postgresql://postgres@127.0.0.1:55818/timur_local_tests')throw Error('ISOLATED_TEST_DB_ONLY');
const now=new Date(`${getMoscowDateKey()}T15:00:00+03:00`);
const source='05e6a168-d269-11ee-9730-0025901e48ee',target='df888646-4473-11ed-8f49-0025901e48ee';
async function fixture(){
 const key=randomUUID();const user=await prisma.user.create({data:{login:`sender-${key}`,name:'Отправитель · интеграционный тест',passwordHash:'unused',role:'EMPLOYEE',department:'retail',workdayControlMode:'CASH_HANDOVER',oneCCashboxMapping:{create:{oneCCashboxRef:source,oneCCashboxName:'Временная · только проверка чтения'}}}});
 const recipient=await prisma.user.create({data:{login:`recipient-${key}`,name:'Получатель · интеграционный тест',passwordHash:'unused',role:'EMPLOYEE',department:'retail',oneCCashboxMapping:{create:{oneCCashboxRef:target,oneCCashboxName:'Касса Чеченова'}}}});
 const day=await prisma.workDayEntry.create({data:{userId:user.id,date:getMoscowDateKey(now),department:'retail',shiftCode:'09_18',shiftLabel:'09:00–18:00',startedAt:new Date(+now-3600000),status:'active',shiftControlRun:{create:{userId:user.id,department:'retail',date:getMoscowDateKey(now),status:'active',tasks:{create:{title:'Пересчитать и передать кассу',category:'handover',sortOrder:1,status:'pending',required:true}}}}}});
 const receiverDay=await prisma.workDayEntry.create({data:{userId:recipient.id,date:getMoscowDateKey(now),department:'retail',shiftCode:'11_20',shiftLabel:'11:00–20:00',shiftEndMinutes:1200,startedAt:new Date(+now-7200000),status:'active'}});
 return {user,day,recipient,receiverDay};
}
async function ready(f:Awaited<ReturnType<typeof fixture>>,amount=321){
 const h=await recountRetailCash(prisma,f.user.id,f.day.id,{amount,requestKey:randomUUID(),revision:null},now);
 const p=await prepareRetailCash(prisma,f.user.id,f.day.id,h.revision,now);return {h,p};
}
const pair=(p:any)=>({ok:true,path:'/cash-expense-order-create' as const,durationMs:1,pairComplete:true,idempotentReplay:false,document:{ref:'rko',number:'TEST-RKO',datetime:now.toISOString(),posted:true,cashbox:{ref:p.cashboxRef,name:''},targetCashbox:{ref:p.targetCashboxRef,name:''},amount:p.amount,operation:'transfer'},receiptDocument:{ref:'pko',number:'TEST-PKO',datetime:now.toISOString(),posted:true,cashbox:{ref:p.targetCashboxRef,name:''},sourceCashbox:{ref:p.cashboxRef,name:''},baseDocument:{ref:'rko',name:''},amount:p.amount,operation:'transfer'}});
test('real DB: concurrent confirmation/posting share one immutable operation; discrepancy remains',async()=>{
 const f=await fixture();const {h,p}=await ready(f);assert.equal((await prisma.retailCashHandover.findUniqueOrThrow({where:{id:h.id}})).handedAt,null);
 await Promise.all([confirmRetailCash(prisma,f.user.id,f.day.id,p.revision,true,now),confirmRetailCash(prisma,f.user.id,f.day.id,p.revision,true,now)]);
 const closed=await prisma.workDayEntry.findUniqueOrThrow({where:{id:f.day.id}});assert.equal(closed.status,'completed');assert.equal(closed.endedAt?.getTime(),+now);
 let calls=0;const send=async(p:any)=>{calls++;await new Promise(r=>setTimeout(r,40));return pair(p);};
 await Promise.all([processRetailCash(prisma,f.user.id,f.day.id,now,send),processRetailCash(prisma,f.user.id,f.day.id,now,send)]);
 const end=await prisma.retailCashHandover.findUniqueOrThrow({where:{id:h.id}});assert.equal(calls,1);assert.equal(end.status,'posted');assert.equal(end.operationKey,h.operationKey);assert.equal((await prisma.workDayEntry.findUniqueOrThrow({where:{id:f.day.id}})).endedAt?.getTime(),+now,'posting must preserve time of handoff');
 if(h.expected!==null&&Number(h.expected)!==321)assert.equal(await prisma.workdayControlIssue.count({where:{fingerprint:`retail-handover:${h.id}:cash_handover_mismatch`,status:'open'}}),1);
 assert.equal(await prisma.workdayNotification.count({where:{userId:f.user.id}}),0);assert.ok(!('expected' in serializeRetailHandover(end)!));
});
test('real DB: missing/closed recipient never silently reroutes a physical handover',async()=>{const f=await fixture();const {p}=await ready(f);await prisma.workDayEntry.update({where:{id:p.recipientWorkDayId!},data:{endedAt:now,status:'completed'}});const h=await confirmRetailCash(prisma,f.user.id,f.day.id,p.revision,true,now);assert.equal(h.status,'review');assert.equal(h.recipientUserId,p.recipientUserId);assert.ok(h.handedAt);let calls=0;await processRetailCash(prisma,f.user.id,f.day.id,now,async(p:any)=>{calls++;return pair(p);});assert.equal(calls,0);});
test('real DB: count survives abandonment; duplicate count is idempotent and stale edits reject',async()=>{const f=await fixture(),key=randomUUID();const h=await recountRetailCash(prisma,f.user.id,f.day.id,{amount:500,requestKey:key,revision:null},now);const again=await recountRetailCash(prisma,f.user.id,f.day.id,{amount:500,requestKey:key,revision:null},now);assert.equal(again.id,h.id);assert.equal(again.revision,h.revision);assert.equal((await prisma.retailCashHandover.findUniqueOrThrow({where:{id:h.id}})).handedAt,null);await assert.rejects(recountRetailCash(prisma,f.user.id,f.day.id,{amount:600,requestKey:randomUUID(),revision:null},now));});
test('real DB: timeout/retry keeps exact amount, target and key; cooldown prevents immediate retry',async()=>{const f=await fixture();const {p}=await ready(f);await confirmRetailCash(prisma,f.user.id,f.day.id,p.revision,true,now);let calls=0;const sent:any[]=[];const send=async(p:any)=>{calls++;sent.push(p);if(calls===1)throw Error('Connection lost after external commit');return {...pair(p),idempotentReplay:true};};const first=await processRetailCash(prisma,f.user.id,f.day.id,now,send);assert.equal(first.status,'error');await processRetailCash(prisma,f.user.id,f.day.id,new Date(+now+1000),send);assert.equal(calls,1);const end=await processRetailCash(prisma,f.user.id,f.day.id,new Date(+now+121000),send);assert.equal(end.status,'posted');assert.equal(sent[0].idempotencyKey,sent[1].idempotencyKey);assert.equal(sent[0].targetCashboxRef,sent[1].targetCashboxRef);});
test('real DB: zero recount completes task without a cash document',async()=>{const f=await fixture();const h=await recountRetailCash(prisma,f.user.id,f.day.id,{amount:0,requestKey:randomUUID(),revision:null},now);assert.equal(h.status,'zero');let calls=0;await processRetailCash(prisma,f.user.id,f.day.id,now,async(p:any)=>{calls++;return pair(p);});assert.equal(calls,0);});
test('single window: preview is read-only, submission freezes the shown recipient and repeated clicks share one transfer',async()=>{
 const f=await fixture();const offer=await recipientOffer(prisma,f.user.id,f.day.id,now);
 assert.equal(await prisma.retailCashHandover.count({where:{workDayEntryId:f.day.id}}),0);
 const payload={amount:2,requestKey:randomUUID(),revision:null,offerToken:offer.token};
 await assert.rejects(()=>recountRetailCash(prisma,f.user.id,f.day.id,{...payload,offerToken:offer.token+'x'},now));
 const [a,b]=await Promise.all([1,2].map(()=>recountRetailCash(prisma,f.user.id,f.day.id,payload,now)));
 assert.equal(a.id,b.id);assert.equal(a.status,'confirmed');assert.equal(a.recipientName,offer.name);assert.ok(a.handedAt);
});
test('delayed physical confirmation rechecks the original recipient after five minutes',async()=>{
 const f=await fixture();
 const {p}=await ready(f);
 const h=await confirmRetailCash(prisma,f.user.id,f.day.id,p.revision,true,new Date(+now+16*60000));
 assert.equal(h.status,'confirmed');
 assert.equal(h.targetCashboxRef,p.targetCashboxRef);
 assert.equal(h.recipientWorkDayId,p.recipientWorkDayId);
});
test('late handoff freezes the eligible manager after the planned closing time', async () => {
 const f = await fixture();
 const late = new Date(getMoscowDateKey(now) + 'T23:55:00+03:00');
 const offer = await recipientOffer(prisma, f.user.id, f.day.id, late);
 const transfer = await recountRetailCash(prisma, f.user.id, f.day.id, {
   amount: 3, requestKey: randomUUID(), revision: null, offerToken: offer.token,
 }, late);
 assert.equal(transfer.recipientName, offer.name);
 assert.equal(transfer.status, 'confirmed');
 assert.equal(transfer.handedAt?.getTime(), +late);
 const managerDay = await prisma.workDayEntry.findUniqueOrThrow({where: {id: transfer.recipientWorkDayId!}});
 assert.ok(managerDay.shiftEndMinutes !== null && managerDay.shiftEndMinutes < 23 * 60 + 55);
 assert.equal(managerDay.endedAt, null);
});
test('cash handoff stops hourly reminders before documents are posted', async () => {
 const {queueWorkdayEndReminders,workdayEndReminderDelivery}=await import('../lib/workday-end-notifications');
 const f=await fixture();
 const {p}=await ready(f);
 await queueWorkdayEndReminders(prisma,now);
 const notices=await prisma.workdayNotification.findMany({where:{userId:f.user.id,kind:'workday_end_reminder'},orderBy:{scheduledAt:'asc'}});
 assert.equal(notices.length,3);
 const at=(time:string)=>new Date(f.day.date+'T'+time+':00+03:00');
 assert.equal((await workdayEndReminderDelivery(prisma,notices[0],at('18:00'))).state,'send');
 const sent=await confirmRetailCash(prisma,f.user.id,f.day.id,p.revision,true,at('18:25'));
 assert.ok(sent.handedAt);
 for(const notice of notices)assert.equal((await workdayEndReminderDelivery(prisma,notice,at('19:00'))).state,'cancel');
 assert.equal(await prisma.workdayNotification.count({where:{userId:f.user.id,kind:'workday_end_reminder',status:'resolved',pushStatus:'cancelled'}}),3);
});
test.after(()=>prisma.$disconnect());
