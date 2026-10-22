import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {readBuyerDisplay,writeBuyerDisplay,validBuyerDisplayRecord} from '../lib/procurement-buyer-display-cache';
test('presentation cache isolates base/user/manager/bucket and does not regress on a slow older read',async t=>{
  const old={...process.env};t.after(()=>{process.env=old;});
  process.env.PROCUREMENT_PLANNING_CACHE_DIR=await mkdtemp(path.join(tmpdir(),'buyer-display-test-'));
  process.env['1C_BASE_URL']='https://test.invalid';process.env['1C_API_USER']='test';
  const now=Date.now();
  await Promise.all([writeBuyerDisplay('1:Astemir','balances',{balance:100},now),writeBuyerDisplay('1:Astemir','balances',{balance:50},now-1000)]);
  assert.deepEqual((await readBuyerDisplay('1:Astemir','balances'))?.data,{balance:100});
  assert.equal(await readBuyerDisplay('2:Other','balances'),null);
  assert.equal(await readBuyerDisplay('1:Changed','balances'),null);
  assert.equal(await readBuyerDisplay('1:Astemir','planning'),null);
  process.env['1C_BASE_URL']='https://another.invalid';assert.equal(await readBuyerDisplay('1:Astemir','balances'),null);
});
test('corrupt, expired and future display records are rejected',()=>{
  const now=Date.now(),record={schema:1,scope:'u',bucket:'balances',startedAt:now,savedAt:new Date(now).toISOString(),data:{}};
  assert.equal(validBuyerDisplayRecord(record,'u','balances',now),true);
  for(const row of [null,{}, {...record,schema:2},{...record,scope:'other'},{...record,startedAt:now+120000},{...record,savedAt:'bad'},{...record,savedAt:new Date(now-8*86400000).toISOString()}])assert.equal(validBuyerDisplayRecord(row,'u','balances',now),false);
});
