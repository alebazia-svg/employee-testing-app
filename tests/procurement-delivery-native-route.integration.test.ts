import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { PrismaClient } from '@prisma/client';
import { DELIVERY_PERSON, DELIVERY_SOURCE, DELIVERY_OPEN, DELIVERY_REQUEST_SOURCE } from '../lib/procurement-delivery-policy';
import * as native from '../lib/procurement-delivery-native';
import * as requestHelpers from '../lib/procurement-delivery-request';

test('real DB: ADMIN-only link, fresh preview, concurrency, unique native document, unlink audit and rollback', { skip: !process.env.PROCUREMENT_TEST_DATABASE_URL }, async () => {
  assert.equal(process.env.PROCUREMENT_TEST_DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/delivery_integration_20260927');
  const db = new PrismaClient({ datasources: { db: { url: process.env.PROCUREMENT_TEST_DATABASE_URL } } });
  const sourceTypes = [DELIVERY_SOURCE, DELIVERY_REQUEST_SOURCE, native.DELIVERY_LINK_SOURCE];
  assert.equal(await db.adminInboxEvent.count({ where: { sourceType: { in: sourceTypes } } }), 0);
  const details = { amount: 15000, comment: 'Local test', requestedAt: new Date().toISOString(), checkedAt: new Date().toISOString(), balance: 100 };
  let authStatus = 200, available = true;
  const candidate: native.DeliveryNativeCandidate = { quote: 'preview-v1', status: { ref: '11111111-2222-3333-4444-555555555555', number: 'test', date: '2026-09-28', state: 'payable', amount: 15000, issued: 0, remaining: 15000, cashbox: 'Касса тест', desiredDate: null, checkedAt: new Date().toISOString() } };
  let activeId = '';
  const seed = async () => {
    const e = await db.adminInboxEvent.create({ data: { eventKey: `test-native:${crypto.randomUUID()}`, type: DELIVERY_OPEN, sourceType: DELIVERY_SOURCE, sourceId: DELIVERY_PERSON.ref, title: 'test', body: 'test', href: '/admin/expense-requests#delivery', occurredAt: new Date() } });
    activeId = e.id;
    await db.adminInboxEvent.create({ data: { eventKey: requestHelpers.deliveryDetailsKey(e.id), sourceType: DELIVERY_REQUEST_SOURCE, sourceId: DELIVERY_PERSON.ref, type: 'procurement.delivery_request_details', title: 'test', body: JSON.stringify({ version: 1, ...details }), href: '/admin/expense-requests#delivery', occurredAt: new Date() } });
    return e.id;
  };
  const mocks: Record<string, any> = {
    '@/lib/admin-api-auth': { requireAdminApi: async () => authStatus === 200 ? { ok: true, user: { id: 1 } } : { ok: false, response: new Response(null, { status: authStatus }) } },
    '@/lib/prisma': { prisma: db },
    '@/lib/procurement-delivery-policy': { DELIVERY_PERSON, DELIVERY_SOURCE, DELIVERY_OPEN },
    '@/lib/procurement-delivery-native': native,
    '@/lib/procurement-delivery-request': requestHelpers,
    '@/lib/procurement-delivery-native-source': { deliveryNativeCandidates: async (_d: unknown, _day: unknown, fresh: boolean) => { if (!available) throw Error('private source'); return [candidate]; } },
    '@/lib/procurement-delivery-reminders': { deliveryMappedUser: async () => ({ id: 2 }), activeDeliveryRequest: async () => ({ id: activeId, details }), loadDeliveryView: async () => ({ nativeRequest: { state: 'unlinked' } }) },
  };
  try {
    await seed();
    const output = await build({ entryPoints: ['app/api/admin/procurement/delivery-request/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', plugins: [{ name: 'mocks', setup(b) { b.onResolve({ filter: /^@\/lib\// }, a => ({ path: a.path, external: true })); } }] });
    const module = { exports: {} as any };
    new Function('require', 'module', 'exports', output.outputFiles[0].text)((name: string) => mocks[name], module, module.exports);
    const route = module.exports;
    const post = (patch: any = {}, origin = 'http://local.test') => route.POST(new Request('http://local.test/api/admin/procurement/delivery-request', { method: 'POST', headers: { origin }, body: JSON.stringify({ action: 'link', reminderId: activeId, ref: candidate.status.ref, quote: candidate.quote, ...patch }) }));
    for (const code of [401, 403]) { authStatus = code; assert.equal((await post()).status, code); assert.equal((await route.GET(new Request('http://local.test'))).status, code); }
    authStatus = 200;
    assert.equal((await post({}, 'http://foreign.test')).status, 403);
    assert.equal((await post({ quote: 'old-preview' })).status, 409);
    available = false; assert.equal((await post()).status, 409); available = true;
    const before = await db.adminInboxEvent.count();
    const attempts = await Promise.all([post(), post()]); assert.deepEqual(attempts.map(r => r.status).sort(), [200, 409]);
    assert.equal(await db.adminInboxEvent.count(), before + 2, 'one state and one immutable audit, no duplicate');
    let link = await db.adminInboxEvent.findUniqueOrThrow({ where: { eventKey: native.deliveryLinkKey(activeId) } });
    assert.equal(native.readDeliveryLink(link.body).ref, candidate.status.ref);
    assert.equal(await db.adminInboxReceipt.count({ where: { eventId: link.id } }), 0, 'link is not a new approval notification');
    const first = activeId; await seed();
    assert.equal((await post()).status, 409, 'same native document cannot fund a second portal request');
    activeId = first;
    assert.equal((await post({ action: 'unlink' })).status, 409, 'superseded cycle cannot be edited');
    // Point to the current cycle for an independent link/unlink check.
    const latest = await db.adminInboxEvent.findFirstOrThrow({ where: { sourceType: DELIVERY_SOURCE }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
    activeId = latest.id; candidate.status.ref = '11111111-2222-3333-4444-666666666666';
    assert.equal((await post()).status, 200);
    assert.equal((await post({ action: 'unlink' })).status, 200);
    link = await db.adminInboxEvent.findUniqueOrThrow({ where: { eventKey: native.deliveryLinkKey(activeId) } });
    assert.equal(link.type, 'procurement.delivery_native_unlinked');
    assert.equal((await post()).status, 200, 'explicit re-link after undo works');
  } finally {
    await db.adminInboxEvent.deleteMany({ where: { sourceType: { in: sourceTypes } } });
    await db.$disconnect();
  }
});
