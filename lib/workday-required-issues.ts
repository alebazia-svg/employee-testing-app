import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

export const workdayRequiredIssueSelect = {
  id: true,
  ruleKey: true,
  severity: true,
  title: true,
  detail: true,
  sourceData: true,
  originDate: true,
  detectedAt: true,
  lastDetectedAt: true,
} satisfies Prisma.WorkdayControlIssueSelect;

export async function findOpenRequiredWorkdayIssues(db: Db, userId: number) {
  return db.workdayControlIssue.findMany({
    where: { userId, status: 'open', employeeActionRequired: true },
    select: workdayRequiredIssueSelect,
    orderBy: [{ severity: 'desc' }, { detectedAt: 'asc' }],
  });
}

export function readIssueIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b)
    : [];
}

export function sameIssueIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

export async function findApprovedCloseException(db: Db, workDayEntryId: number, issueIds: number[]) {
  const requests = await db.workdayCloseExceptionRequest.findMany({
    where: { workDayEntryId, status: 'approved', consumedAt: null },
    orderBy: { decidedAt: 'desc' },
    take: 10,
  });
  return requests.find((request) => sameIssueIds(readIssueIds(request.issueIds), issueIds)) ?? null;
}

export function serializeRequiredIssue(issue: Awaited<ReturnType<typeof findOpenRequiredWorkdayIssues>>[number]) {
  return {
    ...issue,
    detectedAt: issue.detectedAt.toISOString(),
    lastDetectedAt: issue.lastDetectedAt.toISOString(),
  };
}
