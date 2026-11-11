import assert from 'node:assert/strict';
import test from 'node:test';
import { getCashShifts } from '../lib/one-c';
import { loadOneCKkmChecks, loadPlatformaOfdReceipts } from '../lib/terminal-fiscal-sources';

test('ordinary source success does not imply reliable negative evidence when payloads lack arrays, coverage or pagination', async () => {
  const keys = ['1C_BASE_URL', '1C_API_USER', '1C_API_PASSWORD', 'PLATFORMA_OFD_PROXY_BASE_URL'];
  const before = keys.map(k => process.env[k]); const fetch = global.fetch;
  const date = '2026-11-10', period = { from: date + 'T00:00:00+03:00', to: '2026-11-11T00:00:00+03:00' };
  try {
    keys.forEach(k => process.env[k] = 'http://127.0.0.1:1');
    let body: any;
    global.fetch = async () => Response.json(body);
    body = { ok: true, date_from: date, date_to: date, shifts: [], warnings: [] };
    assert.equal((await getCashShifts(date)).complete, true);
    for (const value of [{ ...body, shifts: undefined }, { ...body, ok: false }, { ...body, date_from: '2026-11-09' }, { ...body, warnings: ['partial'] }, { ...body, shifts: new Array(300).fill({}) }]) {
      body = value; assert.notEqual((await getCashShifts(date)).complete, true);
    }
    body = { ok: true, checks: [], pagination: { has_more: false } };
    assert.equal((await loadOneCKkmChecks({ fromDate: date, toDate: '2026-11-11' })).absenceComplete, true);
    for (const value of [{ ok: true }, { ok: true, checks: [] }, { ok: true, checks: [], pagination: { has_more: 'false' } }]) {
      body = value; assert.notEqual((await loadOneCKkmChecks({ fromDate: date, toDate: '2026-11-11' })).absenceComplete, true);
    }
    const valid = { data: { receipts: [] }, meta: { complete: true, fetchedAt: new Date().toISOString(), warnings: [], period: { fromUtc: period.from, toUtc: period.to, semantics: '[from,to)' } } };
    body = valid; assert.equal((await loadPlatformaOfdReceipts({ ...period, kktRegistrationNumber: 'kkt' })).absenceComplete, true);
    for (const value of [{ meta: valid.meta }, { ...valid, meta: { ...valid.meta, period: {} } }, { ...valid, meta: { ...valid.meta, fetchedAt: '2026-11-10T00:00:00Z' } }]) {
      body = value; assert.notEqual((await loadPlatformaOfdReceipts({ ...period, kktRegistrationNumber: 'kkt' })).absenceComplete, true);
    }
  } finally { global.fetch = fetch; keys.forEach((k, i) => { if (before[i] === undefined) delete process.env[k]; else process.env[k] = before[i]; }); }
});
