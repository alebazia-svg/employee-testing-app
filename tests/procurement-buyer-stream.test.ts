import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeBuyerStream,timeoutBuyerStream} from '../lib/procurement-buyer-stream';
test('ready balances render independently; evidence and planning cannot erase another block',()=>{
  const balance={balance:25,checkedAt:'2026-10-22T12:00:00Z',sourceLabel:'Test',error:''};
  let state=mergeBuyerStream(null,{generation:'g',part:'balances',data:{usdtBalance:balance,balancesRefreshing:false}},'g');
  assert.equal(state?.patch.usdtBalance,balance);assert.equal(state?.done.evidence,undefined);
  state=mergeBuyerStream(state,{generation:'g',part:'planning',data:{supplierBalances:{},supplierDebtError:false}},'g');
  state=mergeBuyerStream(state,{generation:'g',part:'evidence',data:null},'g');
  assert.equal(state?.patch.usdtBalance,balance);assert.equal(state?.patch.supplierDebtError,false);
  assert.equal(state?.patch.evidenceSourceError,undefined,'initial conservative evidence guard is not overridden by failure');
});
test('late generations and timeout cannot overwrite a newer refresh',()=>{
  const state=mergeBuyerStream(null,{generation:'new',part:'balances',data:{balancesRefreshing:false}},'new');
  assert.equal(mergeBuyerStream(state,{generation:'old',part:'balances',data:{balancesRefreshing:true}},'new'),state);
  assert.equal(timeoutBuyerStream(state,'new').patch.balancesUnavailable,undefined);
  assert.deepEqual(timeoutBuyerStream(state,'other').patch,{balancesRefreshing:false,balancesUnavailable:true});
});
test('partial failures and timeout preserve the saved values; success can arrive later',()=>{
  const state=timeoutBuyerStream(null,'g');
  const next=mergeBuyerStream(state,{generation:'g',part:'balances',data:{balancesUnavailable:false,balancesRefreshing:false}},'g');
  assert.equal(next?.patch.balancesUnavailable,false);
});
