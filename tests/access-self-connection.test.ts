import test from 'node:test';
import assert from 'node:assert/strict';
import { mocked } from './portal-access-routes.test';

test('self connection authorizes first and reads only its own browser cookie', async () => {
  let user: { name: string; role: string } | null = null;
  let cookieReads = 0;
  let value: string | undefined = '12345678-1234-4234-8234-123456789abc';
  const page = await mocked('app/connection/page.tsx', {
    'next/link': () => null,
    'react/jsx-runtime': { jsx: (type: unknown, props: unknown) => ({ type, props }), jsxs: (type: unknown, props: unknown) => ({ type, props }) },
    'next/headers': { cookies: async () => { cookieReads++; return { get: (name: string) => { assert.equal(name, 'mobo_access_browser'); return { value }; } }; } },
    'next/navigation': { redirect: () => { throw Error('REDIRECT'); } },
    '@/lib/auth': { getCurrentUser: async () => user, portalHomePath: () => '/procurement' },
  });
  await assert.rejects(page.default(), /REDIRECT/);
  assert.equal(cookieReads, 0);
  user = { name: 'Закупщик', role: 'EMPLOYEE' };
  const result = JSON.stringify(await page.default());
  assert.match(result, /12345678-1234-4234-8234-123456789abc/);
  assert.match(result, /Закупщик/);
  assert.doesNotMatch(result, /offonika_session|ownerUserId|sessionId/);
  value = undefined;
  assert.match(JSON.stringify(await page.default()), /Код пока не получен/);
});
