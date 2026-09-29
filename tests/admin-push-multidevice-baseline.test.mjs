import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const route = await readFile(new URL('../app/api/admin/push-subscription/route.ts', import.meta.url), 'utf8');
const bell = await readFile(new URL('../components/AdminInboxBell.tsx', import.meta.url), 'utf8');
const postHandler = route.split('export async function POST')[1].split('export async function DELETE')[0];

test('registering one admin device never disables another active device', () => {
  assert.doesNotMatch(postHandler, /workdayPushSubscription\.updateMany/);
  assert.doesNotMatch(postHandler, /shouldDisableOtherAdminPushSubscriptions/);
  assert.match(postHandler, /disabledAt: registrationMode === 'legacy-disabled' \? now : null/);
});

test('every permitted admin device refreshes its own push subscription', () => {
  assert.match(bell, /void connectPush\(false\)/);
  assert.match(bell, /body: JSON\.stringify\(subscription\)/);
  assert.doesNotMatch(bell, /currentPwaClientMode/);
});
