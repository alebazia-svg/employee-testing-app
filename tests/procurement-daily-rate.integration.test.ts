import test from 'node:test';
import assert from 'node:assert/strict';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {previewDailyRate,confirmDailyRate,readDailyRates,readDailyRateOverview} from '../lib/procurement-daily-rate-server';
import type {freshEvidence} from '../lib/procurement-plan-revision-server';
import {expenseRequestMoscowCalendarDate} from '../lib/expense-request-source';
if(process.env.DATABASE_URL!=='postgresql://postgres@127.0.0.1:55467/daily_rates_test')throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaClient();test.after(()=>db.$disconnect());
const day=expenseRequestMoscowCalendarDate(new Date());
const command={day,currency:'CNY',rate:14};
const unpaid={actualSupplier:'',actualExchangeRate:null,remainingAmount:1360,remainingForeignAmount:100,state:'NO_EVIDENCE' as const,issuedAmount:0,paidAmount:0,paidForeignAmount:0,cashOrders:[],currencyPayments:[]};
const overrides=new Map<string,object>();
const readEvidence=(async()=>{const plans=await db.supplierPaymentPlan.findMany();return Object.assign(new Map(plans.map(p=>[p.id,{...unpaid,...overrides.get(p.id)}])),{versions:new Map(plans.map(p=>[p.id,p.updatedAt.toISOString()]))});}) as typeof freshEvidence;
async function fixture(){
 const a=await db.user.create({data:{login:randomUUID(),name:'Rate test administrator',role:'ADMIN',portalArea:'PROCUREMENT',passwordHash:'NO_LOGIN'}});
 const b=await db.user.create({data:{login:randomUUID(),name:'Rate test buyer',role:'EMPLOYEE',portalArea:'PROCUREMENT',passwordHash:'NO_LOGIN'}});
 const make=(extra:Record<string,unknown>={})=>db.supplierPaymentPlan.create({data:{planCode:randomUUID(),managerUserId:b.id,supplierPartner:'Rate test',supplierCounterparty:'preserve',orderRefs:[],orderNumbers:[],plannedDate:new Date(day),plannedAmount:1360,foreignAmount:100,exchangeRate:13.6,currency:'CNY',paymentMethod:'CNY',condition:'preserve',status:'APPROVED',oneCCashEvidence:{keep:'must stay'},...extra}});
 return {a,b,make};
}
test('atomic persisted confirmation, money recalculation, audit, notifications and preserved 1C links',async()=>{
 const {a,b,make}=await fixture();const p=await make(),partial=await make({oneCExpenseRequestRef:'preserved-local-reference'}),rub=await make({foreignAmount:null});
 overrides.set(partial.id,{state:'PARTIALLY_ISSUED',issuedAmount:300});
 const preview=await previewDailyRate(command,db,readEvidence);
 assert.ok(preview.rows.some(r=>r.id===p.id&&r.after===1400));assert.ok(preview.excluded.some(r=>r.id===partial.id));
 const result=await confirmDailyRate({...command,fingerprint:preview.fingerprint},a.id,db,readEvidence);
 const changed=await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:p.id}});
 assert.equal(Number(changed.plannedAmount),1400);assert.equal(Number(changed.exchangeRate),14);assert.equal(changed.status,'APPROVED');assert.equal(changed.condition,p.condition);assert.deepEqual(changed.orderRefs,p.orderRefs);
 assert.equal((changed.oneCCashEvidence as any).keep,'must stay');assert.equal((changed.oneCCashEvidence as any).dailyRate.quoteId,result.quote.id);
 assert.deepEqual(await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:partial.id}}),partial);
 assert.equal(Number((await db.supplierPaymentPlan.findUniqueOrThrow({where:{id:rub.id}})).plannedAmount),1360);
 assert.equal((await readDailyRates(day,db)).find(q=>q.currency==='CNY')?.id,result.quote.id);
 assert.equal(await db.supplierPaymentPlanEvent.count({where:{planId:p.id,action:'DAILY_RATE_CONFIRMED'}}),1);
 assert.ok(await db.workdayNotification.count({where:{userId:b.id}})>0);
 await assert.rejects(confirmDailyRate({...command,fingerprint:preview.fingerprint},a.id,db,readEvidence),/изменил/);
 assert.equal(await db.procurementDailyRate.count({where:{id:result.quote.id}}),1);
});
test('new payment, changed request, new matching request and concurrent confirmation reject stale preview',async()=>{
 const {a,make}=await fixture();const p=await make();
 let preview=await previewDailyRate({...command,rate:15},db,readEvidence);
 overrides.set(p.id,{paidAmount:1});
 await assert.rejects(confirmDailyRate({...command,rate:15,fingerprint:preview.fingerprint},a.id,db,readEvidence),/изменил/);overrides.delete(p.id);
 preview=await previewDailyRate({...command,rate:15},db,readEvidence);await db.supplierPaymentPlan.update({where:{id:p.id},data:{condition:'changed'}});
 await assert.rejects(confirmDailyRate({...command,rate:15,fingerprint:preview.fingerprint},a.id,db,readEvidence),/изменил/);
 preview=await previewDailyRate({...command,rate:15},db,readEvidence);await make();
 await assert.rejects(confirmDailyRate({...command,rate:15,fingerprint:preview.fingerprint},a.id,db,readEvidence),/изменил/);
 preview=await previewDailyRate({...command,rate:15},db,readEvidence);
 const results=await Promise.allSettled([confirmDailyRate({...command,rate:15,fingerprint:preview.fingerprint},a.id,db,readEvidence),confirmDailyRate({...command,rate:15,fingerprint:preview.fingerprint},a.id,db,readEvidence)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
});
test('authorization and source failure produce no writes',async()=>{
 const {b}=await fixture(),preview=await previewDailyRate(command,db,readEvidence);const count=await db.procurementDailyRate.count();
 await assert.rejects(confirmDailyRate({...command,fingerprint:preview.fingerprint},b.id,db,readEvidence),/Нет права/);
 await assert.rejects(confirmDailyRate({...command,fingerprint:preview.fingerprint},b.id,db,async()=>{throw Error('source unavailable');}),/source unavailable/);
 assert.equal(await db.procurementDailyRate.count(),count);
});
test('exact additive migration preserves existing money and relations; constraints enforce currency/rate',async()=>{
 const stop=new Error('rollback');
 await assert.rejects(db.$transaction(async tx=>{
  const schema='daily_rate_migration_'+randomUUID().replaceAll('-','');
  await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
  await tx.$executeRawUnsafe('CREATE TABLE "User" (id INTEGER PRIMARY KEY)');await tx.$executeRawUnsafe('INSERT INTO "User" VALUES (1)');
  await tx.$executeRawUnsafe('CREATE TABLE "SupplierPaymentPlan" (id TEXT,amount DECIMAL(18,2),"expenseRef" TEXT)');
  await tx.$executeRawUnsafe(`INSERT INTO "SupplierPaymentPlan" VALUES ('old',28500,'unchanged')`);
  const before=await tx.$queryRawUnsafe('SELECT * FROM "SupplierPaymentPlan"');
  const sql=await readFile('prisma/migrations/20261105193000_procurement_daily_rates/migration.sql','utf8');
  for(const statement of sql.split(';').filter(s=>s.trim()))await tx.$executeRawUnsafe(statement);
  assert.deepEqual(await tx.$queryRawUnsafe('SELECT * FROM "SupplierPaymentPlan"'),before);
  await tx.$executeRawUnsafe(`INSERT INTO "ProcurementDailyRate" (id,day,currency,rate,revision,"actorUserId",snapshot) VALUES ('valid','2026-11-05','USDT',90,1,1,'{}')`);
  assert.equal((await tx.$queryRawUnsafe<any[]>('SELECT * FROM "ProcurementDailyRate"')).length,1);
  for(const [id,currency,rate,revision,actor] of [['bad-rate','USDT',0,2,1],['bad-currency','RUB',90,2,1],['bad-actor','CNY',14,1,999],['duplicate','USDT',90,1,1]]){
   await tx.$executeRawUnsafe('SAVEPOINT invalid_quote');
   await assert.rejects(tx.$executeRawUnsafe(`INSERT INTO "ProcurementDailyRate" (id,day,currency,rate,revision,"actorUserId",snapshot) VALUES ($1,'2026-11-05',$2,$3,$4,$5,'{}')`,id,currency,rate,revision,actor));
   await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT invalid_quote');
  }
  throw stop;
 }),e=>e===stop);
});


test('overview reads the latest revision per currency even without requests, excludes future days and does not rewrite exact-day lookup',async()=>{
 const stop=Error('ROLLBACK_OVERVIEW');
 await assert.rejects(db.$transaction(async tx=>{
  const actor=await tx.user.create({data:{login:randomUUID(),name:'Overview test',passwordHash:'NO_LOGIN',role:'ADMIN',portalArea:'PROCUREMENT'}});
  const make=(day:string,currency:string,rate:number,revision=1)=>tx.procurementDailyRate.create({data:{day:new Date(day),currency,rate,revision,actorUserId:actor.id,snapshot:{}}});
  await make('1899-01-01','USDT',80);await make('1899-01-02','USDT',81);await make('1899-01-02','USDT',82,2);
  await make('1899-01-01','CNY',12);await make('1899-01-04','CNY',14);
  const before=await tx.supplierPaymentPlan.count();
  const rows=await readDailyRateOverview('1899-01-03',tx);
  assert.deepEqual(rows.map(q=>[q.currency,q.rate,q.day]),[['USDT',82,'1899-01-02'],['CNY',12,'1899-01-01']]);
  assert.deepEqual(await readDailyRates('1899-01-03',tx),[]);
  assert.deepEqual(await readDailyRateOverview('1898-12-31',tx),[]);
  await assert.rejects(readDailyRateOverview('invalid',tx));
  assert.equal(await tx.supplierPaymentPlan.count(),before);
  throw stop;
 }),e=>e===stop);
});
