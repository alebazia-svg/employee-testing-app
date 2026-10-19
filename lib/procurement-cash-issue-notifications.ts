import 'server-only';
import { prisma } from './prisma';
import { loadDeliveryView } from './procurement-delivery-reminders';
import { deliveryNativeFresh } from './procurement-delivery-native';
import { getMoscowDateKey } from './workday';
import { employeePushNotBefore } from './employee-push-policy';
import { CASH_ISSUE_KIND, cashIssueKey, cashIssuePermission, cashIssueCompactCopy, cashIssuePushCopy, cashIssueNotices, cashIssueForUser, type CashIssueState, type CashIssueNotice } from './procurement-cash-issue-policy';
import { DELIVERY_PHONE_RESERVE_REF } from './procurement-delivery-reserve';
export type { CashIssueState } from './procurement-cash-issue-policy';

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
  const notice = (userId: number): CashIssueNotice => ({ userId, fingerprint: cashIssueKey(status, userId), request, checkedAt,
    title: cashIssueCompactCopy(request).title,
    body: `${request.recipient} · ${request.cashbox} · Заявка № ${request.number}` });
  // Owner-approved exception for this exact shared reserve only. Cashbox
  // mappings identify cash managers, not every retail employee or trainee.
  if (request.cashboxRef === DELIVERY_PHONE_RESERVE_REF) {
    const shifts = await prisma.workDayEntry.findMany({
      where: { date: getMoscowDateKey(now), department: 'retail', status: 'active', endedAt: null, startedAt: { lte: now },
        user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: 'retail',
          oneCCashboxMapping: { is: { isActive: true, oneCCashboxRef: { not: '' } } } } },
      select: { userId: true },
    });
    return { state: 'shared', checkedAt, notices: [...new Set(shifts.map(shift => shift.userId))].map(notice) };
  }
  // Personal tills still require one explicit owner; no surname guessing.
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
  return { state: 'ready', ...notice(userId) };
}

/** Existing minute sender produces the task. GET never creates notifications. */
export async function queueCashIssuePush(now = new Date()) {
  const current = await currentCashIssue(now, true);
  if (current.state === 'unknown') return;
  const notices = cashIssueNotices(current);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(73106257)`;
    // A slow read must not undo a more recent assignment/dispatch.
    if (await tx.workdayNotification.findFirst({ where: { kind: CASH_ISSUE_KIND, updatedAt: { gt: new Date(current.checkedAt) } }, select: { id: true } })) return;
    await tx.workdayNotification.updateMany({ where: { kind: CASH_ISSUE_KIND, status: { not: 'cancelled' },
      ...(notices.length ? { fingerprint: { notIn: notices.map(notice => notice.fingerprint) } } : {}),
    }, data: { status: 'cancelled', pushStatus: 'cancelled', nextPushAttemptAt: null } });
    const scheduledAt = employeePushNotBefore(now);
    for (const notice of notices) {
      const row = await tx.workdayNotification.upsert({ where: { fingerprint: notice.fingerprint }, update: {}, create: {
        userId: notice.userId, kind: CASH_ISSUE_KIND, fingerprint: notice.fingerprint, ...cashIssuePushCopy(notice.request), scheduledAt, nextPushAttemptAt: scheduledAt,
      } });
      // Reassignment, a new active shift or a reversed RKO re-open the same notification.
      // Cancelling a notification never closes the underlying financial request.
      if (row.status === 'cancelled') await tx.workdayNotification.updateMany({ where: { id: row.id, status: 'cancelled' }, data: {
        status: 'pending', pushStatus: 'pending', readAt: null, sentAt: null, pushDeliveredAt: null,
        attemptCount: 0, lastError: '', scheduledAt, nextPushAttemptAt: scheduledAt,
      } });
    }
  });
}
export async function cashIssuePushDecision(notification: { fingerprint: string; userId: number }, now = new Date()) {
  const current = await currentCashIssue(now, true);
  if (current.state === 'unknown') return { state: 'defer' as const, until: new Date(now.getTime() + 60_000) };
  if (current.state === 'waiting_shift' && current.userId === notification.userId && current.fingerprint === notification.fingerprint) return { state: 'defer' as const, until: new Date(now.getTime() + 60_000) };
  const notice = cashIssueForUser(current, notification.userId);
  if (!notice || notice.fingerprint !== notification.fingerprint) return { state: 'cancel' as const };
  const until = employeePushNotBefore(now);
  return until > now ? { state: 'defer' as const, until } : { state: 'send' as const, ...cashIssuePushCopy(notice.request) };
}
