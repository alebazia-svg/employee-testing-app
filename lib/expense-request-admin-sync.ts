import 'server-only';

import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { evaluateExpenseRequestCompleteness } from '@/lib/expense-request-completeness';
import {
  deriveExpenseRequestLifecycle,
  evaluationAuditData,
  expenseRequestSourceHash,
  expenseRequestSyncRunKey,
  normalizeExpenseRequestForAudit,
} from '@/lib/expense-request-admin-lifecycle';
import type { ExpenseRequestSnapshot, ExpenseRequestSourceRow } from '@/lib/expense-request-source';
import { createExpenseRequestAdminInboxEvent } from '@/lib/admin-inbox';

type SyncDb = PrismaClient;

function text(value: unknown) { return String(value ?? '').trim(); }
export function expenseRequestDateOrNull(value: unknown) {
  const source = text(value);
  const oneC = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(source);
  const normalized = oneC
    ? `${oneC[3]}-${oneC[2]}-${oneC[1]}T${oneC[4] ?? '00'}:${oneC[5] ?? '00'}:${oneC[6] ?? '00'}+03:00`
    : source;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function named(value: unknown) {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return { ref: text(row.ref), name: text(row.name ?? row.value) };
}

export type ExpenseRequestAdminSyncResult = {
  runId: string;
  runKey: string;
  idempotentReplay: boolean;
  sourceComplete: boolean;
  sourceRowCount: number;
  createdCases: number;
  updatedCases: number;
  evaluations: number;
  newNotApproved: number;
};

export async function syncExpenseRequestAdminAudit(input: {
  snapshot: ExpenseRequestSnapshot;
  from: Date;
  to: Date;
  baseline?: boolean;
  queueTelegramDelivery?: boolean;
  now?: Date;
  db?: SyncDb;
}): Promise<ExpenseRequestAdminSyncResult> {
  const db = input.db ?? prisma;
  const now = input.now ?? new Date();
  const runKey = expenseRequestSyncRunKey({
    from: input.from,
    to: input.to,
    checkedAt: input.snapshot.checkedAt,
    complete: input.snapshot.complete,
    rows: input.snapshot.rows,
  });
  const existingRun = await db.expenseRequestSyncRun.findUnique({ where: { runKey } });
  if (existingRun?.status === 'completed') {
    return {
      runId: existingRun.id, runKey, idempotentReplay: true, sourceComplete: existingRun.sourceComplete,
      sourceRowCount: existingRun.sourceRowCount, createdCases: existingRun.createdCaseCount,
      updatedCases: existingRun.updatedCaseCount, evaluations: existingRun.evaluationCount,
      newNotApproved: existingRun.newNotApprovedCount,
    };
  }

  let run;
  try {
    run = existingRun ?? await db.expenseRequestSyncRun.create({
      data: { runKey, periodFrom: input.from, periodTo: input.to, status: 'running', sourceComplete: input.snapshot.complete, sourceRowCount: input.snapshot.rows.length },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const replay = await db.expenseRequestSyncRun.findUniqueOrThrow({ where: { runKey } });
      return {
        runId: replay.id, runKey, idempotentReplay: true, sourceComplete: replay.sourceComplete,
        sourceRowCount: replay.sourceRowCount, createdCases: replay.createdCaseCount,
        updatedCases: replay.updatedCaseCount, evaluations: replay.evaluationCount,
        newNotApproved: replay.newNotApprovedCount,
      };
    }
    throw error;
  }

  if (!input.snapshot.complete) {
    await db.expenseRequestSyncRun.update({
      where: { id: run.id },
      data: { status: 'incomplete', completedAt: now, sourceComplete: false, sourceRowCount: input.snapshot.rows.length, errorCode: 'EXPENSE_REQUEST_SOURCE_INCOMPLETE' },
    });
    return {
      runId: run.id, runKey, idempotentReplay: false, sourceComplete: false,
      sourceRowCount: input.snapshot.rows.length, createdCases: 0, updatedCases: 0,
      evaluations: 0, newNotApproved: 0,
    };
  }

  let createdCases = 0;
  let updatedCases = 0;
  let evaluations = 0;
  let newNotApproved = 0;
  try {
    for (const row of input.snapshot.rows) {
      const ref = text(row.ref);
      if (!ref) continue;
      const sourceHash = expenseRequestSourceHash(row);
      const evaluation = evaluateExpenseRequestCompleteness(row);
      const evaluationData = evaluationAuditData(evaluation);
      const status = named(row.status);
      const statusKey = text(row.status?.key);
      const requestedBy = named(row.requested_by);
      const counterparty = named(row.counterparty);
      const partner = named(row.partner);
      const businessOperation = named(row.business_operation);
      const outcome = await db.$transaction(async (tx) => {
        const existing = await tx.expenseRequestAdminCase.findUnique({ where: { oneCRequestRef: ref } });
        const lifecycle = deriveExpenseRequestLifecycle({
          existing: existing ? {
            isNotApproved: existing.isNotApproved, notApprovedCycle: existing.notApprovedCycle,
            currentCycleOrigin: existing.currentCycleOrigin,
            enteredNotApprovedAt: existing.enteredNotApprovedAt, seenAt: existing.seenAt, seenById: existing.seenById,
            reviewedAt: existing.reviewedAt, reviewedById: existing.reviewedById,
          } : null,
          statusKey,
          deletionMark: row.deletion_mark,
          now,
          baseline: input.baseline === true,
        });
        const caseRow = await tx.expenseRequestAdminCase.upsert({
          where: { oneCRequestRef: ref },
          create: {
            oneCRequestRef: ref, oneCNumber: text(row.number), oneCDate: expenseRequestDateOrNull(row.date), posted: row.posted ?? null,
            deletionMark: row.deletion_mark ?? null, currentStatusKey: statusKey, currentStatusName: status.name,
            isNotApproved: lifecycle.isNotApproved, notApprovedCycle: lifecycle.notApprovedCycle,
            currentCycleOrigin: lifecycle.currentCycleOrigin,
            enteredNotApprovedAt: lifecycle.enteredNotApprovedAt, firstSeenAt: now, lastSeenAt: now,
            seenAt: lifecycle.seenAt, seenById: lifecycle.seenById, reviewedAt: lifecycle.reviewedAt, reviewedById: lifecycle.reviewedById,
            latestSourceHash: sourceHash, latestRuleVersion: evaluation.version, latestCategory: evaluation.category,
            latestCompletenessState: evaluation.completenessState, requestedByRef: requestedBy.ref, requestedByName: requestedBy.name,
            amount: row.amount ?? null, businessOperationName: businessOperation.name, counterpartyName: partner.name || counterparty.name,
          },
          update: {
            oneCNumber: text(row.number), oneCDate: expenseRequestDateOrNull(row.date), posted: row.posted ?? null,
            deletionMark: row.deletion_mark ?? null, currentStatusKey: statusKey, currentStatusName: status.name,
            isNotApproved: lifecycle.isNotApproved, notApprovedCycle: lifecycle.notApprovedCycle,
            currentCycleOrigin: lifecycle.currentCycleOrigin,
            enteredNotApprovedAt: lifecycle.enteredNotApprovedAt, lastSeenAt: now,
            seenAt: lifecycle.seenAt, seenById: lifecycle.seenById, reviewedAt: lifecycle.reviewedAt, reviewedById: lifecycle.reviewedById,
            latestSourceHash: sourceHash, latestRuleVersion: evaluation.version, latestCategory: evaluation.category,
            latestCompletenessState: evaluation.completenessState, requestedByRef: requestedBy.ref, requestedByName: requestedBy.name,
            amount: row.amount ?? null, businessOperationName: businessOperation.name, counterpartyName: partner.name || counterparty.name,
          },
        });
        if (lifecycle.newlyEnteredNotApproved) {
          await createExpenseRequestAdminInboxEvent({
            db: tx,
            oneCRequestRef: ref,
            caseId: caseRow.id,
            notApprovedCycle: lifecycle.notApprovedCycle,
            occurredAt: now,
            requestedByName: requestedBy.name,
            amount: row.amount,
            operation: businessOperation.name || evaluation.category,
            comment: row.comment,
            queueTelegramDelivery: input.queueTelegramDelivery === true,
          });
        }
        const normalizedSource = normalizeExpenseRequestForAudit(row) as Prisma.InputJsonValue;
        const existingEvaluation = await tx.expenseRequestAdminEvaluation.findUnique({
          where: { caseId_notApprovedCycle_sourceHash_ruleVersion: { caseId: caseRow.id, notApprovedCycle: lifecycle.notApprovedCycle, sourceHash, ruleVersion: evaluation.version } },
          select: { id: true },
        });
        await tx.expenseRequestAdminEvaluation.upsert({
          where: { caseId_notApprovedCycle_sourceHash_ruleVersion: { caseId: caseRow.id, notApprovedCycle: lifecycle.notApprovedCycle, sourceHash, ruleVersion: evaluation.version } },
          create: {
            caseId: caseRow.id, syncRunId: run.id, notApprovedCycle: lifecycle.notApprovedCycle, sourceHash, ...evaluationData,
            categoryCandidates: evaluationData.categoryCandidates, reasonCodes: evaluationData.reasonCodes,
            missingInformation: evaluationData.missingInformation, decisionSources: evaluationData.decisionSources,
            sourceComplete: input.snapshot.complete && row.completeness?.complete !== false, normalizedSource,
          },
          update: {},
        });
        return { existed: Boolean(existing), newEvaluation: !existingEvaluation, newlyEnteredNotApproved: lifecycle.newlyEnteredNotApproved };
      });
      if (outcome.existed) updatedCases += 1; else createdCases += 1;
      if (outcome.newEvaluation) evaluations += 1;
      if (outcome.newlyEnteredNotApproved) newNotApproved += 1;
    }
    await db.expenseRequestSyncRun.update({
      where: { id: run.id },
      data: { status: 'completed', completedAt: now, sourceComplete: input.snapshot.complete, sourceRowCount: input.snapshot.rows.length, createdCaseCount: createdCases, updatedCaseCount: updatedCases, evaluationCount: evaluations, newNotApprovedCount: newNotApproved },
    });
  } catch (error) {
    await db.expenseRequestSyncRun.update({ where: { id: run.id }, data: { status: 'failed', completedAt: now, errorCode: 'EXPENSE_REQUEST_SYNC_FAILED' } }).catch(() => null);
    throw error;
  }
  return { runId: run.id, runKey, idempotentReplay: false, sourceComplete: input.snapshot.complete, sourceRowCount: input.snapshot.rows.length, createdCases, updatedCases, evaluations, newNotApproved };
}
