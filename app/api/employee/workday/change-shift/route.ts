import { getCurrentUser } from '@/lib/auth';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';
import { prisma } from '@/lib/prisma';
import { employeeShiftHint } from '@/lib/workday-extension';
import { listOwnShiftChangeOptions, repairAdminWorkdayShift } from '@/lib/workday-admin-shift-repair';
import { changeWorkdayShift, getWorkdayShiftCorrectionState, WorkdayShiftChangeError } from '@/lib/workday-shift-change';

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (new URL(req.url).searchParams.get('live') === '1') {
    // Development only: lets the demo pretend it is another time of day.
    const demoNow = process.env.NODE_ENV !== 'production' ? Date.parse(req.headers.get('x-mobo-demo-now') ?? '') : Number.NaN;
    const now = Number.isFinite(demoNow) ? new Date(demoNow) : undefined;
    const options = await listOwnShiftChangeOptions(prisma, { userId: user.id, department: user.department, date: getMoscowDateKey(now) });
    const found = options.canChange ? await employeeShiftHint(prisma, { userId: user.id, department: user.department, now }) : null;
    // Only offer what this very change can actually do (same check set in the target shift).
    const hint = found && options.options.some((item) => item.code === found.toShiftCode) ? found : null;
    return Response.json({ ...options, hint }, { headers: { 'Cache-Control': 'no-store' } });
  }
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
    if (payload.live === true) {
      const workDay = await repairAdminWorkdayShift(prisma, { userId: user.id, department: user.department, date: getMoscowDateKey(), toShiftCode });
      return Response.json({ ok: true, workDay }, { headers: { 'X-Portal-Activity-Ref': String(workDay.id) } });
    }
    const workDay = await changeWorkdayShift({
      userId: user.id,
      department: user.department,
      date: getMoscowDateKey(),
      toShiftCode,
      source: 'employee',
      shiftControlEnabled: usesWorkdayShiftControl(user),
      enforceEmployeeWindow: true,
    });
    return Response.json({ ok: true, workDay },{headers:{'X-Portal-Activity-Ref':String(workDay.id)}});
  } catch (error) {
    if (error instanceof WorkdayShiftChangeError) {
      const status = error.code === 'SHIFT_NOT_AVAILABLE' ? 409 : 400;
      return Response.json({ error: error.message, code: error.code }, { status });
    }
    throw error;
  }
}
