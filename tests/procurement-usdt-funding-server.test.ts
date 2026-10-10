import test from 'node:test';
import assert from 'node:assert/strict';
import type {Prisma} from '@prisma/client';
import {assertFundingBalance,readFundingBalance} from '../lib/procurement-usdt-funding-server';
import type {freshEvidence} from '../lib/procurement-plan-revision-server';
const at=new Date('2026-10-10T12:00:00Z');
const plan={id:'other',updatedAt:at,status:'SUBMITTED',paymentMethod:'USDT',fundingSource:'WALLET',foreignAmount:60,plannedAmount:5400};
const request={paymentMethod:'USDT',fundingSource:'WALLET',foreignAmount:50};
const evidence=Object.assign(new Map(),{versions:new Map([['other',at.toISOString()]])}) as Awaited<ReturnType<typeof freshEvidence>>;
function tx(rows:unknown[]){return {supplierPaymentPlan:{findMany:async()=>rows}} as unknown as Prisma.TransactionClient;}
test('server refuses cumulative overbooking even if each request alone fits',async()=>{
  await assert.rejects(assertFundingBalance(tx([plan]),[request],100,evidence),/Недостаточно/);
  await assert.rejects(assertFundingBalance(tx([]),[request,request],99,evidence),/Недостаточно/);
  await assert.doesNotReject(assertFundingBalance(tx([plan]),[request],110,evidence));
});
test('exchange does not consume balance and does not request a live wallet read',async()=>{
  await assert.doesNotReject(assertFundingBalance(tx([{...plan,fundingSource:'CASH_EXCHANGE'}]),[request],50,evidence));
  assert.equal(await readFundingBalance([{...request,fundingSource:'CASH_EXCHANGE'}]),null);
});
test('unknown balance and unquantified legacy reserve cannot authorize wallet',async()=>{
  await assert.rejects(assertFundingBalance(tx([]),[request],null,evidence),/Недостаточно/);
  await assert.rejects(assertFundingBalance(tx([{...plan,foreignAmount:null,fundingSource:null}]),[request],999999,evidence),/Недостаточно/);
});
test('only matching-version paid evidence releases a reservation',async()=>{
  const paid=Object.assign(new Map([['other',{state:'PAID_BY_ONE_C',remainingAmount:0,remainingForeignAmount:0}]]),{versions:new Map([['other',at.toISOString()]])}) as Awaited<ReturnType<typeof freshEvidence>>;
  await assert.doesNotReject(assertFundingBalance(tx([plan]),[request],50,paid));
  paid.versions.set('other','stale');
  await assert.rejects(assertFundingBalance(tx([plan]),[request],50,paid),/Недостаточно/);
});
