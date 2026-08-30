import { getCurrentUser } from '@/lib/auth';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';
import { changeWorkdayShift, getWorkdayShiftCorrectionState, WorkdayShiftChangeError } from '@/lib/workday-shift-change';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  return Response.json(await getWorkdayShiftCorrectionState({
    userId: user.id,
    department: user.department,
    date: getMoscowDateKey(),
  }));
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await req.json().catch(() => ({}));
  const toShiftCode = typeof payload.toShiftCode === 'string' ? payload.toShiftCode : '';
  try {
    const workDay = await changeWorkdayShift({
      userId: user.id,
      department: user.department,
      date: getMoscowDateKey(),
      toShiftCode,
      source: 'employee',
      shiftControlEnabled: usesWorkdayShiftControl(user),
      enforceEmployeeWindow: true,
    });
    return Response.json({ ok: true, workDay });
  } catch (error) {
    if (error instanceof WorkdayShiftChangeError) {
      const status = error.code === 'SHIFT_NOT_AVAILABLE' ? 409 : 400;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
