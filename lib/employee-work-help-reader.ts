import 'server-only';
import { prisma } from './prisma';
import { loadScheduleNearReminders } from './work-schedule-notifications';
import { getMoscowDateKey } from './workday';
import { workHelpAckKey, workHelpSnapshot } from './employee-work-help';

/** Same read for the real employee and actor-bound inspection; never acknowledges. */
export async function readEmployeeWorkHelp(userId: number, now = new Date()) {
  const today = getMoscowDateKey(now);
  const [states,ack] = await Promise.all([
    loadScheduleNearReminders(prisma,[userId],today),
    prisma.portalActivityEvent.findUnique({where:{userId_eventKey:{userId,eventKey:workHelpAckKey(today)}},select:{createdAt:true}}),
  ]);
  return workHelpSnapshot(states.get(userId)!,ack?.createdAt ?? null,now);
}
