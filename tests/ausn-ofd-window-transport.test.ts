import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlatforma, platformaExportWindows } from '../lib/ausn-ofd';

function dto(kkt: string, index: number, date: string) {
  return { fiscal: { driveNumber: kkt, documentNumber: index + 1, sign: index + 100 }, kkt: { registrationNumber: kkt }, receiptAt: `${date}T09:00:00Z`, operationType: 1, receiptCode: 3, money: { totalKopecks: 12345, cashKopecks: 10000, electronicKopecks: 2345, creditKopecks: 0, prepaidKopecks: 0 }, items: [] };
}

test('weekly export windows cover every Moscow calendar day once, including a leap boundary', () => {
  const windows = platformaExportWindows('2026-10-01', '2026-10-31');
  assert.deepEqual(windows.map(w => [w.from, w.toExclusive]), [['2026-10-01','2026-10-08'],['2026-10-08','2026-10-15'],['2026-10-15','2026-10-22'],['2026-10-22','2026-10-29'],['2026-10-29','2026-11-01']]);
  assert.deepEqual(platformaExportWindows('2028-02-27','2028-03-01'), [{ from: '2028-02-27', toExclusive: '2028-03-02' }]);
  assert.deepEqual(platformaExportWindows('2026-12-31','2026-12-31'), [{ from: '2026-12-31', toExclusive: '2027-01-01' }]);
});

test('all KKT/windows are read with at most two in flight and retain deterministic receipt order', async () => {
  const savedFetch = globalThis.fetch, savedBase = process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL = 'http://ofd.test';
  let active = 0, maxActive = 0; const calls: URL[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    if (url.pathname.endsWith('/kkts')) return Response.json({ data: { kkts: [{ registrationNumber: '111' },{ registrationNumber: '222' }] } });
    calls.push(url); active++; maxActive = Math.max(maxActive, active);
    const from = url.searchParams.get('from')!, to = url.searchParams.get('to')!;
    assert.ok(from.endsWith('+03:00') && to.endsWith('+03:00'));
    assert.ok(Date.parse(to) - Date.parse(from) <= 7 * 86400000);
    const n = calls.length - 1;
    await new Promise(resolve => setTimeout(resolve, n % 2 ? 1 : 8)); active--;
    return Response.json({ meta: { complete: true }, data: { receipts: [dto(url.searchParams.get('kktRegNumber')!, n, from.slice(0,10))] } });
  };
  try {
    const result = await loadPlatforma('2026-10-01','2026-10-31');
    assert.equal(result.complete, true); assert.equal(calls.length, 10); assert.equal(maxActive, 2);
    assert.equal(result.receipts.length, 10); assert.equal(result.kkts, 2);
    assert.deepEqual(result.receipts.map(r => r.fiscalDocumentNumber), Array.from({length:10},(_,i)=>String(i+1)));
    assert.equal(result.receipts[0].totalSum,123.45);
    assert.deepEqual(new Set(calls.map(u => u.searchParams.get('kktRegNumber'))),new Set(['111','222']));
  } finally { globalThis.fetch = savedFetch; if(savedBase===undefined) delete process.env.PLATFORMA_OFD_PROXY_BASE_URL; else process.env.PLATFORMA_OFD_PROXY_BASE_URL=savedBase; }
});

test('a malformed receipt in a single window prevents completeness without dropping the other windows', async () => {
  const savedFetch=globalThis.fetch,savedBase=process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://ofd.test'; let reads=0;
  globalThis.fetch=async input=>{
    const u=new URL(String(input));
    if(u.pathname.endsWith('/kkts')) return Response.json({data:{kkts:[{registrationNumber:'111'}]}});
    const n=reads++;
    return Response.json({meta:{complete:true},data:{receipts:[n===1?{}:dto('111',n,u.searchParams.get('from')!.slice(0,10))]}});
  };
  try { const r=await loadPlatforma('2026-10-01','2026-10-20');assert.equal(reads,3);assert.equal(r.complete,false);assert.equal(r.errors.length,1);assert.equal(r.receipts.length,2); }
  finally { globalThis.fetch=savedFetch;if(savedBase===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=savedBase; }
});

test('an incomplete upstream window is retried and never becomes a complete empty export', async () => {
  const savedFetch=globalThis.fetch,savedBase=process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://ofd.test';let reads=0;
  globalThis.fetch=async input=>{
    if(String(input).endsWith('/kkts'))return Response.json({data:{kkts:[{registrationNumber:'111'}]}});
    reads++;return Response.json({meta:{complete:false},data:{receipts:[]}}, {status:503});
  };
  try {const r=await loadPlatforma('2026-10-01','2026-10-01');assert.equal(reads,3);assert.equal(r.complete,false);assert.equal(r.receipts.length,0);assert.equal(r.errors.length,1);}
  finally {globalThis.fetch=savedFetch;if(savedBase===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=savedBase;}
});

test('provider timeout splits a week into disjoint complete children and discards partial parent rows', async () => {
  const savedFetch=globalThis.fetch,savedBase=process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://ofd.test'; const calls: [string,string][]=[];
  globalThis.fetch=async input=>{
    const u=new URL(String(input));
    if(u.pathname.endsWith('/kkts'))return Response.json({data:{kkts:[{registrationNumber:'111'}]}});
    const from=u.searchParams.get('from')!.slice(0,10),to=u.searchParams.get('to')!.slice(0,10);
    calls.push([from,to]);
    if(from==='2026-10-01' && to==='2026-10-08') return Response.json({error:{code:'OFD_PROVIDER_TIMEOUT'},meta:{complete:false},data:{receipts:[dto('111',999,from)]}},{status:504});
    return Response.json({meta:{complete:true},data:{receipts:[dto('111',calls.length,from)]}});
  };
  try {
    const r=await loadPlatforma('2026-10-01','2026-10-07');
    assert.equal(r.complete,true);assert.equal(r.receipts.length,2);assert.deepEqual(r.errors,[]);
    assert.deepEqual(calls,[['2026-10-01','2026-10-08'],['2026-10-01','2026-10-04'],['2026-10-04','2026-10-08']]);
    assert.ok(r.receipts.every(r=>r.fiscalDocumentNumber!=='1000'));
  } finally {globalThis.fetch=savedFetch;if(savedBase===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=savedBase;}
});

test('a single-day provider timeout remains incomplete after bounded retries', async () => {
  const savedFetch=globalThis.fetch,savedBase=process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://ofd.test';let reads=0;
  globalThis.fetch=async input=>{
    if(String(input).endsWith('/kkts'))return Response.json({data:{kkts:[{registrationNumber:'111'}]}});
    reads++;return Response.json({error:{code:'OFD_PROVIDER_TIMEOUT'},meta:{complete:false},data:{receipts:[]}},{status:504});
  };
  try { const r=await loadPlatforma('2026-10-01','2026-10-01');assert.equal(reads,3);assert.equal(r.complete,false);assert.equal(r.errors.length,1); }
  finally {globalThis.fetch=savedFetch;if(savedBase===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=savedBase;}
});
