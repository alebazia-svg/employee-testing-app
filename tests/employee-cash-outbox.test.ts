import assert from 'node:assert/strict';
import test from 'node:test';
import { saveEmployeeCashOutboxItem, listEmployeeCashOutboxItems, removeEmployeeCashOutboxItem, type EmployeeCashOutboxItem } from '../lib/employee-cash-outbox';

test('outbox acknowledges commit, never provisional request success', async (t) => {
  for (const operation of ['save', 'list', 'remove'] as const) {
    for (const outcome of ['complete', 'error', 'abort', 'request-error', 'throw'] as const) {
      await t.test(`${operation}: ${outcome}`, async () => {
        const failure = new Error('storage failure');
        const request: any = { result: operation === 'list' ? [] : undefined, error: failure };
        const transaction: any = { error: failure, abort() {}, objectStore() {
          if (outcome === 'throw') throw failure;
          return { put: () => request, getAll: () => request, delete: () => request };
        } };
        let closed = false;
        const database = { transaction: () => transaction, close() { closed = true; } };
        const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
        Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: {
          open() {
            const opening: any = { result: database };
            queueMicrotask(() => opening.onsuccess());
            return opening;
          },
        } });
        try {
          const promise = operation === 'save' ? saveEmployeeCashOutboxItem({} as EmployeeCashOutboxItem)
            : operation === 'list' ? listEmployeeCashOutboxItems() : removeEmployeeCashOutboxItem('id');
          let settled = false;
          void promise.then(() => { settled = true; }, () => { settled = true; });
          await new Promise<void>((resolve) => setImmediate(resolve));
          if (outcome !== 'throw') {
            request.onsuccess?.();
            await Promise.resolve();
            assert.equal(settled, false, 'request success must not acknowledge persistence');
            if (outcome === 'request-error') request.onerror();
            else transaction[`on${outcome}`]();
          }
          if (outcome === 'complete') assert.equal(await promise, request.result);
          else await assert.rejects(promise, failure);
          assert.equal(closed, true);
        } finally {
          if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
          else Reflect.deleteProperty(globalThis, 'indexedDB');
        }
      });
    }
  }
});
