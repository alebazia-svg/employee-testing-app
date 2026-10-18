import test from 'node:test';
import assert from 'node:assert/strict';
import { isCurrentAccessBrowser } from '../lib/portal-access-identity';

test('current browser requires the exact valid request cookie, not similar or missing identities', () => {
  const bella = '12345678-1234-4234-8234-123456789abc';
  const aslan = '12345678-1234-4234-8234-123456789abd';
  assert.equal(isCurrentAccessBrowser(bella, bella), true);
  assert.equal(isCurrentAccessBrowser(aslan, bella), false);
  for (const invalid of [null, undefined, '', 'Mac', '203.0.113.1', 'admin', 'Mac Беллы']) {
    assert.equal(isCurrentAccessBrowser(invalid, invalid), false);
    assert.equal(isCurrentAccessBrowser(bella, invalid), false);
  }
});
