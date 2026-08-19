import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdempotencyKey } from '../lib/idempotency-key';

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

test('uses native randomUUID when available', () => {
  const expected = '12345678-1234-4234-9234-123456789abc';
  const key = createIdempotencyKey({
    randomUUID: () => expected,
    getRandomValues: <T extends ArrayBufferView | null>(value: T) => value,
  });
  assert.equal(key, expected);
});

test('creates a server-compatible UUID when randomUUID is unavailable in an older PWA', () => {
  const key = createIdempotencyKey({
    randomUUID: undefined as never,
    getRandomValues: <T extends ArrayBufferView | null>(value: T) => {
      if (value instanceof Uint8Array) value.forEach((_, index) => { value[index] = index + 1; });
      return value;
    },
  });
  assert.match(key, uuidPattern);
  assert.equal(key.length, 36);
});
