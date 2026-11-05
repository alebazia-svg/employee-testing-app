import test from 'node:test';import assert from 'node:assert/strict';
import {requisitesShareAmount,requisitesShareText} from '../lib/procurement-requisites-share';
test('QR takes precedence for sharing; text-only retains amount and recipient instructions',()=>{
 assert.equal(requisitesShareText({amount:7560,currency:'CNY',text:'  alipay-id  ',network:'TRC20',hasFile:true}),`7\u00a0560 CNY`);
 assert.equal(requisitesShareText({amount:2145,currency:'USDT',text:'wallet',network:'TRC20',hasFile:false}),`2\u00a0145 USDT\nTRC20\nwallet`);
 assert.equal(requisitesShareText({amount:20,currency:'CNY',text:'',hasFile:true}),'20 CNY');
 assert.equal(requisitesShareText({amount:20,currency:'USDT',text:'wallet',network:'TRC20',hasFile:true}),'20 USDT');
 assert.throws(()=>requisitesShareText({amount:20,currency:'USDT',text:'wallet',hasFile:false}));
 assert.throws(()=>requisitesShareText({amount:0,currency:'CNY',text:'id',hasFile:false}));
});
test('share only reliable foreign remainder, never derives foreign amount from RUB',()=>{
 const plan={paymentMethod:'CNY',foreignAmount:7560};assert.equal(requisitesShareAmount(plan),null);
 assert.equal(requisitesShareAmount({...plan,evidence:{state:'NO_EVIDENCE',verification:'current'}}),7560);
 for(const state of ['PARTIALLY_PAID_BY_ONE_C']){
 assert.equal(requisitesShareAmount({...plan,evidence:{state,verification:'current',remainingForeignAmount:1000}}),1000);
 assert.equal(requisitesShareAmount({...plan,evidence:{state,verification:'current',issuedAmount:5000}}),null);
 }
 assert.equal(requisitesShareAmount({...plan,evidence:{state:'PARTIALLY_ISSUED',verification:'current',remainingForeignAmount:7560,issuedAmount:5000}}),null);
 assert.equal(requisitesShareAmount({...plan,evidence:{state:'NO_EVIDENCE',verification:'last-confirmed'}}),null);
 assert.equal(requisitesShareAmount({...plan,evidence:{state:'ISSUED_BY_ONE_C',verification:'current',remainingForeignAmount:100}}),null);
});
