import 'server-only';
import type { Prisma, PrismaClient } from '@prisma/client';
import { readIssueIds } from './workday-required-issues';

type Db = PrismaClient | Prisma.TransactionClient;

// Only obsolete, undecided KKM requests are closed. Administrator decisions
// and cash-transfer exceptions remain immutable history of their own workflow.
export async function resolveObsoleteKkmRequests(db: Db, userId: number, issueId: number) {
  const requests = await db.workdayCloseExceptionRequest.findMany({
    where: { employeeId: userId, status: 'pending', NOT: { reasonCode: { startsWith: 'cash_encashment_' } } },
    select: { id: true, issueIds: true },
  });
  let resolved = 0;
  for (const request of requests) {
    const ids = readIssueIds(request.issueIds);
    if (!ids.includes(issueId)) continue;
    const issues = await db.workdayControlIssue.findMany({
      where: { id: { in: ids }, userId }, select: { id: true, status: true },
    });
    // Missing records and temporary unavailability are not proof of recovery.
    if (issues.length !== ids.length || issues.some(issue => issue.status !== 'resolved')) continue;
    const result = await db.workdayCloseExceptionRequest.updateMany({
      where: { id: request.id, status: 'pending' }, data: { status: 'resolved' },
    });
    resolved += result.count;
  }
  return resolved;
}
