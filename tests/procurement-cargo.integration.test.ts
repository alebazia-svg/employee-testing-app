import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../lib/prisma';
import {createCargoPayment} from '../lib/procurement-cargo-create';
import {PROCUREMENT_CARGO} from '../lib/procurement-cargo';
import type {freshEvidence} from '../lib/procurement-plan-revision-server';
if(process.env.DATABASE_URL!=='postgresql://postgres@127.0.0.1:55439/procurement_receipts_current_test')throw Error('ISOLATED_RECEIPT_TEST_DATABASE_REQUIRED');
test.after(()=>prisma.$disconnect());
test('isolated PostgreSQL: delivery uses the common plan/audit, and retry cannot duplicate it',async()=>{
 const user=await prisma.user.create({data:{name:'Астемир Тохов',oneCManagerName:'Тохов Астемир',login:'cargo-test-'+randomUUID(),passwordHash:'NO_LOGIN',role:'EMPLOYEE',portalArea:'PROCUREMENT'}});
 const payload={paymentPurpose:'DELIVERY',supplierPartner:PROCUREMENT_CARGO.supplierPartner,orderRefs:[],orderNumbers:[],plannedDate:'2026-10-12',plannedAmount:1,foreignAmount:1000,exchangeRate:13.6,paymentMethod:'CNY'};
 // Only the read-only evidence boundary is stubbed; no 1C call or push sender.
 const read:typeof freshEvidence=async()=>Object.assign(new Map(),{versions:new Map()});
 const response=await createCargoPayment(payload,user,read);
 assert.equal(response.status,201);const created=await response.json();
 const stored=await prisma.supplierPaymentPlan.findUniqueOrThrow({where:{id:created.id},include:{events:true}});
 assert.equal(stored.paymentPurpose,'DELIVERY');assert.deepEqual(stored.orderRefs,[]);
 assert.equal(stored.supplierCounterparty,PROCUREMENT_CARGO.supplierCounterparty);
 assert.equal(Number(stored.plannedAmount),13600);assert.equal(stored.status,'SUBMITTED');
 assert.equal(stored.events.length,1);assert.equal(stored.events[0].action,'SUBMITTED');
 assert.equal((await createCargoPayment(payload,user,read)).status,409);
 assert.equal(await prisma.supplierPaymentPlan.count({where:{managerUserId:user.id}}),1);
 // Keep the isolated audit trail, but do not leave test requests active.
 await prisma.supplierPaymentPlan.update({where:{id:created.id},data:{status:'CANCELLED'}});
 const exchange=await createCargoPayment({...payload,paymentMethod:'USDT',foreignAmount:100,exchangeRate:89.5,fundingSource:'CASH_EXCHANGE'},user,read);
 assert.equal(exchange.status,201);
 const exchangeBody=await exchange.json();
 const storedExchange=await prisma.supplierPaymentPlan.findUniqueOrThrow({where:{id:exchangeBody.id},include:{events:true}});
 assert.equal(storedExchange.fundingSource,'CASH_EXCHANGE');
 assert.equal(Number(storedExchange.plannedAmount),8950);
 assert.equal((storedExchange.events[0].snapshot as {fundingSource:string}).fundingSource,'CASH_EXCHANGE');
 await prisma.supplierPaymentPlan.update({where:{id:exchangeBody.id},data:{status:'CANCELLED'}});
});
