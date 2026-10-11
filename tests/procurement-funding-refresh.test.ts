import test from 'node:test';
import assert from 'node:assert/strict';
import {fundingRefreshState} from '../lib/procurement-funding-refresh';
const base={hasSnapshot:true,sameDay:true,complete:true,current:true,pending:false,failed:false,upstream:'ready' as const};
test('normal source refresh is not a data failure',()=>{
  assert.equal(fundingRefreshState(base),'ready');
  assert.equal(fundingRefreshState({...base,upstream:'loading'}),'refreshing');
  assert.equal(fundingRefreshState({...base,current:false,pending:true}),'refreshing');
  assert.equal(fundingRefreshState({...base,pending:true}),'refreshing');
});
test('failed, incomplete, previous-day and unpaired snapshots remain visibly stale',()=>{
  for(const change of [{failed:true},{complete:false},{sameDay:false},{hasSnapshot:false},{current:false},{upstream:'error' as const}])
    assert.equal(fundingRefreshState({...base,...change}),'stale');
  assert.equal(fundingRefreshState({...base,pending:true,failed:true}),'stale');
  assert.equal(fundingRefreshState({...base,pending:true,sameDay:false}),'stale');
});
