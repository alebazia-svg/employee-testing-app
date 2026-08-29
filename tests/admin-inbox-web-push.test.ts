import assert from 'node:assert/strict';
import test from 'node:test';
import { ADMIN_INBOX_PUSH_READ_GRACE_MS, getAdminInboxPushReadGraceCutoff } from '../lib/admin-inbox-web-push';

test('a quickly read admin inbox event remains eligible for web push delivery', () => {
  const now = new Date('2026-08-29T18:40:00.000Z');
  assert.equal(ADMIN_INBOX_PUSH_READ_GRACE_MS, 30 * 60 * 1000);
  assert.equal(getAdminInboxPushReadGraceCutoff(now).toISOString(), '2026-08-29T18:10:00.000Z');
});
