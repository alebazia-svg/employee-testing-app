import 'server-only';

import { createHash } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';

export const cashRecountToleranceRub = 0;
export const cashRecountCommentThresholdRub = 300;
const reminderDelayMs = 30 * 60 * 1000;

export type CashRecountStage = 'initial' | 'result_ready' | 'comment_required';
export type CashRecountDecision =
  | 'complete_matched'
  | 'complete_unavailable'
  | 'require_comment'
  | 'complete_mismatch';

export type CashRecountComparison = {
  status: 'matched' | 'mismatch' | 'unavailable';
  actual: number;
  expected: number | null;
  difference: number | null;
  discrepancyType: 'none' | 'surplus' | 'shortage' | 'unavailable';
  requiresComment: boolean;
  capturedAt: string;
  oneCCheckedAt: string | null;
  cashboxName: string;
  sourceError: string | null;
};

export type CashRecountInputEntry = {
  value: number;
  enteredAt: string;
  kind: 'initial' | 'corrected';
};

type CashRecountDb = Prisma.TransactionClient | PrismaClient;

function money(value: number) {
  return Math.round(value * 100) / 100;
}

export function appendCashRecountInputHistory(
  value: unknown,
  actual: number,
  enteredAt: string,
): CashRecountInputEntry[] {
  const history = Array.isArray(value)
    ? value.flatMap((entry): CashRecountInputEntry[] => {
        if (!entry || typeof entry !== 'object') return [];
        const row = entry as Record<string, unknown>;
        if (typeof row.value !== 'number' || !Number.isFinite(row.value) || typeof row.enteredAt !== 'string') return [];
        return [{
          value: money(row.value),
          enteredAt: row.enteredAt,
          kind: row.kind === 'corrected' ? 'corrected' : 'initial',
        }];
      })
    : [];
  const normalized = money(actual);
  if (history.at(-1)?.value === normalized) return history;
  return [...history, { value: normalized, enteredAt, kind: history.length === 0 ? 'initial' : 'corrected' }];
}

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function buildCashRecountComparison(input: {
  actual: number;
  expected: number | null;
  capturedAt: string;
  oneCCheckedAt?: string | null;
  cashboxName?: string;
  sourceError?: string | null;
}): CashRecountComparison {
  if (input.expected === null) {
    return {
      status: 'unavailable',
      actual: money(input.actual),
      expected: null,
      difference: null,
      discrepancyType: 'unavailable',
      requiresComment: false,
      capturedAt: input.capturedAt,
      oneCCheckedAt: input.oneCCheckedAt ?? null,
      cashboxName: input.cashboxName ?? '',
      sourceError: input.sourceError ?? null,
    };
  }
  const difference = money(input.actual - input.expected);
  const magnitude = Math.abs(difference);
  const matched = magnitude <= cashRecountToleranceRub;
  return {
    status: matched ? 'matched' : 'mismatch',
    actual: money(input.actual),
    expected: money(input.expected),
    difference,
    discrepancyType: matched ? 'none' : difference > 0 ? 'surplus' : 'shortage',
    requiresComment: magnitude > cashRecountCommentThresholdRub,
    capturedAt: input.capturedAt,
    oneCCheckedAt: input.oneCCheckedAt ?? null,
    cashboxName: input.cashboxName ?? '',
    sourceError: input.sourceError ?? null,
  };
}

export function cashRecountIssueFingerprint(runId: number, cashboxName: string) {
  return `cash-recount:${runId}:${digest(cashboxName.trim().toLowerCase()).slice(0, 24)}`;
}

export function decideCashRecountAction(input: {
  comparison: CashRecountComparison;
  hasComment: boolean;
}): CashRecountDecision {
  if (input.comparison.status === 'unavailable') return 'complete_unavailable';
  if (input.comparison.status === 'matched') return 'complete_matched';
  if (input.comparison.requiresComment && !input.hasComment) return 'require_comment';
  return 'complete_mismatch';
}

function detail(comparison: CashRecountComparison) {
  const label = comparison.discrepancyType === 'surplus' ? 'Излишек' : 'Недостача';
  return `${label} ${Math.abs(comparison.difference ?? 0).toLocaleString('ru-RU')} ₽. Факт ${comparison.actual.toLocaleString('ru-RU')} ₽, остаток 1С ${comparison.expected?.toLocaleString('ru-RU')} ₽.`;
}

