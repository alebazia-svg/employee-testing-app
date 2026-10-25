import 'server-only';
import { after } from 'next/server';
import { accessSessionIdentity } from './portal-access-journal';
import { sessionCookieName } from './session';
import { writeEmployeeActivity } from './employee-activity';
import { readHandoverContext, type HandoverServerStage } from './employee-handover-audit-policy';

/** No new 1C calls and no latency added to the business response. */
export function scheduleHandoverCheckAudit(req: Request, userId: number, taskId: number, attemptId: string, status: string) {
  try {
    const stages: Record<string, HandoverServerStage> = { one_c_open: 'check_open', ofd_missing: 'check_missing', unavailable: 'check_unavailable', confirmed: 'check_confirmed' };
    const context = readHandoverContext({ taskId, attemptId, stage: stages[status] }, true);
    if (!context) return;
    const token = (req.headers.get('cookie') || '').split(';').map(v => v.trim()).find(v => v.startsWith(`${sessionCookieName}=`))?.slice(sessionCookieName.length + 1);
    const identity = accessSessionIdentity(token, userId);
    if (!identity) return;
    const checkedAt = new Date();
    after(async () => { await writeEmployeeActivity(userId, identity.sessionHash, { kind: 'handover_check', key: attemptId, context }, checkedAt); });
  } catch { /* Audit must never block shift completion. */ }
}
