import { prisma } from '../lib/prisma';
import { changeWorkdayShift } from '../lib/workday-shift-change';
import { getMoscowDateKey, usesWorkdayShiftControl } from '../lib/workday';

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? '';
}

async function main() {
  const login = argument('login').trim();
  const userId = Number(argument('user-id'));
  const shiftCode = argument('shift').trim();
  const date = argument('date').trim() || getMoscowDateKey();
  const apply = process.argv.includes('--apply');
  if ((!login && !Number.isInteger(userId)) || !shiftCode) throw new Error('Usage: (--login=<login> | --user-id=<id>) --shift=<code> [--date=YYYY-MM-DD] [--apply]');

  const user = login
    ? await prisma.user.findUnique({ where: { login } })
    : await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error(`User not found: ${login || userId}`);
  const workDay = await prisma.workDayEntry.findUnique({ where: { userId_date: { userId: user.id, date } } });
  if (!workDay) throw new Error(`Workday not found: ${user.login} ${date}`);

  const preview = {
    apply,
    userId: user.id,
    name: user.name,
    login: user.login,
    date,
    currentShiftCode: workDay.shiftCode,
    targetShiftCode: shiftCode,
    startedAt: workDay.startedAt.toISOString(),
    currentLateMinutes: workDay.lateMinutes,
  };
  console.log(JSON.stringify({ stage: 'preview', ...preview }));
  if (!apply) return;

  const updated = await changeWorkdayShift({
    userId: user.id,
    department: user.department,
    date,
    toShiftCode: shiftCode,
    source: 'admin_repair',
    shiftControlEnabled: usesWorkdayShiftControl(user),
    enforceEmployeeWindow: false,
  });
  console.log(JSON.stringify({
    stage: 'applied',
    workDayId: updated.id,
    shiftCode: updated.shiftCode,
    shiftLabel: updated.shiftLabel,
    startedAt: updated.startedAt.toISOString(),
    lateMinutes: updated.lateMinutes,
    policyVersion: updated.latenessPolicyVersion,
    shadowPointsX2: updated.latenessShadowPointsX2,
  }));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
