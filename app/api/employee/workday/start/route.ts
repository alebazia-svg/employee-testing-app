import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getLateMinutes, getMoscowDateKey, getMoscowMinutes, getShiftOption } from '@/lib/workday';

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { shiftCode, comment } = await req.json();
  const shift = getShiftOption(typeof shiftCode === 'string' ? shiftCode : '');
  const now = new Date();
  const date = getMoscowDateKey(now);
  const lateMinutes = getLateMinutes(shift.startMinutes, getMoscowMinutes(now));

  const existing = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (existing) {
    return Response.json({
      workDay: existing,
      alreadyStarted: true,
      message: 'Рабочий день уже начат',
    });
  }

  const workDay = await prisma.workDayEntry.create({
    data: {
      userId: user.id,
      date,
      department: user.department,
      shiftCode: shift.code,
      shiftLabel: shift.label,
      shiftStartMinutes: shift.startMinutes,
      shiftEndMinutes: shift.endMinutes,
      startedAt: now,
      lateMinutes,
      comment: lateMinutes > 0 && typeof comment === 'string' ? comment.trim() : '',
      status: 'active',
    },
  });

  return Response.json({ workDay, alreadyStarted: false });
}
