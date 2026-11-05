import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {PrismaClient} from '@prisma/client';
import {prepareShareManifest} from '../lib/procurement-share-manifest';
if(process.env.DATABASE_URL!=='postgresql://postgres@127.0.0.1:55467/payment_documents_test')throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaClient();test.after(()=>db.$disconnect());
test('real PostgreSQL: exact two-plan document binding; preparation never changes financial rows or events',async()=>{
 const rollback=Error('ROLLBACK_TEST_FIXTURE');
 await assert.rejects(db.$transaction(async tx=>{
  const admin=await tx.user.create({data:{login:randomUUID(),name:'SHARE TEST',passwordHash:'NO_LOGIN',role:'ADMIN',portalArea:'PROCUREMENT'}});
  const plans=await Promise.all(['CNY','USDT'].map((paymentMethod,i)=>tx.supplierPaymentPlan.create({data:{planCode:randomUUID(),managerUserId:admin.id,supplierPartner:'SHARE TEST '+i,orderRefs:[],orderNumbers:[],plannedDate:new Date('2026-11-05'),plannedAmount:1000,foreignAmount:i?20:10,paymentMethod,condition:'isolated test',status:'APPROVED'}})));
  const docs=await Promise.all(plans.map((p,i)=>tx.supplierPaymentReceipt.create({data:{planId:p.id,authorUserId:admin.id,originalName:'same.png',storageKey:randomUUID()+'.png',mimeType:'image/png',size:100,sha256:String(i+1).repeat(64),purpose:'QR'}})));
  const selection=plans.map(p=>({id:p.id,version:p.updatedAt.toISOString()}));
  const evidence=Object.assign(new Map(plans.map(p=>[p.id,{state:'NO_EVIDENCE'}])),{versions:new Map(selection.map(s=>[s.id,s.version]))});
  const before=await tx.supplierPaymentPlan.findMany({where:{id:{in:plans.map(p=>p.id)}},orderBy:{id:'asc'}});
  const bundle=await prepareShareManifest(tx,admin,[...selection].reverse(),async()=>evidence);
  assert.deepEqual(bundle.entries.map(e=>[e.id,e.files[0].id,e.amount]),[[plans[1].id,docs[1].id,20],[plans[0].id,docs[0].id,10]]);
  assert.deepEqual(await tx.supplierPaymentPlan.findMany({where:{id:{in:plans.map(p=>p.id)}},orderBy:{id:'asc'}}),before);
  assert.equal(await tx.supplierPaymentPlanEvent.count({where:{planId:{in:plans.map(p=>p.id)}}}),0);
  await tx.supplierPaymentReceipt.update({where:{id:docs[0].id},data:{revision:{increment:1}}});
  await assert.rejects(prepareShareManifest(tx,admin,[...selection].reverse(),async()=>evidence,bundle.stamp),/изменились/);
  throw rollback;
 },{timeout:15000}),e=>e===rollback);
});
