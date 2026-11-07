import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { PrismaClient } from '@prisma/client';
import { getMoscowDateKey } from '../lib/workday';
import { shiftScheduleDate } from '../lib/schedule-week-reminder';
import { hasTechnicalWorkdayClose } from '../lib/workday-close-view';
import { workdayEndReminderKey, WORKDAY_END_REMINDER_KIND } from '../lib/workday-end-policy';

const url = process.env.PUSH_ACCESS_TEST_DB ?? '';
test('isolated DB: late attendance close needs only a reason, retains audit, unlocks QR and preserves legacy/current-day closing', {
  skip: !/^postgresql:\/\/postgres:push-sync-local-only@127\.0\.0\.1:\d+\/push_sync_test$/.test(url),
}, async () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const ids: number[] = [], marker = `no-end-time-${randomUUID()}`;
  const mocks: Record<string, unknown> = {
    'server-only': {}, '@/lib/prisma': { prisma: db }, './prisma': { prisma: db },
    '@/lib/terminal-fiscal-handover': { refreshHandoverReceipts: async () => undefined, escalateHandoverReceipts: async () => undefined },
    '@/lib/workday-required-issues': { findOpenRequiredWorkdayIssues: async () => [], serializeRequiredIssue: (value: unknown) => value, findApprovedCloseException: async () => null },
  };
  async function load(entry: string) {
    const compiled = await build({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
      plugins: [{ name: 'isolated-close', setup(b) { b.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, external: true } : undefined); } }] });
    const module = { exports: {} as any }, require = createRequire(import.meta.url);
    new Function('require', 'module', 'exports', compiled.outputFiles[0].text)((name: string) => mocks[name] ?? require(name), module, module.exports);
    return module.exports;
  }
  try {
    const makeUser = async (suffix: string) => {
      const user = await db.user.create({ data: { login: marker + suffix, name: marker + suffix, passwordHash: 'not-a-login', role: 'EMPLOYEE', department: 'procurement', portalArea: 'PROCUREMENT' } });
      ids.push(user.id); return user;
    };
    const owner = await makeUser('a'), other = await makeUser('b');
    let actor = owner;
    mocks['@/lib/auth'] = { getCurrentUser: async () => actor };
    const { POST } = await load('app/api/employee/workday/finish/route.ts');
    const { getEmployeeWorkdaySnapshot } = await load('lib/employee-workday-snapshot.ts');
    const today = getMoscowDateKey(), yesterday = shiftScheduleDate(today, -1);
    const makeDay = (date: string) => db.workDayEntry.create({ data: { userId: owner.id, date, department: 'procurement', shiftCode: 'other', shiftLabel: 'Рабочий день', startedAt: new Date(`${date}T09:00:00+03:00`), status: 'active', comment: 'Существующий комментарий' } });
    const day = await makeDay(yesterday);
    const post = (payload: object) => POST(new Request('http://localhost/api/employee/workday/finish', { method: 'POST', body: JSON.stringify(payload) }));
    const close = { workDayId: day.id, closeStale: true, staleCloseReason: 'no_internet' };
    assert.equal((await post({ workDayId: day.id })).status, 409, 'late closure still requires the explicit reason flow');
    assert.equal((await post({ ...close, staleCloseReason: '' })).status, 400);
    assert.equal((await post({ ...close, staleCloseReason: 'other' })).status, 400);
    assert.equal((await post({ ...close, actualEndedAt: 'bad' })).status, 400, 'supplied legacy timestamps are still validated');
    actor = other; assert.equal((await post(close)).status, 404, 'another employee cannot close this day'); actor = owner;
    const before = await getEmployeeWorkdaySnapshot(owner);
    assert.equal(before.unfinishedWorkDay.id, day.id);
    await db.workdayNotification.create({ data: { userId: owner.id, fingerprint: workdayEndReminderKey(day.id), kind: WORKDAY_END_REMINDER_KIND, title: 'Тест', body: 'Тест', scheduledAt: new Date(), status: 'sent', pushStatus: 'sent' } });
    const lower = Date.now(), response = await post(close), upper = Date.now();
    assert.equal(response.status, 200);
    assert.equal((await response.json()).staleClosed, true);
    const saved = await db.workDayEntry.findUniqueOrThrow({ where: { id: day.id } });
    assert.equal(saved.status, 'completed'); assert.equal(saved.date, day.date); assert.deepEqual(saved.startedAt, day.startedAt);
    assert.ok(saved.endedAt && +saved.endedAt >= lower && +saved.endedAt <= upper, 'stores the real confirmation moment, never a guessed departure');
    assert.match(saved.comment, /Существующий комментарий/); assert.match(saved.comment, /Причина: Не было интернета/);
    assert.match(saved.comment, /Время ухода не зафиксировано/); assert.equal(hasTechnicalWorkdayClose(saved), true);
    assert.doesNotMatch(saved.comment, /Сотрудник указал фактическое окончание/);
    const reminder = await db.workdayNotification.findUniqueOrThrow({ where: { fingerprint: workdayEndReminderKey(day.id) } });
    assert.equal(reminder.status, 'resolved'); assert.equal(reminder.pushStatus, 'cancelled');
    const after = await getEmployeeWorkdaySnapshot(owner);
    assert.equal(after.workDay, null); assert.equal(after.unfinishedWorkDay, null, 'the actual UI snapshot restores the normal QR start condition');
    assert.equal((await post(close)).status, 404);
    assert.deepEqual(await db.workDayEntry.findUniqueOrThrow({ where: { id: day.id } }), saved, 'retry does not rewrite time or history');
    const legacy = await makeDay(shiftScheduleDate(today, -2));
    const legacyTime = `${legacy.date}T18:15`;
    assert.equal((await post({ ...close, workDayId: legacy.id, actualEndedAt: legacyTime })).status, 200);
    const old = await db.workDayEntry.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.equal(old.endedAt?.toISOString(), new Date(`${legacyTime}:00+03:00`).toISOString());
    assert.match(old.comment, /Сотрудник указал фактическое окончание/);
    const current = await makeDay(today);
    const currentLower = Date.now();
    assert.equal((await post({ workDayId: current.id })).status, 200, 'ordinary same-day ending is unchanged');
    const currentUpper = Date.now();
    const normal = await db.workDayEntry.findUniqueOrThrow({ where: { id: current.id } });
    assert.equal(normal.status, 'completed');
    assert.ok(normal.endedAt && +normal.endedAt >= currentLower && +normal.endedAt <= currentUpper, 'same-day checkout still records the exact server time automatically');
    assert.equal(normal.comment, current.comment); assert.equal(hasTechnicalWorkdayClose(normal), false);
  } finally { for (const id of ids) await db.user.delete({ where: { id } }); await db.$disconnect(); }
});