export async function syncCashRecountWorkdayControl(db: CashRecountDb, input: {
  userId: number;
  taskId: number;
  runId: number;
  date: string;
  comment: string;
  comparison: CashRecountComparison;
  now: Date;
}) {
  if (input.comparison.status === 'unavailable') return { opened: 0, resolved: 0, notifications: 0 };

  if (input.comparison.status === 'matched') {
    const openIssues = await db.workdayControlIssue.findMany({
      where: { userId: input.userId, ruleKey: 'cash_recount_mismatch', status: 'open' },
      select: { id: true },
    });
    if (openIssues.length === 0) return { opened: 0, resolved: 0, notifications: 0 };
    const issueIds = openIssues.map((issue) => issue.id);
    const result = await db.workdayControlIssue.updateMany({
      where: { id: { in: issueIds }, status: 'open' },
      data: { status: 'resolved', resolvedAt: input.now, nextReminderAt: null },
    });
    await db.workdayNotification.updateMany({
      where: { issueId: { in: issueIds }, status: 'pending' },
      data: { status: 'cancelled' },
    });
    return { opened: 0, resolved: result.count, notifications: 0 };
  }

  const fingerprint = cashRecountIssueFingerprint(input.runId, input.comparison.cashboxName);
  const existing = await db.workdayControlIssue.findUnique({ where: { fingerprint } });
  const reopening = Boolean(existing && existing.status !== 'open');
  const elevated = Math.abs(input.comparison.difference ?? 0) > cashRecountCommentThresholdRub;
  const escalating = Boolean(existing?.status === 'open' && existing.severity !== 'error' && elevated);
  const severity = elevated || existing?.severity === 'error' ? 'error' : 'warning';
  const nextReminderAt = elevated ? new Date(input.now.getTime() + reminderDelayMs) : null;
  const issue = await db.workdayControlIssue.upsert({
    where: { fingerprint },
    create: {
      userId: input.userId,
      taskId: input.taskId,
      fingerprint,
      ruleKey: 'cash_recount_mismatch',
      severity,
      status: 'open',
      title: 'Расхождение наличных в кассе',
      detail: detail(input.comparison),
      sourceData: {
        date: input.date,
        taskId: input.taskId,
        actual: input.comparison.actual,
        expected: input.comparison.expected,
        difference: input.comparison.difference,
        discrepancyType: input.comparison.discrepancyType,
        capturedAt: input.comparison.capturedAt,
        comment: input.comment,
      },
      detectedAt: input.now,
      lastDetectedAt: input.now,
      nextReminderAt,
    },
    update: {
      userId: input.userId,
      taskId: input.taskId,
      severity,
      status: 'open',
      title: 'Расхождение наличных в кассе',
      detail: detail(input.comparison),
      sourceData: {
        date: input.date,
        taskId: input.taskId,
        actual: input.comparison.actual,
        expected: input.comparison.expected,
        difference: input.comparison.difference,
        discrepancyType: input.comparison.discrepancyType,
        capturedAt: input.comparison.capturedAt,
        comment: input.comment,
      },
      lastDetectedAt: input.now,
      resolvedAt: null,
      ...(reopening ? { detectedAt: input.now, nextReminderAt } : elevated ? { nextReminderAt } : {}),
    },
  });

  if (!existing || reopening) {
    await db.workdayNotification.upsert({
      where: { fingerprint: `cash-recount:${issue.id}:detected:${input.taskId}` },
      create: {
        userId: input.userId,
        taskId: input.taskId,
        issueId: issue.id,
        fingerprint: `cash-recount:${issue.id}:detected:${input.taskId}`,
        kind: 'issue_detected',
        title: 'Контроль наличных',
        body: 'Результат пересчёта сохранён для контроля. Следующий пересчёт выполните по графику.',
        scheduledAt: input.now,
      },
      update: {},
    });
    if (elevated) {
      await db.workdayNotification.upsert({
        where: { fingerprint: `cash-recount:${issue.id}:reminder:${input.taskId}` },
        create: {
          userId: input.userId,
          taskId: input.taskId,
          issueId: issue.id,
          fingerprint: `cash-recount:${issue.id}:reminder:${input.taskId}`,
          kind: 'issue_reminder',
          title: 'Контроль наличных',
          body: 'Вопрос по наличным остаётся открытым. Если нужна помощь, обратитесь к администратору.',
          scheduledAt: new Date(input.now.getTime() + reminderDelayMs),
        },
        update: {},
      });
    }
    return { opened: 1, resolved: 0, notifications: elevated ? 2 : 1 };
  }
  if (escalating) {
    await db.workdayNotification.upsert({
      where: { fingerprint: `cash-recount:${issue.id}:reminder:${input.taskId}` },
      create: {
        userId: input.userId,
        taskId: input.taskId,
        issueId: issue.id,
        fingerprint: `cash-recount:${issue.id}:reminder:${input.taskId}`,
        kind: 'issue_reminder',
        title: 'Контроль наличных',
        body: 'Вопрос по наличным остаётся открытым. Если нужна помощь, обратитесь к администратору.',
        scheduledAt: nextReminderAt!,
      },
      update: {},
    });
    return { opened: 0, resolved: 0, notifications: 1 };
  }
  return { opened: 0, resolved: 0, notifications: 0 };
}
