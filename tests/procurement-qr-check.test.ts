import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {needsQrCheck,qrCheckPlan,qrPaymentState} from '../lib/procurement-qr-check-policy';
import {qrCheckKey} from '../lib/procurement-qr-check-key';
import {qrConfirmationContext} from '../lib/procurement-document-policy';
import {workdayNotificationThreadKey,workdayNotificationThreadWhere} from '../lib/workday-notification-thread';
import {inactiveProcurementNotifications} from '../lib/procurement-notification-lifecycle';
import {paymentEvidenceIdentity} from '../lib/procurement-evidence-continuity';
const now=new Date('2026-10-25T09:00:00Z');
const plan={id:'p',plannedDate:new Date('2026-10-25'),plannedAmount:100,paymentMethod:'USDT',supplierPartner:'Test',status:'APPROVED',updatedAt:now,managerUserId:42};
const file={id:'qr',purpose:'QR',replacedById:null,revision:0};
test('manual requests only for approved currency payments, including missing QR and future dates',()=>{
  assert.equal(needsQrCheck(plan,[file],'2026-10-25'),true);
  assert.equal(needsQrCheck({...plan,paymentMethod:'CNY'},[file],'2026-10-25'),true);
  for(const change of [{status:'SUBMITTED'},{status:'CANCELLED'},{paymentMethod:'ACCOUNTABLE_QR'},{paymentMethod:'CASH'},{paymentMethod:'BANK'},{oneCCashEvidence:{pendingRevision:{}}},{oneCCashEvidence:{fundingDeferral:{}}}])assert.equal(needsQrCheck({...plan,...change},[file],'2026-10-25'),false);
  assert.equal(needsQrCheck({...plan,plannedDate:new Date('2026-10-26')},[],'2026-10-25'),true);
  assert.equal(needsQrCheck(plan,[{...file,purpose:'RECEIPT'}],'2026-10-25'),true);
  assert.equal(needsQrCheck(plan,[{...file,replacedById:'new'}],'2026-10-25'),true);
  const confirmed={...file,qrConfirmedAt:now,qrConfirmationContext:qrConfirmationContext(plan,'2026-10-25')};
  assert.equal(needsQrCheck(plan,[confirmed],'2026-10-25'),false);
  assert.equal(needsQrCheck(plan,[confirmed],'2026-10-26'),true);
  assert.match(qrCheckKey(plan,[file],'2026-10-25'),/^procurement-qr-check:p:manual:2026-10-25:[a-f0-9]{64}$/);
  assert.equal(qrCheckPlan(qrCheckKey(plan,[file],'2026-10-25')),'p');assert.equal(qrCheckPlan('bad'),null);
  assert.notEqual(qrCheckKey(plan,[file],'2026-10-25'),qrCheckKey({...plan,managerUserId:43},[file],'2026-10-25'),'a new manager must not reuse the former recipient request');
  assert.equal(qrPaymentState('PAID_BY_ONE_C'),'closed');assert.equal(qrPaymentState('SOURCE_UNAVAILABLE'),'unknown');
  const notice={id:1,kind:'procurement_qr_check',fingerprint:qrCheckKey(plan,[file],'2026-10-25')};
  assert.equal(workdayNotificationThreadKey(notice),'qr-check:p');
  assert.equal(workdayNotificationThreadWhere(notice).status,'sent');
});
test('manual producer and send guard: deduplication, quiet hours, replacement, source failures and changed versions',async()=>{
  let files:any[]=[file],state='NO_EVIDENCE',offline=false,version=plan.updatedAt.toISOString(),method='USDT';
  const rows=new Map<string,any>();let sourceReads=0;
  const db:any={user:{findUnique:async()=>({role:'ADMIN',isActive:true})},$queryRaw:async()=>[],supplierPaymentPlan:{findUnique:async()=>({...plan,paymentMethod:method,receipts:files,manager:{isActive:true}})},workdayNotification:{findUnique:async({where}:any)=>rows.get(where.fingerprint),create:async({data}:any)=>{rows.set(data.fingerprint,data);return data;}}};
  db.$transaction=async(fn:any)=>fn(db);
  const mocks:any={'server-only':{},'./prisma':{prisma:db},'./procurement-notification-evidence':{procurementNotificationEvidence:async()=>{sourceReads++;return offline?null:Object.assign(new Map([['p',{state}]]),{versions:new Map([['p',version]])});}}};
  const bundle=await build({entryPoints:['lib/procurement-qr-check-notifications.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
  const require=createRequire(import.meta.url),mod={exports:{} as any};
  new Function('require','module','exports',bundle.outputFiles[0].text)((name:string)=>mocks[name]??require(name),mod,mod.exports);
  const api=mod.exports;
  const actor={id:1,role:'ADMIN',isActive:true};
  const command=()=>({planVersion:plan.updatedAt.toISOString(),qrFiles:files.filter(f=>f.purpose==='QR'&&!f.replacedById).map(f=>({id:f.id,revision:f.revision??0}))});
  assert.equal(api.queueQrCheckPush,undefined,'no automatic producer');
  method='ACCOUNTABLE_QR';await assert.rejects(api.requestQrCheck(actor,'p',command(),now));assert.equal(sourceReads,0);assert.equal(rows.size,0);method='USDT';
  await assert.rejects(api.requestQrCheck({...actor,role:'EMPLOYEE'},'p',command(),now));
  await assert.rejects(api.requestQrCheck(actor,'p',{...command(),planVersion:'old'},now));
  await assert.rejects(api.requestQrCheck(actor,'p',{...command(),qrFiles:[]},now));
  const night=new Date('2026-10-25T00:00:00Z');
  await api.requestQrCheck(actor,'p',command(),night);
  assert.equal((await api.requestQrCheck(actor,'p',command(),night)).alreadyRequested,true);
  assert.equal(rows.size,1);const notice=[...rows.values()][0];
  assert.equal(notice.scheduledAt.toISOString(),'2026-10-25T05:30:00.000Z');
  assert.equal((await api.qrCheckPushDecision(notice,night)).state,'defer');
  assert.equal((await api.qrCheckPushDecision(notice,now)).state,'send');
  assert.equal((await api.qrCheckPushDecision({...notice,userId:99},now)).state,'cancel');
  files=[{...file,qrConfirmedAt:now,qrConfirmationContext:qrConfirmationContext(plan,'2026-10-25')}];
  assert.equal((await api.qrCheckPushDecision(notice,now)).state,'cancel');
  files=[{...file,purpose:'RECEIPT'}];assert.equal((await api.qrCheckPushDecision(notice,now)).state,'cancel');files=[file];
  files=[{...file,id:'replacement'}];assert.equal((await api.qrCheckPushDecision(notice,now)).state,'cancel');files=[file];
  state='ISSUED_BY_ONE_C';assert.equal((await api.qrCheckPushDecision(notice,now)).state,'cancel');
  state='NEEDS_REVIEW';assert.equal((await api.qrCheckPushDecision(notice,now)).state,'defer');state='NO_EVIDENCE';
  offline=true;assert.equal((await api.qrCheckPushDecision(notice,now)).state,'defer');offline=false;
  version='changed';assert.equal((await api.qrCheckPushDecision(notice,now)).state,'defer');version=plan.updatedAt.toISOString();
  assert.equal(rows.size,1,'send guard never produces repeated notices');
  files=[];await api.requestQrCheck(actor,'p',command(),now);assert.equal(rows.size,2);
  const missing=[...rows.values()].find(r=>r.title==='Добавьте QR-код для оплаты');assert.ok(missing);
  files=[file];assert.equal((await api.qrCheckPushDecision(missing,now)).state,'cancel');
  assert.equal((await api.qrCheckPushDecision({userId:42,fingerprint:'procurement-qr-check:p:2026-10-25'},now)).state,'cancel','old automatic notice cannot send');
});

test('manual QR request leaves attention after confirmation, replacement or recorded full payment; stale cache never closes it',async()=>{
  let row:any={...plan,oneCCashEvidence:{},receipts:[file]};
  const notice={id:1,kind:'procurement_qr_check',fingerprint:qrCheckKey(plan,[file],'2026-10-25')};
  const db:any={supplierPaymentPlan:{findMany:async()=>[row]}};
  assert.equal((await inactiveProcurementNotifications(db,[notice])).size,0);
  row={...row,receipts:[{...file,revision:1,qrConfirmedAt:now,qrConfirmationContext:qrConfirmationContext(plan,'2026-10-25')}]};
  assert.equal((await inactiveProcurementNotifications(db,[notice])).has(1),true);
  row={...row,receipts:[{...file,id:'new'}]};
  assert.equal((await inactiveProcurementNotifications(db,[notice])).has(1),true);
  row={...row,receipts:[file]};
  const snapshot={version:1,identity:paymentEvidenceIdentity(row),readStartedAt:now.toISOString(),verifiedAt:now.toISOString(),evidence:{state:'ISSUED_BY_ONE_C',issuedAmount:100,cashOrders:[],currencyPayments:[]}};
  row.oneCCashEvidence={lastCompletePaymentView:snapshot};
  assert.equal((await inactiveProcurementNotifications(db,[notice])).has(1),true);
  row.oneCCashEvidence.lastCompletePaymentView.identity='stale';
  assert.equal((await inactiveProcurementNotifications(db,[notice])).size,0);
});

test('QR dispatcher uses live copy, exact plan link and one delivery claim; defer/cancel never send',async()=>{
  const previous={...process.env};process.env.WEB_PUSH_VAPID_PUBLIC_KEY='mock';process.env.WEB_PUSH_VAPID_PRIVATE_KEY='mock';
  try{for(const decision of ['send','defer','cancel']){
    let claimed=false;const sent:any[]=[];
    const row={id:1,userId:42,kind:'procurement_qr_check',fingerprint:qrCheckKey(plan,[file],'2026-10-25'),taskId:null,issueId:null,reviewId:null,task:null,issue:null,review:null,updatedAt:now,status:'pending',pushStatus:'pending',attemptCount:0,sentAt:null,user:{pushSubscriptions:[{id:1,endpoint:'https://push.invalid',p256dh:'mock',auth:'mock'}]}};
    const mocks:any={
      '@/lib/prisma':{prisma:{workdayNotification:{findMany:async(a:any)=>a.include?[row]:[],update:async()=>{},updateMany:async(a:any)=>{if(a.data.pushStatus==='delivery_sending'){if(claimed)return{count:0};claimed=true;}return{count:1};}}}},
      '@/lib/terminal-fiscal-admin-gate':{TERMINAL_FISCAL_ADMIN_FIRST:false},
      '@/lib/procurement-notification-lifecycle':{inactiveProcurementNotifications:async()=>new Set()},
      './procurement-qr-check-notifications':{queueQrCheckPush:async()=>{},qrCheckPushDecision:async()=>decision==='send'?{state:'send',title:'Проверьте QR для оплаты',body:'Test · перед оплатой подтвердите актуальность QR у поставщика.'}:{state:decision,until:new Date(now.getTime()+60000)}},
      'web-push':{setVapidDetails:()=>{},sendNotification:async(_:any,payload:string)=>sent.push(JSON.parse(payload))},
    };
    const bundle=await build({entryPoints:['lib/workday-notifications.ts'],bundle:true,write:false,format:'cjs',platform:'node',packages:'external',plugins:[{name:'isolated',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
    const require=createRequire(import.meta.url),mod={exports:{} as any};
    new Function('require','module','exports',bundle.outputFiles[0].text)((name:string)=>mocks[name]??require(name),mod,mod.exports);
    await Promise.all([mod.exports.dispatchDueWorkdayNotifications(now),mod.exports.dispatchDueWorkdayNotifications(now)]);
    assert.equal(sent.length,decision==='send'?1:0);
    if(sent.length){assert.equal(sent[0].title,'Проверьте QR для оплаты');assert.match(sent[0].body,/Test/);assert.equal(sent[0].url,'/procurement?receipts=p');}
  }}finally{process.env=previous;}
});
