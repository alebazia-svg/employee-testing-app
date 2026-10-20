import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {paymentEvidenceIdentity} from '../lib/procurement-evidence-continuity';
import {qrReceiptStatus} from '../lib/procurement-receipt-policy';
test('notification detail authenticates recipient and record owner, never reads 1C or writes',async t=>{
  const g=globalThis as any;
  const plan={id:'plan',planCode:'TEST',managerUserId:2,supplierPartner:'Supplier',plannedDate:new Date(),updatedAt:new Date(),plannedAmount:100,foreignAmount:null,exchangeRate:null,paymentMethod:'CASH',condition:'',orderNumbers:['1'],status:'APPROVED',paymentPurpose:'GOODS',oneCCashEvidence:null};
  let user:any=null,sourceType='supplier_payment_plan',kind='procurement_payment_approved',owner=2,eventType='procurement.payment_updated',href='/admin/procurement';
  const db={adminInboxReceipt:{findFirst:async({where}:any)=>where.id==='own'&&where.userId===1?{event:{sourceId:'plan',sourceType,type:eventType,href,body:''}}:null},
    supplierPaymentPlan:{findUnique:async()=>({...plan,managerUserId:owner})},
    supplierPaymentReceipt:{findUnique:async({where}:any)=>where.id==='plan'?{planId:'plan'}:null},
    expenseRequestAdminCase:{findFirst:async({where}:any)=>where.id==='case'&&where.oneCRequestRef==='plan'?{id:'case',oneCRequestRef:'plan',oneCNumber:'1',amount:100,lastSeenAt:new Date(),currentStatusKey:'not_approved',currentCycleOrigin:'live',evaluations:[{sourceComplete:true,normalizedSource:{cashbox:{name:'Касса'},cashFlowItem:{name:'Доставка'}}}]}:null},
    workdayNotification:{findFirst:async({where}:any)=>where.id===3&&where.userId===2?{kind,fingerprint:'procurement-payment:plan:approved:event'}:null}};
  g.notificationDetailTest={getUser:()=>user,db};t.after(()=>delete g.notificationDetailTest);
  t.mock.method(globalThis,'fetch',async()=>{throw Error('No network allowed for opening a stored record');});
  const code=await build({entryPoints:['app/api/notification-details/[audience]/[id]/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'read-only',setup(b){b.onResolve({filter:/^@\/lib\/(auth|prisma)$/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('auth')?'export const getCurrentUser=async()=>globalThis.notificationDetailTest.getUser();':'export const prisma=globalThis.notificationDetailTest.db;',loader:'js'}));}}]});
  const mod={exports:{} as any};new Function('require','module','exports',code.outputFiles[0].text)(createRequire(import.meta.url),mod,mod.exports);
  const get=(audience='admin',id='own')=>mod.exports.GET(new Request('http://localhost/test'),{params:Promise.resolve({audience,id})});
  assert.equal((await get()).status,401);
  user={id:2,role:'EMPLOYEE',portalArea:'PROCUREMENT',isActive:true};assert.equal((await get()).status,403);
  assert.equal((await get('admin','plan:plan:revision:2026-10-12')).status,403);
  assert.equal((await get('employee','plan:plan:revision:2026-10-12')).status,404);
  assert.equal((await get('employee','3')).status,200);assert.equal((await get('employee','4')).status,404);
  assert.equal((await get('employee','NaN')).status,404);assert.equal((await get('employee','1.2')).status,404);
  owner=8;assert.equal((await get('employee','3')).status,404);owner=2;
  kind='planned';assert.equal((await get('employee','3')).status,404);kind='procurement_payment_approved';
  user={id:1,role:'ADMIN',portalArea:'ADMIN',isActive:true};
  assert.equal((await get('admin','plan:plan:revision:2026-10-12')).status,200);
  const response=await get();assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');
  const body=await response.json();assert.equal(body.plan.plannedAmount,'100');assert.equal('oneCCashEvidence' in body.plan,false);
  assert.equal((await get('admin','someone-else')).status,404);
  sourceType='supplier_payment_receipt';eventType='procurement.receipt_added';
  assert.equal((await (await get()).json()).kind,'receipts');
  plan.paymentMethod='ACCOUNTABLE_QR';
  assert.equal(qrReceiptStatus((await (await get()).json()).plan,1,true),'Чек добавлен · оформление в 1С не подтверждено');
  const stamp=new Date().toISOString();
  (plan as any).oneCCashEvidence={lastCompletePaymentView:{version:1,identity:paymentEvidenceIdentity(plan),readStartedAt:stamp,verifiedAt:stamp,
    evidence:{state:'ISSUED_BY_ONE_C',issuedAmount:100,paidAmount:0,paidForeignAmount:0,cashOrders:[],currencyPayments:[]}}};
  const receiptDetail=(await (await get()).json()).plan;
  assert.equal(receiptDetail.evidence.verification,'last-confirmed');
  assert.equal(qrReceiptStatus(receiptDetail,1,true),'Чек добавлен');
  assert.equal('oneCCashEvidence' in receiptDetail,false);
  sourceType='expense_request';href='/admin/expense-requests/case';
  const expense=await (await get()).json();assert.equal(expense.kind,'expense');assert.equal(expense.item.cashbox,'Касса');
  href='/admin/expense-requests/not-the-case';assert.equal((await get()).status,404);
  sourceType='dependency';assert.equal((await get()).status,404);
  user.isActive=false;assert.equal((await get()).status,401);
});
