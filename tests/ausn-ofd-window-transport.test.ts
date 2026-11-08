import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPlatforma, platformaExportWindows } from '../lib/ausn-ofd';

function dto(kkt: string, index: number, date: string) {
  return { fiscal: { driveNumber: kkt, documentNumber: index + 1, sign: index + 100 }, kkt: { registrationNumber: kkt }, receiptAt: `${date}T09:00:00Z`, operationType: 1, receiptCode: 3, money: { totalKopecks: 12345, cashKopecks: 10000, electronicKopecks: 2345, creditKopecks: 0, prepaidKopecks: 0 }, items: [] };
}

test('daily windows cover every Moscow calendar day once, including leap and year boundaries', () => {
  const windows = platformaExportWindows('2026-10-01', '2026-10-31');
  assert.equal(windows.length,31);
  assert.equal(windows[0].from,'2026-10-01');
  assert.equal(windows.at(-1)!.toExclusive,'2026-11-01');
  windows.forEach((w,i)=>{
    assert.equal(Date.parse(w.toExclusive)-Date.parse(w.from),86400000);
    if(i)assert.equal(windows[i-1].toExclusive,w.from);
  });
  assert.equal(platformaExportWindows('2028-02-27','2028-03-01').length,4);
  assert.deepEqual(platformaExportWindows('2026-12-31','2026-12-31'),[{from:'2026-12-31',toExclusive:'2027-01-01'}]);
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
    assert.ok(Date.parse(to) - Date.parse(from) === 86400000);
    const n = calls.length - 1;
    await new Promise(resolve => setTimeout(resolve, n % 2 ? 1 : 8)); active--;
    return Response.json({ meta: { complete: true }, data: { receipts: [dto(url.searchParams.get('kktRegNumber')!, n, from.slice(0,10))] } });
  };
  try {
    const result = await loadPlatforma('2026-10-01','2026-10-31');
    assert.equal(result.complete, true); assert.equal(calls.length, 62); assert.equal(maxActive, 2);
    assert.equal(result.receipts.length, 62); assert.equal(result.kkts, 2);
    assert.deepEqual(result.receipts.map(r => r.fiscalDocumentNumber), Array.from({length:62},(_,i)=>String(i+1)));
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
  try { const r=await loadPlatforma('2026-10-01','2026-10-03');assert.equal(reads,3);assert.equal(r.complete,false);assert.equal(r.errors.length,1);assert.equal(r.receipts.length,2); }
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

test('only the timed-out day is split, all half-day receipts are required and malformed success stays incomplete', async () => {
  const savedFetch=globalThis.fetch,savedBase=process.env.PLATFORMA_OFD_PROXY_BASE_URL;
  process.env.PLATFORMA_OFD_PROXY_BASE_URL='http://ofd.test';
  try {
    for (const malformed of [false,true]) {
      const calls: string[][]=[];
      globalThis.fetch=async input=>{
        const u=new URL(String(input));
        if(u.pathname.endsWith('/kkts'))return Response.json({data:{kkts:[{registrationNumber:'111'}]}});
        const start=u.searchParams.get('from')!,end=u.searchParams.get('to')!;calls.push([start,end]);
        if(Date.parse(end)-Date.parse(start)===86400000)return Response.json({error:{code:'OFD_PROVIDER_TIMEOUT',retryable:true}},{status:504});
        if(malformed&&start.includes('12:00:00'))return Response.json({meta:{complete:true},data:{}});
        const receipt=dto('111',calls.length,start.slice(0,10));receipt.receiptAt=new Date(Date.parse(start)+1000).toISOString();
        return Response.json({meta:{complete:true},data:{receipts:[receipt]}});
      };
      const result=await loadPlatforma('2026-08-13','2026-08-13');
      assert.equal(calls.length,3);assert.equal(result.complete,!malformed);
      assert.deepEqual(calls, [['2026-08-13T00:00:00+03:00','2026-08-14T00:00:00+03:00'],['2026-08-13T00:00:00+03:00','2026-08-13T12:00:00+03:00'],['2026-08-13T12:00:00+03:00','2026-08-14T00:00:00+03:00']]);
      assert.equal(result.receipts.length,malformed?1:2);
      assert.equal(result.errors.length,malformed?1:0);
    }
  } finally {globalThis.fetch=savedFetch;if(savedBase===undefined)delete process.env.PLATFORMA_OFD_PROXY_BASE_URL;else process.env.PLATFORMA_OFD_PROXY_BASE_URL=savedBase;}
});
