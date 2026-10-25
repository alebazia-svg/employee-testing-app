import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeOneCDateTime } from '../lib/terminal-fiscal-one-c-adapter';
import { normalizeOneCCheck } from '../lib/terminal-fiscal-sources';

test('normalizes production 1C Russian and compact dates as Europe/Moscow', () => {
  assert.equal(normalizeOneCDateTime('09.08.2026 13:15:30'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('20260809131530'), '2026-08-09T10:15:30.000Z');
});

test('normalizes a production 1C Russian date with a one-digit hour', () => {
  assert.equal(normalizeOneCDateTime('10.08.2026 9:22:08'), '2026-08-10T06:22:08.000Z');
});

test('keeps stable cashier ref and name from the production /kkm-checks DTO', () => {
  const check = normalizeOneCCheck({
    sourceRef: 'check-1', sourceDocumentType: 'sale_check', operationType: 'sale', date: '09.08.2026 13:15:30',
    cashRegister: { ref: 'kkm-1', name: 'ККМ 1' }, cashier: { ref: 'cashier-milana', name: 'Чеченова Милана' },
    amountKopecks: 10000, electronicKopecks: 10000, cardPayments: [], items: [], fiscalState: 'unconfirmed',
  }, new Map());
  assert.deepEqual(check?.cashier, { ref: 'cashier-milana', name: 'Чеченова Милана' });
});

test('preserves explicit offsets and rejects invalid dates', () => {
  assert.equal(normalizeOneCDateTime('2026-08-09T10:15:30.000Z'), '2026-08-09T10:15:30.000Z');
  assert.equal(normalizeOneCDateTime('invalid'), '');
});

import { loadOneCKkmChecks } from '../lib/terminal-fiscal-sources';

test('late-check reads respect the 1C seven-day limit and retain every day exactly once', async () => {
  const originalFetch = globalThis.fetch;
  const keys = ['1C_BASE_URL', '1C_API_USER', '1C_API_PASSWORD'] as const;
  const previous = keys.map(key => process.env[key]);
  const periods: string[][] = [];
  try {
    process.env['1C_BASE_URL'] = 'https://one-c.invalid';
    process.env['1C_API_USER'] = 'test'; process.env['1C_API_PASSWORD'] = 'test';
    globalThis.fetch = async (url) => {
      const query = new URL(String(url)).searchParams;
      const from = query.get('from')!, to = query.get('to')!;
      periods.push([from, to]);
      if (Date.parse(to) - Date.parse(from) > 7 * 86400000) return Response.json({ok:false}, {status:400});
      return Response.json({ok:true, checks:[{sourceRef:from, sourceDocumentType:'sale_check', operationType:'sale', date:from+'T09:00:00+03:00',cardPayments:[],items:[]}],pagination:{has_more:false}});
    };
    const result = await loadOneCKkmChecks({fromDate:'2026-09-07',toDate:'2026-09-16'});
    assert.equal(result.complete, true);
    assert.deepEqual(periods, [['2026-09-07','2026-09-14'],['2026-09-14','2026-09-16']]);
    assert.deepEqual(result.data.map(check => check.sourceRef), ['2026-09-07','2026-09-14']);
    periods.length = 0;
    globalThis.fetch = async (url) => {
      const query = new URL(String(url)).searchParams;
      periods.push([query.get('from')!,query.get('to')!]);
      return periods.length === 2 ? Response.json({ok:false},{status:503}) : Response.json({ok:true,checks:[],pagination:{has_more:false}});
    };
    const incomplete = await loadOneCKkmChecks({fromDate:'2026-09-07',toDate:'2026-09-16'});
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.errorCode, 'ONE_C_REQUEST_FAILED');
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index];});
  }
});


test('preserves fiscal-register time independently of the document date',()=>{
 const raw={sourceRef:'sale',sourceDocumentType:'sale_check',operationType:'sale',date:'25.10.2026 14:24:54',fiscalFactKeys:['fiscal'],cardPayments:[],items:[]};
 const c=normalizeOneCCheck(raw,new Map([['fiscal',{date:'25.10.2026 14:13:00'}]]));
 assert.equal(c?.dateTime,'2026-10-25T11:24:54.000Z');
 assert.equal(c?.fiscalDateTime,'2026-10-25T11:13:00.000Z');
 assert.equal(normalizeOneCCheck(raw,new Map())?.fiscalDateTime,undefined);
});
