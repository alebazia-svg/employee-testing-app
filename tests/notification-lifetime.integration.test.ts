import assert from 'node:assert/strict';
import test from 'node:test';
import { prisma } from '../lib/prisma';
import { loadEmployeeNotifications } from '../lib/employee-notification-snapshot';
import { employeeInboxSections } from '../lib/employee-inbox-view';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import webpush from 'web-push';

function assertIsolatedDatabase() {
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55519');
  assert.equal(url.pathname, '/notification_lifetime_test');
}

test('isolated database: expiry, read-only preview, opened old action and actual completion retain identities/read evidence', { skip: process.env.NOTIFICATION_LIFETIME_INTEGRATION !== '1' }, async () => {
  assertIsolatedDatabase();
  const prefix = `lifetime-${Date.now()}`;
  const user = await prisma.user.create({ data: { login: prefix, name: 'Тест уведомлений', passwordHash: 'unused', role: 'EMPLOYEE' } });
  const old = new Date(Date.now() - 40 * 86400000);
  const expired = new Date(Date.now() - 24 * 3600000 - 60000);
  const fresh = new Date(Date.now() - 24 * 3600000 + 60000);
  try {
    const issue = await prisma.workdayControlIssue.create({ data: { userId: user.id, fingerprint: prefix, ruleKey: 'test', severity: 'warning', title: 'Исправьте ошибку', detail: 'Тестовая задача', employeeActionRequired: true } });
    const notice = (suffix: string, sentAt: Date, extra = {}) => prisma.workdayNotification.create({ data: { userId: user.id, fingerprint: `${prefix}:${suffix}`, kind: 'workday_shift_extension', title: suffix, body: 'Неизменяемый текст', status: 'sent', scheduledAt: sentAt, sentAt, pushStatus: 'retry_pending', nextPushAttemptAt: new Date(), ...extra } });
    const info = await notice('expired', expired);
    const recent = await notice('fresh', fresh);
    const action = await notice('action', old, { kind: 'issue_detected', issueId: issue.id, readAt: old });
    const priorRead = await notice('read', expired, { readAt: expired });
    const before = await prisma.workdayNotification.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } });
    const preview = await loadEmployeeNotifications(user, true);
    assert.deepEqual(await prisma.workdayNotification.findMany({ where: { userId: user.id }, orderBy: { id: 'asc' } }), before, 'preview must not write statuses or read markers');
    const sections = employeeInboxSections(preview.notifications.map(n => ({ ...n, sentAt: n.sentAt?.toISOString(), readAt: n.readAt?.toISOString() })));
    assert.deepEqual(new Set(sections.fresh.map(n => n.id)), new Set([recent.id, action.id]));
    assert.deepEqual(new Set(sections.history.map(n => n.id)), new Set([info.id, priorRead.id]));
    const actual = await loadEmployeeNotifications(user);
    assert.deepEqual(actual, preview, 'employee and read-only preview project identical lists');
    const saved = await prisma.workdayNotification.findUniqueOrThrow({ where: { id: info.id } });
    assert.equal(saved.status, 'cancelled');
    assert.equal(saved.pushStatus, 'cancelled');
    assert.equal(saved.nextPushAttemptAt, null);
    assert.equal(saved.readAt, null);
    assert.equal(saved.fingerprint, info.fingerprint);
    assert.equal(saved.sentAt!.getTime(), info.sentAt!.getTime());
    assert.equal(saved.body, info.body);
    assert.equal((await prisma.workdayNotification.findUniqueOrThrow({ where: { id: priorRead.id } })).readAt!.getTime(), expired.getTime());
    await prisma.workdayControlIssue.update({ where: { id: issue.id }, data: { status: 'resolved', employeeActionRequired: false } });
    assert.equal(employeeInboxSections((await loadEmployeeNotifications(user)).notifications.map(n => ({ ...n, sentAt: n.sentAt?.toISOString(), readAt: n.readAt?.toISOString() }))).fresh.some(n => n.id === action.id), false);
    const completed = await prisma.workdayNotification.findUniqueOrThrow({ where: { id: action.id } });
    assert.equal(completed.status, 'cancelled');
    assert.equal(completed.issueId, issue.id);
    assert.equal(completed.readAt!.getTime(), old.getTime());
    assert.equal(await prisma.workdayNotification.count({ where: { userId: user.id } }), 4, 'nothing is deleted');
    await prisma.workdayControlIssue.update({ where: { id: issue.id }, data: { status: 'open', employeeActionRequired: true } });
    await prisma.workdayNotification.update({ where: { id: action.id }, data: { status: 'sent' } });
    await prisma.workdayNotification.createMany({ data: Array.from({ length: 205 }, (_, i) => ({ userId: user.id, fingerprint: `${prefix}:history:${i}`, kind: 'workday_shift_extension', title: 'История', body: 'История', status: 'sent', sentAt: new Date(), readAt: new Date(), scheduledAt: new Date() })) });
    const crowded = await loadEmployeeNotifications(user, true);
    assert.equal(crowded.notifications.find(n => n.id === action.id)?.actionRequired, true, 'recent history cannot displace an unfinished old action');
  } finally {
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});

