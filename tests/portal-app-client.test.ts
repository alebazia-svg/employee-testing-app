import test from 'node:test';
import assert from 'node:assert/strict';
import { mocked } from './portal-access-routes.test';

test('blocked session storage does not hide the actually loaded version', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const priorVersion = process.env.NEXT_PUBLIC_APP_VERSION, priorDate = process.env.NEXT_PUBLIC_APP_BUILT_AT;
  process.env.NEXT_PUBLIC_APP_VERSION = '1.4.10'; process.env.NEXT_PUBLIC_APP_BUILT_AT = '2026-10-10T10:00:00Z';
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get: () => { throw Error('blocked'); } });
  try {
    const module = await mocked('lib/portal-app-client.ts', {});
    const first = module.appClientObservation(), second = module.appClientObservation();
    assert.equal(first.version, '1.4.10');
    assert.equal(first.state, 'storage_failed');
    assert.equal(first.clientId, second.clientId);
    assert.match(first.clientId, /^[0-9a-f-]{36}$/);
  } finally {
    if (original) Object.defineProperty(globalThis, 'sessionStorage', original); else Reflect.deleteProperty(globalThis, 'sessionStorage');
    if (priorVersion === undefined) delete process.env.NEXT_PUBLIC_APP_VERSION; else process.env.NEXT_PUBLIC_APP_VERSION = priorVersion;
    if (priorDate === undefined) delete process.env.NEXT_PUBLIC_APP_BUILT_AT; else process.env.NEXT_PUBLIC_APP_BUILT_AT = priorDate;
  }
});
