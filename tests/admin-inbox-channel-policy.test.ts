import assert from 'node:assert/strict';
import test from 'node:test';
import { isAdminInboxTelegramEnabled } from '../lib/admin-inbox';

test('portal admin events do not duplicate PWA pushes in Telegram by default', () => {
  assert.equal(isAdminInboxTelegramEnabled({}), false);
  assert.equal(isAdminInboxTelegramEnabled({ ADMIN_INBOX_TELEGRAM_ENABLED: '0' }), false);
});

test('Telegram duplication requires an explicit emergency override', () => {
  assert.equal(isAdminInboxTelegramEnabled({ ADMIN_INBOX_TELEGRAM_ENABLED: '1' }), true);
});
