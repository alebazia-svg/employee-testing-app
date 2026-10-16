import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {build} from 'esbuild';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';

// Run only against a fresh disposable local database initialized with db push.
// Install the historical CHECK explicitly: Prisma's String omits SQL checks.
test('real PostgreSQL: legacy CHECK rejects advance; migration permits CNY save and keeps links', async()=>{
  const url=new URL(process.env.DATABASE_URL || 'http://missing');
  assert.equal(url.hostname,'127.0.0.1');
  assert.equal(url.pathname,'/mobo_advance_test');
  assert.equal(process.env.PROCUREMENT_DB_TEST,'isolated-advance');
  const db=new PrismaClient();
  try {
    assert.equal(await db.user.count(),0,'requires a fresh disposable DB');
    const buyer=await db.user.create({data:{name:'Test Buyer',login:'advance-test',passwordHash:'not-a-real-login',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
    await db.user.create({data:{name:'Test Admin',login:'advance-admin',passwordHash:'not-a-real-login',role:'ADMIN'}});
    for(const purpose of ['GOODS','DELIVERY']) await db.supplierPaymentPlan.create({data:{
      planCode:`LEGACY-${purpose}`,managerUserId:buyer.id,supplierPartner:`Legacy ${purpose}`,
      plannedDate:new Date('2026-10-16'),plannedAmount:500,paymentPurpose:purpose,
      orderRefs:['legacy-order'],orderNumbers:['123'],condition:'Keep comment',paymentMethod:'CASH',
      oneCCashEvidence:{manualRubleLinks:[{ref:'existing-rko',fingerprint:'preserve'}]},
    }});
    const before=await db.supplierPaymentPlan.findMany({orderBy:{planCode:'asc'}});
    await db.$executeRawUnsafe('ALTER TABLE "SupplierPaymentPlan" ADD CONSTRAINT "SupplierPaymentPlan_paymentPurpose_check" CHECK ("paymentPurpose" IN (\'GOODS\',\'DELIVERY\'))');
    (globalThis as any).advanceDbTest={db,buyer};
    const mocks:Record<string,string>={
      auth:'export const getCurrentUser=async()=>globalThis.advanceDbTest.buyer;',
      prisma:'export const prisma=globalThis.advanceDbTest.db;',
      'procurement-request-catalogue':'export const fetchRequestOrderCatalogue=async()=>({complete:true,rows:[]});',
      'procurement-supplier-roster':'export const fetchManagerSupplierNames=async()=>["Test Hoco"];',
      'procurement-supplier-settlements':'export const fetchSupplierSettlements=async()=>({complete:true,rows:[]});export const summarizeSupplierSettlements=()=>({bySupplier:{"Test Hoco":{debt:0,advance:58845.12}},unsupportedCurrencyRows:0});',
      'procurement-plan-revision-server':'export const freshEvidence=async()=>new Map();',
      'procurement-usdt-funding-server':'export const readFundingBalance=async()=>null;export const assertFundingBalance=async()=>{};',
      'procurement-usdt-rate':'export const getLatestProcurementUsdtRate=async()=>({rate:89.5});',
      'procurement-planning-submit':'export const planningSubmissionError=async()=>null;',
    };
    const output=await build({entryPoints:['app/api/procurement/payment-plans/batch/route.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'read-only-boundaries',setup(b){
      b.onResolve({filter:/^@\/lib\//},a=>mocks[a.path.slice(6)]?{path:a.path.slice(6),namespace:'mock'}:null);
      b.onResolve({filter:/^server-only$/},()=>({path:'server-only',namespace:'empty'}));
      b.onLoad({filter:/.*/,namespace:'empty'},()=>({contents:''}));
      b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js'}));
    }}]});
    const module={exports:{} as any};
    new Function('require','module','exports',output.outputFiles[0].text)(createRequire(import.meta.url),module,module.exports);
    const body={plannedDate:'2026-10-16',rows:[{basis:'ADVANCE',paymentPurpose:'SUPPLIER_ADVANCE',supplierPartner:'Test Hoco',orderRef:'',paymentMethod:'CNY',plannedAmount:57868,foreignAmount:4255,exchangeRate:13.6}]};
    const send=()=>module.exports.POST(new Request('http://localhost/test',{method:'POST',body:JSON.stringify(body)}));
    const rejected=await send(); assert.equal(rejected.status,503);
    const failure=(await rejected.json()).error; assert.match(failure,/сохранени/);assert.doesNotMatch(failure,/1С/);
    assert.equal(await db.supplierPaymentPlan.count(),2);assert.equal(await db.supplierPaymentPlanEvent.count(),0);assert.equal(await db.adminInboxEvent.count(),0);
    const sql=await readFile('prisma/migrations/20261016210000_procurement_supplier_advance_purpose/migration.sql','utf8');
    const statements=sql.replace(/--[^\n]*/g,'').split(';').map(s=>s.trim()).filter(s=>s&&s!=='BEGIN'&&s!=='COMMIT');
    await db.$transaction(async tx=>{for(const s of statements)await tx.$executeRawUnsafe(s);});
    assert.deepEqual(await db.supplierPaymentPlan.findMany({orderBy:{planCode:'asc'}}),before,'legacy data and manual links unchanged');
    const saved=await send();assert.equal(saved.status,201);
    const plans=(await saved.json()).plans;assert.equal(plans.length,1);
    const plan=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:plans[0].id}});
    assert.equal(plan.paymentPurpose,'SUPPLIER_ADVANCE');assert.equal(plan.status,'SUBMITTED');
    assert.equal(plan.paymentMethod,'CNY');assert.equal(plan.currency,'CNY');
    assert.equal(Number(plan.foreignAmount),4255);assert.equal(Number(plan.exchangeRate),13.6);assert.equal(Number(plan.plannedAmount),57868);
    assert.deepEqual(plan.orderRefs,[]);assert.equal(await db.supplierPaymentPlanEvent.count(),1);
    const inbox=await db.adminInboxEvent.findMany();assert.equal(inbox.length,1);assert.equal(inbox[0].title,'Новый аванс поставщику');
    assert.equal(await db.adminInboxReceipt.count(),1);
    assert.equal((await send()).status,409,'retry does not duplicate the request');
    assert.equal(await db.supplierPaymentPlan.count(),3);
    await assert.rejects(db.supplierPaymentPlan.update({where:{id:plan.id},data:{paymentPurpose:'UNKNOWN_PURPOSE'}}));
    const constraint=await db.$queryRawUnsafe<any[]>(`SELECT convalidated, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='"SupplierPaymentPlan"'::regclass AND conname='SupplierPaymentPlan_paymentPurpose_check'`);
    assert.equal(constraint[0].convalidated,true);assert.match(constraint[0].definition,/SUPPLIER_ADVANCE/);
  } finally {delete (globalThis as any).advanceDbTest;await db.$disconnect();}
});
