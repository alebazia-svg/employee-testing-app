import test from 'node:test';
import assert from 'node:assert/strict';
import {createInFlightRead} from '../lib/procurement-inflight-read';

test('overlapping identical reads issue one call, isolate consumers, and never cache completion', async () => {
  const read = createInFlightRead<{rows: number[]}>();
  let release!: () => void, calls = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const source = async () => { calls++; await gate; return {rows:[1]}; };
  const first = read('scope-A/query',source), second = read('scope-A/query',source);
  await Promise.resolve(); assert.equal(calls,1);
  release(); const [a,b] = await Promise.all([first,second]);
  a.rows.push(2); assert.deepEqual(b.rows,[1]);
  await read('scope-A/query',source); assert.equal(calls,2);
});
test('failures are shared only in flight; retry and other scopes are independent', async () => {
  const read=createInFlightRead<number>(); let calls=0;
  const fail=async()=>{calls++;throw Error('timeout');};
  const failed=await Promise.allSettled([read('A',fail),read('A',fail)]);
  assert.ok(failed.every(r=>r.status==='rejected'));assert.equal(calls,1);
  assert.equal(await read('A',async()=>7),7);
  assert.deepEqual(await Promise.all([read('A',async()=>1),read('B',async()=>2)]),[1,2]);
});
