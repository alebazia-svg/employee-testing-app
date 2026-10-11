import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { getMoscowDateKey } from '../lib/workday';
import { readDeliveryLink } from '../lib/procurement-delivery-native';
import { DELIVERY_PERSON } from '../lib/procurement-delivery-policy';
const url = process.env.ATTENTION_TEST_DATABASE_URL;
test('isolated DB: preview, duplicate clicks, changed request, lost native response and recovery', { skip: !url }, async () => {
  assert.equal(url, 'postgresql://attention:local-attention-only@127.0.0.1:55448/attention_integration');
  const db = new PrismaClient({ datasources: { db: { url } } });
  assert.equal(await db.user.count(), 0);
  const cashbox = '22222222-2222-4222-a222-222222222222';
  const user = await db.user.create({ data: { name: 'Тест', login: 'create-test', role: 'EMPLOYEE', department: 'retail', portalArea: 'WORKDAY', passwordHash: 'none' } });
  await db.userOneCCashboxMapping.create({ data: { userId: user.id, oneCCashboxRef: cashbox, oneCCashboxName: 'Тестовая касса' } });
  const shift = await db.workDayEntry.create({ data: {userId:user.id,date:getMoscowDateKey(),department:'retail',shiftCode:'09_20',shiftLabel:'09:00–20:00',status:'active',startedAt:new Date(Date.now()-60000)} });
  const details = { amount: 15000, comment: 'Тест', requestedAt: new Date().toISOString() };
  const state: any = { db, details, id: 'request-1', native: new Map(), confirms: 0, pending: 0, drop: false, enabled: true, auth: true };
  state.snapshot = (plan: any) => ({ funding: { cash_balance: 30000, allocated_pending: 0, unallocated_count: 11, other_review_count: 0 }, document: { ref: plan.request_ref, number: 'TEST-1', date: '2026-10-08 12:00:00', amount: plan.amount, cashbox: { ref: cashbox, name: 'Тестовая касса' }, organization: { ref: DELIVERY_PERSON.organizationRef, name: 'Тестовая организация' }, currency: { ref: DELIVERY_PERSON.currencyRef }, accountable_person: { ref: DELIVERY_PERSON.ref, name: 'Астемир' }, is_accountable_issue: true, multiple_recipients: false, payment_form: { cash: true, cashless: false, card: false }, advance_report_date: plan.report_date, posted: true, deletion_mark: false, status: { key: 'payable' } }, execution: { complete: true }, linked_cash_expense_orders: { complete: true } });
  (globalThis as any).creationTest = state;
  const mocks: Record<string,string> = {
    prisma: 'export const prisma=globalThis.creationTest.db;',
    'admin-api-auth': 'export async function requireAdminApi(){return globalThis.creationTest.auth ? {ok:true,user:{id:1}}:{ok:false,response:Response.json({}, {status:403})};}',
    'procurement-delivery-reminders': 'export async function loadDeliveryView(){return {nativeRequest:{state:"unlinked"}};} export async function deliveryMappedUser(){}; export async function activeDeliveryRequest(){const s=globalThis.creationTest;return {id:s.id,details:s.details};}',
    'procurement-delivery-funding': 'export const deliveryFundingFromEvidence=x=>x;export const deliveryFundingForManagerCashboxes=(x,refs)=>({...x,cashboxes:x.cashboxes.filter(b=>refs.includes(b.ref))});',
    'procurement-delivery-create-source': `const s=globalThis.creationTest;
      export const deliveryCreateEnabled=()=>s.enabled;
      export async function deliveryCreationApi(){return {checkedAt:new Date().toISOString(),cashboxes:[{ref:'${cashbox}',name:'Тест',balance:30000,pending:s.pending,count:0}],topups:[],unassignedCount:11,unassignedAmount:1014200,reviewCount:1};}
      export async function readDeliveryCreation(ref){return s.native.get(ref)||{status:'absent'};}
      export async function previewDeliveryCreation(plan){s.native.set(plan.request_ref,{status:'preview'});return {committed:false,transaction_rolled_back:true,preview_token:'token',proposed_after:s.snapshot(plan)};}
      export async function confirmDeliveryCreation(plan){s.confirms++;s.native.set(plan.request_ref,{status:'committed',state:s.snapshot(plan)});if(s.drop)throw Error('response_lost');return {committed:true};}`,
  };
  const output = await build({ stdin: { contents: "export * from './lib/procurement-delivery-create'; export * from './app/api/admin/procurement/delivery-create/route';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write:false, platform:'node',format:'cjs',packages:'external',plugins:[{name:'mock-native',setup(b){ b.onResolve({filter:/^(?:@\/lib\/|\.\/)/},a=>{const k=a.path.replace(/^@\/lib\/|^\.\//,'');return mocks[k]?{path:k,namespace:'mock'}:null;});b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path]}));}}] });
  const mod={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);const api=mod.exports;
  const preview = () => api.actDeliveryCreation({action:'preview',reminderId:state.id,cashboxRef:cashbox,reportDate:'2026-10-09'},1);
  try {
    state.pending = 16000;
    await assert.rejects(preview, /CASHBOX_REVIEW_REQUIRED/);
    assert.equal(state.native.size, 0, 'insufficient chosen cashbox is blocked before native calls');
    state.pending = null;
    await assert.rejects(preview, /CASHBOX_REVIEW_REQUIRED/);
    state.pending = 0;
    const tries=await Promise.allSettled([preview(),preview()]); assert.equal(tries.filter(x=>x.status==='fulfilled').length,1);
    let p=(tries.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<any>).value;
    assert.equal(p.state,'preview'); assert.equal(p.summary.funding.unallocated_count,11,'unallocated organization plans are disclosed, not a global block');assert.equal(state.confirms,0,'preview never confirms');
    assert.ok(!('token' in p),'native token stays server-side');
    assert.equal(p.cashboxShift.state,'active');
    await db.workDayEntry.update({where:{id:shift.id},data:{status:'completed',endedAt:new Date()}});
    await assert.rejects(()=>api.actDeliveryCreation({action:'confirm',reminderId:state.id,previewId:p.previewId},1),/CASHBOX_SHIFT_CHANGED/);
    assert.equal(state.confirms,0,'shift change blocks native confirmation');
    p=await preview(); assert.equal(p.cashboxShift.state,'completed','explicit off-shift review is allowed with warning metadata');
    const confirm={action:'confirm',reminderId:state.id,previewId:p.previewId};
    details.amount=15001;await assert.rejects(()=>api.actDeliveryCreation(confirm,1),/REQUEST_CHANGED/);details.amount=15000;
    state.drop=true;await assert.rejects(()=>api.actDeliveryCreation(confirm,1),/response_lost/);
    assert.equal((await api.deliveryCreationState()).state,'review');
    await assert.rejects(preview,/RECOVERY_REQUIRED/);
    const recovered=await api.actDeliveryCreation({action:'recover',reminderId:state.id},1);
    assert.equal(recovered.state,'committed'); assert.equal(state.confirms,1);
    await api.actDeliveryCreation(confirm,1);assert.equal(state.confirms,1,'repeat reads existing document');
    assert.equal(await db.adminInboxEvent.count({where:{type:'procurement.delivery_native_linked'}}),1);
    const link = await db.adminInboxEvent.findFirstOrThrow({where:{type:'procurement.delivery_native_linked'}});
    assert.equal(readDeliveryLink(link.body).ref,recovered.summary.ref,'created document link satisfies the existing reader contract');
    state.auth=false;assert.equal((await api.GET()).status,403);state.auth=true;
    state.enabled=false;assert.equal((await api.POST(new Request('http://localhost/api',{method:'POST'}))).status,403);state.enabled=true;
    assert.equal((await api.POST(new Request('http://localhost/api',{method:'POST',headers:{origin:'http://other'}}))).status,403);
  } finally { await db.adminInboxEvent.deleteMany();await db.userOneCCashboxMapping.deleteMany();await db.workDayEntry.deleteMany();await db.user.deleteMany();await db.$disconnect();delete (globalThis as any).creationTest; }
});
