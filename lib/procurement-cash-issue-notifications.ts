import 'server-only';
import { prisma } from './prisma';
import { loadDeliveryView } from './procurement-delivery-reminders';
import { deliveryNativeFresh } from './procurement-delivery-native';
import { getMoscowDateKey } from './workday';
import { employeePushNotBefore } from './employee-push-policy';
import { CASH_ISSUE_KIND, CASH_ISSUE_PUSH_COPY, cashIssueKey, cashIssuePermission, cashIssueCompactCopy } from './procurement-cash-issue-policy';

export type CashIssueState = { state: 'unknown' | 'inactive'; checkedAt: string }
  | { state: 'waiting_shift'; userId: number; fingerprint: string; checkedAt: string }
  | { state: 'ready'; userId: number; fingerprint: string; title: string; body: string;
      request: NonNullable<ReturnType<typeof cashIssuePermission>>; checkedAt: string };
let cached: { until: number; value: Promise<CashIssueState> } | null = null;
export async function currentCashIssue(now = new Date(), fresh = false): Promise<CashIssueState> {
  if (!fresh && cached && cached.until > Date.now()) return cached.value;
  const value = readCashIssue(now).catch((): CashIssueState => ({ state: 'unknown', checkedAt: now.toISOString() }));
  cached = { until: Date.now() + 5000, value };
  return value;
}
async function readCashIssue(now: Date): Promise<CashIssueState> {
  const view = await loadDeliveryView({ freshNative: true });
  const native = view.nativeRequest, status = native?.status;
  const checkedAt = status?.checkedAt ?? now.toISOString();
  if (!view.requestStateAvailable || native?.state === 'unavailable' || native?.reviewReason
    || status && (!deliveryNativeFresh(status, now.getTime()) || status.state === 'review')) return { state: 'unknown', checkedAt };
  if (native?.state !== 'linked' || !status) return { state: 'inactive', checkedAt };
  const request = cashIssuePermission(status, now);
  if (!request) return { state: status.canCollect === true ? 'unknown' : 'inactive', checkedAt };
  // No surname guessing and no broadcasting to every employee with a shared till.
  const owners = await prisma.userOneCCashboxMapping.findMany({
    where: { oneCCashboxRef: request.cashboxRef, isActive: true, user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] } } },
    select: { userId: true }, take: 2,
  });
  if (owners.length !== 1) return { state: 'unknown', checkedAt };
  const userId = owners[0].userId;
  // Actual start/finish of today's workday, not merely a planned schedule or
  // yesterday's unclosed shift. Financial source state remains unchanged.
  const shift = await prisma.workDayEntry.findFirst({
    where: { userId, date: getMoscowDateKey(now), status: 'active', endedAt: null, startedAt: { lte: now } },
    select: { id: true },
  });
  if (!shift) return { state: 'waiting_shift', userId, fingerprint: cashIssueKey(status, userId), checkedAt };
  return { state: 'ready', userId, fingerprint: cashIssueKey(status, userId), request, checkedAt,
    title: cashIssueCompactCopy(request).title,
    body: `${request.recipient} · ${request.cashbox} · Заявка № ${request.number}` };
}

/** Existing minute sender produces the task. GET never creates notifications. */
export async function queueCashIssuePush(now = new Date()) {
  const current = await currentCashIssue(now, true);
  if (current.state === 'unknown') return;
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106257)`;
    // A slow read must not undo a more recent assignment/dispatch.
    if (await tx.workdayNotification.findFirst({ where: { kind: CASH_ISSUE_KIND, updatedAt: { gt: new Date(current.checkedAt) } }, select: { id: true } })) return;
    await tx.workdayNotification.updateMany({ where: { kind: CASH_ISSUE_KIND, status: { not: 'cancelled' },
      ...(current.state === 'ready' ? { fingerprint: { not: current.fingerprint } } : {}),
    }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
    if (current.state !== 'ready') return;
    const scheduledAt = employeePushNotBefore(now);
    const row = await tx.workdayNotification.upsert({ where: { fingerprint: current.fingerprint }, update: {}, create: {
      userId: current.userId, kind: CASH_ISSUE_KIND, fingerprint: current.fingerprint, ...CASH_ISSUE_PUSH_COPY, scheduledAt, nextPushAttemptAt: scheduledAt,
    } });
    // Reassignment, a new active shift or a reversed RKO re-open the same notification.
    // Cancelling a notification never closes the underlying financial request.
    if (row.status === 'cancelled') await tx.workdayNotification.updateMany({ where: { id: row.id, status: 'cancelled' }, data: {
      status: 'pending', pushStatus: 'pending', readAt: null, sentAt: null, pushDeliveredAt: null,
      attemptCount: 0, lastError: '', scheduledAt, nextPushAttemptAt: scheduledAt,
    } });
  });
}
export async function cashIssuePushDecision(notification: { fingerprint: string; userId: number }, now = new Date()) {
  const current = await currentCashIssue(now, true);
  if (current.state === 'unknown') return { state: 'defer' as const, until: new Date(now.getTime() + 60_000) };
  if (current.state === 'waiting_shift' && current.userId === notification.userId && current.fingerprint === notification.fingerprint) return { state: 'defer' as const, until: new Date(now.getTime() + 60_000) };
  if (current.state !== 'ready' || current.userId !== notification.userId || current.fingerprint !== notification.fingerprint) return { state: 'cancel' as const };
  const until = employeePushNotBefore(now);
  return until > now ? { state: 'defer' as const, until } : { state: 'send' as const, ...CASH_ISSUE_PUSH_COPY };
}
