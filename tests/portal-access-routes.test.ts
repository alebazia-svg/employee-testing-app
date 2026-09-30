import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

async function mocked(entry: string, mocks: Record<string, unknown>) {
  const result = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', jsx: 'automatic', plugins: [{ name: 'mock', setup(b) {
    b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined);
  } }] });
  const mod = { exports: {} as any }; const require = createRequire(import.meta.url);
  new Function('require', 'module', 'exports', result.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
  return mod.exports;
}
test('activity requires authenticated same-origin caller, bounded data and server-owned identity', async () => {
  const recorded: any[] = []; let user: any = null, failed = false;
  const route = await mocked('app/api/auth/activity/route.ts', {
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'server-cookie' }) }) },
    '@/lib/auth': { getCurrentUser: async () => user },
    '@/lib/portal-access-journal': { parsePushObservation: (p: any) => p.permission === 'unknown' && !p.userId ? p : null,
      recordPortalAccess: async (p: any) => { if (failed) throw Error('private'); recorded.push(p); } },
  });
  const post = (site = 'same-origin', body: unknown = { permission: 'unknown' }) => route.POST(new Request('https://portal.invalid/api/auth/activity', { method: 'POST', headers: { 'sec-fetch-site': site, 'user-agent': 'test' }, body: JSON.stringify(body) }));
  assert.equal((await post()).status, 401);
  user = { id: 42, role: 'EMPLOYEE' };
  for (const site of ['cross-site', 'same-site', 'none', '']) assert.equal((await post(site)).status, 403);
  assert.equal((await post('same-origin', { permission: 'unknown', userId: 1 })).status, 400);
  assert.equal((await post('same-origin', { permission: 'unknown', value: 'x'.repeat(6000) })).status, 400);
  assert.equal(recorded.length, 0);
  assert.equal((await post()).status, 200); assert.equal(recorded[0].userId, 42); assert.equal(recorded[0].token, 'server-cookie');
  failed = true; const response = await post(); assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /private/);
});
test('login still succeeds if journal is unavailable; it records no failed login or password', async () => {
  const written: any[] = [], recorded: any[] = []; let passwordValid = false;
  process.env.PORTAL_SESSION_SECRET = 'test-only-session-secret-with-at-least-32-characters';
  const warn = console.warn; console.warn = () => {};
  try {
    const route = await mocked('app/api/auth/login/route.ts', {
      '@/lib/prisma': { prisma: { user: { findUnique: async () => ({ id: 42, role: 'EMPLOYEE', portalArea: 'PROCUREMENT', isActive: true, passwordHash: 'test-hash' }) } } },
      'bcryptjs': { compare: async () => passwordValid },
      'next/headers': { cookies: async () => ({ set: (...args: any[]) => written.push(args), delete: () => {} }) },
      '@/lib/portal-access-journal': { recordPortalAccess: async (p: any) => { recorded.push(p); throw Error('offline'); } },
    });
    const post = () => route.POST(new Request('https://portal.invalid/api/auth/login', { method: 'POST', body: JSON.stringify({ login: 'test', password: 'never-log-me' }) }));
    assert.equal((await post()).status, 401); assert.equal(recorded.length, 0);
    passwordValid = true; assert.equal((await post()).status, 200); assert.equal(written.length, 1);
    assert.equal(recorded[0].login, true); assert.doesNotMatch(JSON.stringify(recorded), /never-log-me|test-hash/);
  } finally { console.warn = warn; }
});
test('ADMIN page authorizes before journal reads and never selects auth hashes or push keys', async () => {
  let user: any = null; const queries: any[] = [];
  const route = await mocked('app/(dashboard)/admin/employees/access/page.tsx', {
    'next/link': () => null,
    'next/navigation': { redirect: (path: string) => { throw Error(`redirect:${path}`); } },
    'react/jsx-runtime': { jsx: (...args: any[]) => args, jsxs: (...args: any[]) => args },
    '@/lib/auth': { getCurrentUser: async () => user },
    '@/lib/prisma': { prisma: { portalAccessSession: { findMany: async (q: any) => { queries.push(q); return []; } } } },
    '@/components/AdminShell': { AdminShell: () => null },
    '@/components/admin/AdminPageHeader': { AdminPageHeader: () => null },
    '@/components/PortalAccessDevices': { PortalAccessDevices: () => null },
  });
  const page = () => route.default({ searchParams: Promise.resolve({ q: 'Астемир', page: '1' }) });
  await assert.rejects(page(), /redirect:\/login/); user = { id: 42, role: 'EMPLOYEE' };
  await assert.rejects(page(), /redirect:\/employee/); assert.equal(queries.length, 0);
  user.role = 'ADMIN'; await page(); assert.equal(queries.length, 1);
  assert.doesNotMatch(JSON.stringify(queries[0].select), /sessionHash|endpoint|p256dh|password|auth/);
  assert.equal(queries[0].take, undefined);
  assert.equal(queries[0].where.loggedOutAt, null);
  assert.equal(queries[0].where.user.isActive, true);
  assert.ok(queries[0].where.expiresAt.gt instanceof Date);
  await route.default({ searchParams: Promise.resolve({ q: 'Safari', page: '2', view: 'history' }) });
  assert.equal(queries[1].take, 51);
  assert.equal(queries[1].skip, 50);
  assert.equal(queries[1].where.OR[3].browser.contains, 'Safari');
  assert.equal(queries[1].where.loggedOutAt, undefined);
});
