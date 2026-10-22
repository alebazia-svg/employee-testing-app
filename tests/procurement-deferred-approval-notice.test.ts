import test from 'node:test';
import assert from 'node:assert/strict';
import {notifyProcurementManagerAboutDecision} from '../lib/procurement-payment-notifications';

test('approval notice respects unknown and later funding dates without changing ordinary decisions',async()=>{
  const notices:any[]=[];
  const db={workdayNotification:{updateMany:async()=>({count:0}),upsert:async(args:any)=>{notices.push(args.create);}}} as any;
  const plan={id:'test',planCode:'TEST',supplierPartner:'Тест',plannedDate:new Date('2026-10-25'),plannedAmount:100,condition:'',paymentMethod:'USDT',managerUserId:1};
  const deferral=(date:string|null)=>({fundingDeferral:{date,comment:'',actorId:2,changedAt:'2026-10-22T12:00:00Z'}});
  for(const [date,expected] of [[null,'Дата подготовки денег уточняется'],['2026-10-29','к 29 октября'],['2026-10-23','к 25 октября']] as const){
    await notifyProcurementManagerAboutDecision({db,plan:{...plan,oneCCashEvidence:deferral(date)},decision:'APPROVED'});
    assert.equal(notices.at(-1).title,'Оплата согласована');
    assert.ok(notices.at(-1).body.endsWith(expected));
  }
  await notifyProcurementManagerAboutDecision({db,plan,decision:'APPROVED'});
  assert.ok(notices.at(-1).body.endsWith('к 25 октября'));
  await notifyProcurementManagerAboutDecision({db,plan:{...plan,oneCCashEvidence:deferral(null)},decision:'NEEDS_CHANGES',reason:'Проверьте сумму'});
  assert.equal(notices.at(-1).body,'Тест · Проверьте сумму');
});
