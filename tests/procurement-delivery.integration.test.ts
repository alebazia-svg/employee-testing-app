import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { DELIVERY_PERSON, DELIVERY_SOURCE } from '../lib/procurement-delivery-policy';

test('real PostgreSQL: authorization, concurrency, one reminder, partial top-up, recovery and next cycle', { skip: !process.env.PROCUREMENT_TEST_DATABASE_URL }, async () => {
  assert.equal(process.env.PROCUREMENT_TEST_DATABASE_URL, 'postgresql://postgres:local-test-only@127.0.0.1:55437/delivery_integration_20260927');
  const db = new PrismaClient({ datasources: { db: { url: process.env.PROCUREMENT_TEST_DATABASE_URL } } });
  const marker = `delivery-test-${Date.now()}`;
  const existing = await db.user.count({ where: { oneCManagerName: DELIVERY_PERSON.name } });
  assert.equal(existing, 0, 'isolated test needs an unused identity; never overwrite an existing mapping');
  assert.equal(await db.adminInboxEvent.count({ where: { sourceType: DELIVERY_SOURCE } }), 0);
  const buyer = await db.user.create({ data: { name: marker, login: marker, passwordHash: 'not-login', role: 'EMPLOYEE', portalArea: 'PROCUREMENT', oneCManagerName: DELIVERY_PERSON.name } });
  const owner = await db.user.create({ data: { name: marker, login: `${marker}-admin`, passwordHash: 'not-login', role: 'ADMIN' } });
  const state: any = { db, user: null, balance: 2259, failed: false };
  (globalThis as any).deliveryTest = state;
  const mocks: Record<string, string> = {
    auth: 'export const getCurrentUser=async()=>globalThis.deliveryTest.user;',
    prisma: 'export const prisma=globalThis.deliveryTest.db;',
    'procurement-delivery-source': `export async function fetchDeliveryCash(){const s=globalThis.deliveryTest;if(s.failed)throw Error('DELIVERY_SOURCE_UNAVAILABLE');return {balance:s.balance,checkedAt:new Date().toISOString(),lastIssue:null};} export const unavailableDeliveryCash=()=>({balance:null,checkedAt:'',lastIssue:null});`,
  };
  try {
    const output = await build({ stdin: { contents: "export * from './app/api/procurement/delivery/route'; export {syncDeliveryReminder} from './lib/procurement-delivery-reminders';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'isolated', setup(b) {
      b.onResolve({ filter: /^(?:@\/lib\/|\.\/)/ }, args => { const k = args.path.replace(/^@\/lib\/|^\.\//, ''); return mocks[k] ? { path: k, namespace: 'mock' } : null; });
      b.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path] }));
    } }] });
    const module = { exports: {} as any }; new Function('require', 'module', 'exports', output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
    const route = module.exports;
    const post = (origin = 'http://localhost') => route.POST(new Request('http://localhost/api/procurement/delivery', { method: 'POST', headers: { origin } }));
    assert.equal((await route.GET()).status, 401); assert.equal((await post()).status, 401); state.user = owner; assert.equal((await post()).status, 403);
    state.user = buyer; assert.equal((await post('http://other')).status, 403);
    assert.equal((await route.syncDeliveryReminder(false)).requested, true, 'background check works without buyer click');
    // Reverse-proxy request.url can be internal; validate the actual Host instead.
    const proxyPost = () => route.POST(new Request('http://internal:3000/api/procurement/delivery', { method: 'POST', headers: { origin: 'https://portal.example', host: 'portal.example' } }));
    const responses = await Promise.all([post(), post(), proxyPost()]); assert.ok(responses.every(r => r.status === 200));
    let events = await db.adminInboxEvent.findMany({ where: { sourceType: DELIVERY_SOURCE } }); assert.equal(events.length, 1);
    const first = events[0]; assert.equal(await db.adminInboxReceipt.count({ where: { eventId: first.id, userId: owner.id } }), 1);
    assert.match(first.body, /Низкий остаток/); assert.doesNotMatch(first.body, /Астемир запросил/);
    assert.equal((await (await route.GET()).json()).requested, true);
    state.balance = 25000; await post(); assert.equal(await db.adminInboxEvent.count({ where: { sourceType: DELIVERY_SOURCE } }), 1);
    state.failed = true; assert.equal((await post()).status, 503); assert.equal((await (await route.GET()).json()).snapshot.balance, null); state.failed = false;
    state.balance = 35000; assert.equal((await (await post()).json()).requested, false);
    assert.ok((await db.adminInboxReceipt.findFirstOrThrow({ where: { eventId: first.id, userId: owner.id } })).readAt);
    state.balance = 1000; await post(); events = await db.adminInboxEvent.findMany({ where: { sourceType: DELIVERY_SOURCE } }); assert.equal(events.length, 3);
    assert.equal(events.filter(e => e.type === 'procurement.delivery_requested').length, 2);
  } finally {
    await db.adminInboxEvent.deleteMany({ where: { sourceType: DELIVERY_SOURCE } });
    await db.user.deleteMany({ where: { id: { in: [buyer.id, owner.id] } } });
    await db.$disconnect(); delete (globalThis as any).deliveryTest;
  }
});
