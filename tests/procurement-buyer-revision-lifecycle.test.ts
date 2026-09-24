import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { validatePaymentPlan } from '../lib/procurement-payment-control';
import { reviewRequestCondition } from '../lib/procurement-order-selection';
import { buyerPaymentComment } from '../lib/procurement-buyer-comment';

test('isolated revision lifecycle preserves review evidence, requires approval for totals and protects paid part',async t=>{
  const condition=reviewRequestCondition([{planningState:'needs_review',number:'DEMO',planningReason:'Сверить аванс'}],'Старый комментарий');
  const state:any={events:[],paid:{state:'PARTIALLY_ISSUED',issuedAmount:40000,paidAmount:0,paidForeignAmount:0},plan:{
    id:'demo',planCode:'DEMO',managerUserId:1,manager:{name:'Закупщик'},supplierPartner:'Учебный поставщик',supplierCounterparty:'',
    orderRefs:['demo-order'],orderNumbers:['DEMO'],plannedDate:new Date('2026-09-25T00:00:00Z'),plannedAmount:100000,
    paymentMethod:'CASH',currency:'RUB',foreignAmount:null,exchangeRate:null,commissionAmount:null,exchangerName:'',supplierConfirmation:'',
    condition,status:'APPROVED',oneCCashEvidence:{},createdAt:new Date('2026-09-24T00:00:00Z'),updatedAt:new Date('2026-09-24T01:00:00Z')}};
  (globalThis as any).buyerRevisionTest=state;
  t.after(()=>{delete (globalThis as any).buyerRevisionTest;});
  const mocks:Record<string,string>={
    prisma:`const s=globalThis.buyerRevisionTest;const update=({data})=>{s.plan={...s.plan,...data,updatedAt:new Date(s.plan.updatedAt.getTime()+1000)};return s.plan};const tx={$executeRaw:async()=>{},supplierPaymentPlan:{findMany:async()=>[s.plan],findFirst:async()=>s.plan,findUniqueOrThrow:async()=>s.plan,updateMany:async arg=>{update(arg);return {count:1}},update:async arg=>update(arg)},supplierPaymentPlanEvent:{create:async({data})=>{s.events.push(data);return {id:String(s.events.length)}}}};export const prisma={...tx,$transaction:async fn=>fn(tx)};`,
    'procurement-currency-payment-source':'export const fetchSupplierCurrencyPaymentSnapshot=async()=>({complete:true,payments:[],conversions:[]});',
    'expense-request-source':'export const fetchExpenseRequestSnapshot=async()=>({complete:true,rows:[]});',
    'procurement-ruble-payment-evidence':'export const paymentEvidenceFrom=(_p,d)=>d;',
    'procurement-currency-payment-evidence':'export const matchProcurementPaymentEvidence=()=>new Map([["demo",globalThis.buyerRevisionTest.paid]]);',
    'procurement-payment-notifications':'export const notifyAdminsAboutProcurementPlans=async()=>{};export const notifyProcurementManagerAboutDecision=async()=>{};',
  };
  const output=await build({entryPoints:['lib/procurement-plan-revision-server.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'isolated',setup(b){
    b.onResolve({filter:/^\.\//},a=>mocks[a.path.slice(2)]?{path:a.path.slice(2),namespace:'mock'}:null);
    b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path]}));
  }}]});
  const module={exports:{} as any};new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
  const input=(amount:number,comment:string)=>validatePaymentPlan({...state.plan,plannedDate:'2026-09-25',plannedAmount:amount,condition:comment}).data;
  await module.exports.proposeApprovedRevision('demo',{id:1,name:'Закупщик'},input(100000,'Новый комментарий'),'Уточнили комментарий',state.plan.updatedAt.toISOString());
  assert.equal(buyerPaymentComment(state.plan.condition),'Новый комментарий');assert.match(state.plan.condition,/Сверить аванс/);
  assert.equal(state.events.at(-1).action,'COMMENT_UPDATED');assert.equal(state.plan.oneCCashEvidence.pendingRevision,undefined);
  const proposal=await module.exports.proposeApprovedRevision('demo',{id:1,name:'Закупщик'},input(120000,'Новый комментарий'),'Уточнили общую сумму',state.plan.updatedAt.toISOString());
  assert.equal(state.plan.plannedAmount,100000,'old approved amount is still effective');
  assert.equal(proposal.revision.data.plannedAmount,120000);assert.match(proposal.revision.data.condition,/Сверить аванс/);
  await module.exports.decideApprovedRevision('demo',2,proposal.revision.id,true,'');
  assert.equal(state.plan.plannedAmount,120000);assert.equal(state.plan.oneCCashEvidence.pendingRevision,null);
  assert.match(state.plan.condition,/Сверить аванс/);assert.equal(state.events.at(-1).action,'REVISION_APPROVED');
  await assert.rejects(()=>module.exports.proposeApprovedRevision('demo',{id:1,name:'Закупщик'},input(30000,'Новый комментарий'),'Уменьшить сумму',state.plan.updatedAt.toISOString()),/меньше уже оплаченной/);
  const reject=await module.exports.proposeApprovedRevision('demo',{id:1,name:'Закупщик'},input(150000,'Новый комментарий'),'Новая договорённость',state.plan.updatedAt.toISOString());
  await module.exports.decideApprovedRevision('demo',2,reject.revision.id,false,'Оставить прежнюю сумму');
  assert.equal(state.plan.plannedAmount,120000);assert.equal(state.events.at(-1).action,'REVISION_REJECTED');
  state.paid={...state.paid,state:'ISSUED_BY_ONE_C',issuedAmount:120000};
  await assert.rejects(()=>module.exports.proposeApprovedRevision('demo',{id:1,name:'Закупщик'},input(150000,'Новый комментарий'),'Изменить оплату',state.plan.updatedAt.toISOString()),/Оплаченная заявка не редактируется/);
});
