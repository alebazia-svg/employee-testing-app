import 'server-only';
import { readOperationContext, operationSection } from './employee-operation-policy';
import { cashIssueRef } from './procurement-cash-issue-policy';
import { readInteraction } from './employee-interaction-policy';
import { readHandoverContext, type HandoverContext } from './employee-handover-audit-policy';
import { prisma } from './prisma';
import { ACTIVITY_DAILY_LIMIT, ACTIVITY_RETENTION_DAYS, type ActivityInput } from './employee-activity-policy';

let nextCleanup = 0;
/** Independent, best effort telemetry; no business mutation depends on its success. */
export async function writeEmployeeActivity(userId: number, sessionHash: string, input: ActivityInput | { key: string; kind: 'handover_check'; context: HandoverContext }, now = new Date()) {
  try {
    const saved = await prisma.$transaction(async tx => {
      const session = await tx.portalAccessSession.findUnique({ where: { sessionHash } });
      if (!session || session.userId !== userId || session.isService || session.loggedOutAt || session.expiresAt <= now) return false;
      const lock = await tx.$queryRaw<Array<{ acquired: boolean }>>`SELECT pg_try_advisory_xact_lock(73106270, ${userId}::integer) AS acquired`;
      if (!lock[0]?.acquired) return false;
      const since = new Date(+now - 86400000);
      if (await tx.portalActivityEvent.count({ where: { userId, createdAt: { gte: since } } }) >= ACTIVITY_DAILY_LIMIT) return false;
      if (input.kind === 'notification_open' && !await tx.workdayNotification.findFirst({ where: { id: input.notificationId, userId, sentAt: { not: null } }, select: { id: true } })) return false;
      const interaction = input.kind === 'interaction' ? readInteraction(input.context) : null;
      if (input.kind === 'interaction') {
        if (!interaction) return false;
        const { target, ref } = interaction;
        const owned = target === 'notification' ? await tx.workdayNotification.findFirst({ where: { id: Number(ref), userId, sentAt: { not: null } }, select: { id: true } })
          : target === 'issue' ? await tx.workdayControlIssue.findFirst({ where: { id: Number(ref), userId }, select: { id: true } })
          : target === 'review' ? await tx.terminalFiscalEmployeeReview.findFirst({ where: { id: ref, OR: [{ employeeId: userId }, { participants: { some: { userId } } }] }, select: { id: true } })
          : (await tx.workdayNotification.findMany({ where: { userId, sentAt: { not: null }, fingerprint: { contains: ref } }, select: { fingerprint: true, kind: true }, take: 30 })).some(n => cashIssueRef(n.fingerprint) === ref || n.kind === 'employee_expense_payable' && n.fingerprint.split(':')[3] === ref);
        if (!owned) return false;
        // Visible renders may repeat; intentional later openings remain separate.
        const prior = await tx.portalActivityEvent.findFirst({ where: { userId, kind: 'interaction', createdAt: { gte: new Date(+now-1500) }, context: { equals: interaction } } });
        if (prior) return true;
      }
      const handover = input.kind === 'handover' || input.kind === 'handover_check' ? readHandoverContext(input.context, input.kind === 'handover_check') : null;
      if ((input.kind === 'handover' || input.kind === 'handover_check') && (!handover || !await tx.shiftControlTask.findFirst({ where: { id: handover.taskId, category: 'handover', run: { userId } }, select: { id: true } }))) return false;
      const operation = input.kind === 'operation' ? readOperationContext(input.context) : null;
      if (input.kind === 'operation' && !operation) return false;
      const section = input.kind === 'visit' ? input.section : operation ? operationSection(operation.action) : handover ? 'day' : interaction && interaction.target !== 'notification' ? interaction.target === 'cash' ? 'cash' : 'receipts' : 'notifications';
      // One transition per attempt. Automatic KKM polls never produce repeated rows.
      if (handover) {
        const previous = await tx.portalActivityEvent.findFirst({ where: { userId, kind: input.kind, context: { path: ['taskId'], equals: handover.taskId } }, orderBy: { createdAt: 'desc' } });
        const prior = previous?.context as HandoverContext | null;
        if (input.kind === 'handover_check' && prior?.stage === handover.stage && prior?.attemptId === handover.attemptId) return true;
      }
      // Suppress reloads, StrictMode and duplicate tabs; retain intentional later returns.
      if (input.kind === 'visit') {
        const previous = await tx.portalActivityEvent.findFirst({ where: { userId, kind: 'visit' }, orderBy: { createdAt: 'desc' } });
        if (previous?.section === section && +now - +previous.createdAt < 30000) return true;
      }
      await tx.portalActivityEvent.createMany({ skipDuplicates: true, data: [{ userId, sessionId: session.id, section, kind: input.kind,
        eventKey: input.kind === 'notification_open' ? `notification:${input.notificationId}` : operation ? `op:${operation.attemptId}:${operation.stage}` : handover ? `${handover.attemptId}:${handover.stage}` : input.key,
        ...(operation ? {context:{...operation}} : handover ? { context: { ...handover } } : interaction ? { context: { ...interaction } } : {}),
        notificationId: input.kind === 'notification_open' ? input.notificationId : null, createdAt: now }, ...(input.kind === 'notification_open' ? [{userId,sessionId:session.id,section:'notifications',kind:'interaction',eventKey:`open:${input.key}`,context:{target:'notification',ref:String(input.notificationId),stage:'open'},notificationId:input.notificationId,createdAt:now}] : [])] });
      return true;
    }, { maxWait: 500, timeout: 2000 });
    // Bounded retention maintenance, at most hourly per process. Never scans business tables.
    if (+now >= nextCleanup) {
      nextCleanup = +now + 3600000;
      const cutoff = new Date(+now - ACTIVITY_RETENTION_DAYS * 86400000);
      await prisma.$executeRaw`DELETE FROM "PortalActivityEvent" WHERE id IN (SELECT id FROM "PortalActivityEvent" WHERE "createdAt" < ${cutoff} ORDER BY "createdAt" LIMIT 1000)`;
    }
    return saved;
  } catch { return false; }
}