test('isolated dispatcher: expired info cannot retry; opened unfinished work remains in the push badge without resending it', { skip: process.env.NOTIFICATION_LIFETIME_INTEGRATION !== '1' }, async () => {
  assertIsolatedDatabase();
  const prefix = `dispatch-lifetime-${Date.now()}`;
  const user = await prisma.user.create({ data: { login: prefix, name: 'Тест отправки', passwordHash: 'unused', role: 'EMPLOYEE' } });
  const now = new Date('2026-11-08T09:00:00Z');
  const old = new Date(now.getTime() - 40 * 86400000);
  const expired = new Date(now.getTime() - 86400000);
  const originalSend = webpush.sendNotification, originalConfigure = webpush.setVapidDetails;
  const originalPublic = process.env.WEB_PUSH_VAPID_PUBLIC_KEY, originalPrivate = process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
  const delivered: { notificationId: number; badgeCount: number }[] = [];
  const noop = async () => undefined;
  // Exercise the actual dispatcher and real persistence, isolating unrelated
  // producers and replacing the provider so no person receives a test push.
  const mocks: Record<string, unknown> = {
    './workday-handover-review-server': { syncClosedHandoverReviews: noop },
    './workday-extension': { syncWorkdayExtensionProposal: noop },
    './cash-inventory-reconciliation': { reconcileCashInventoryIssues: noop },
    './cash-expense-reconciliation': { reconcileCashExpenseEvidence: noop },
    './schedule-coverage-reconciliation': { queueScheduleFillQuestions: noop },
    './workday-end-notifications': { queueWorkdayEndReminders: noop, activeWorkdayEndReminders: async () => new Set() },
    '@/lib/procurement-delivery-notifications': { DELIVERY_READY_KIND: 'procurement_delivery_ready', queueDeliveryReadyPush: noop },
    '@/lib/procurement-cash-issue-notifications': { queueCashIssuePush: noop },
    './employee-expense-notifications': { queueEmployeeExpensePushes: noop },
    '@/lib/procurement-collection-notifications': { COLLECTION_READY_KIND: 'procurement_collection_ready', queueCollectionReadyPush: noop },
    '@/lib/procurement-morning-notifications': { queueCashMorningPushes: noop },
    '@/lib/prisma': { prisma }, './prisma': { prisma },
  };
  try {
    process.env.WEB_PUSH_VAPID_PUBLIC_KEY = 'test'; process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'test';
    webpush.setVapidDetails = () => undefined;
    webpush.sendNotification = async (_subscription, payload) => { delivered.push(JSON.parse(String(payload))); return { statusCode: 201, body: '', headers: {} }; };
    await prisma.workdayPushSubscription.create({ data: { userId: user.id, endpoint: `https://test.invalid/${prefix}`, p256dh: 'test', auth: 'test' } });
    const issue = await prisma.workdayControlIssue.create({ data: { userId: user.id, fingerprint: prefix, ruleKey: 'test', severity: 'warning', title: 'Задача', detail: 'Тест', employeeActionRequired: true } });
    const base = { userId: user.id, title: 'Тест', body: 'Тест', scheduledAt: now };
    const stale = await prisma.workdayNotification.create({ data: { ...base, fingerprint: `${prefix}:expired`, kind: 'workday_shift_extension', status: 'sent', sentAt: expired, pushStatus: 'no_subscription', nextPushAttemptAt: now } });
    await prisma.workdayNotification.create({ data: { ...base, fingerprint: `${prefix}:action`, kind: 'issue_detected', issueId: issue.id, status: 'sent', sentAt: old, readAt: old, pushStatus: 'delivered' } });
    const fresh = await prisma.workdayNotification.create({ data: { ...base, fingerprint: `${prefix}:fresh`, kind: 'workday_shift_extension' } });
    const output = await build({ stdin: { contents: "export {dispatchDueWorkdayNotifications} from './lib/workday-notifications';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external', plugins: [{ name: 'isolated-dispatcher', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
    const mod = { exports: {} as { dispatchDueWorkdayNotifications(now: Date): Promise<unknown> } };
    const require = createRequire(import.meta.url);
    new Function('require', 'module', 'exports', output.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), mod, mod.exports);
    await mod.exports.dispatchDueWorkdayNotifications(now);
    assert.deepEqual(delivered.map(n => n.notificationId), [fresh.id]);
    assert.equal(delivered[0].badgeCount, 2);
    const saved = await prisma.workdayNotification.findUniqueOrThrow({ where: { id: stale.id } });
    assert.equal(saved.status, 'cancelled'); assert.equal(saved.nextPushAttemptAt, null); assert.equal(saved.readAt, null);
  } finally {
    webpush.sendNotification = originalSend; webpush.setVapidDetails = originalConfigure;
    if (originalPublic === undefined) delete process.env.WEB_PUSH_VAPID_PUBLIC_KEY; else process.env.WEB_PUSH_VAPID_PUBLIC_KEY = originalPublic;
    if (originalPrivate === undefined) delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY; else process.env.WEB_PUSH_VAPID_PRIVATE_KEY = originalPrivate;
    await prisma.user.delete({ where: { id: user.id } });
    await prisma.$disconnect();
  }
});
