import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { taxAlertLogins } from '../lib/tax-document-reminders';
import { eligibleAdminInboxWebPushTypes } from '../lib/admin-inbox-web-push-policy';

test('tax attention alerts go only to the configured logins and never to Telegram', () => {
  assert.deepEqual(taxAlertLogins({ TAX_CONTROL_ALERT_LOGINS: ' bela , ' }), ['bela']);
  assert.deepEqual(taxAlertLogins({}), []);
  const source = readFileSync(new URL('../lib/tax-document-reminders.ts', import.meta.url), 'utf8');
  const attention = source.slice(source.indexOf('export async function syncTaxAttentionReminders'));
  assert.ok(!attention.slice(0, attention.indexOf('\n}\n')).includes('queueAdminInboxTelegramDelivery'));
  assert.ok(attention.includes("login: { in: logins }"));
});

test('tax attention alerts are pushed only in daytime hours', () => {
  assert.ok(eligibleAdminInboxWebPushTypes(new Date('2026-10-29T07:00:00Z')).includes('tax.figures_stale'));
  assert.ok(!eligibleAdminInboxWebPushTypes(new Date('2026-10-29T02:00:00Z')).includes('tax.figures_stale'));
});
