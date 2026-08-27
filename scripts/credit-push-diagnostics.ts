import { prisma } from '@/lib/prisma';
import { creditRealizationIssueFingerprint } from '@/lib/credit-realization-workday-control';

async function main() {
  const documentNumber = process.argv[2]?.trim();
  if (!documentNumber) throw new Error('DOCUMENT_NUMBER_REQUIRED');
  const controlCase = await prisma.creditRealizationControlCase.findFirst({
    where: { documentNumber },
    select: { realizationRef: true, documentNumber: true, status: true, reasonCode: true, employeeActionCandidate: true },
  });
  if (!controlCase) {
    console.log(JSON.stringify({ documentNumber, found: false }));
    return;
  }
  const issue = await prisma.workdayControlIssue.findUnique({
    where: { fingerprint: creditRealizationIssueFingerprint(controlCase.realizationRef) },
    include: {
      user: { select: { name: true, pushSubscriptions: { where: { disabledAt: null }, select: { id: true, updatedAt: true } } } },
      notifications: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, status: true, pushStatus: true, scheduledAt: true, sentAt: true, pushDeliveredAt: true, attemptCount: true, lastError: true, nextPushAttemptAt: true, readAt: true },
      },
    },
  });
  console.log(JSON.stringify({
    documentNumber, found: true,
    control: { status: controlCase.status, reason: controlCase.reasonCode, employeeAction: controlCase.employeeActionCandidate },
    issue: issue ? {
      status: issue.status, employeeActionRequired: issue.employeeActionRequired, employee: issue.user.name,
      activePushSubscriptions: issue.user.pushSubscriptions.length,
      subscriptionUpdatedAt: issue.user.pushSubscriptions.map((item) => item.updatedAt),
      notifications: issue.notifications,
    } : null,
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
