import { Prisma } from '@prisma/client';
import { getCurrentUser } from '@/lib/auth';
import { readKkmShiftCloseSimulation, type KkmShiftCloseSimulationScenario } from '@/lib/kkm-shift-close-control';
import { prisma } from '@/lib/prisma';

const scenarios = new Set<KkmShiftCloseSimulationScenario>(['confirmed', 'delayed', 'one_c_open', 'ofd_missing', 'one_c_unavailable', 'ofd_unavailable']);

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function PATCH(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const taskId = Number(body.taskId);
  const scenario = typeof body.scenario === 'string' && scenarios.has(body.scenario as KkmShiftCloseSimulationScenario) ? body.scenario as KkmShiftCloseSimulationScenario : null;
  if (!Number.isInteger(taskId) || taskId <= 0 || !scenario) return Response.json({ error: 'Invalid test scenario' }, { status: 400 });

  const task = await prisma.shiftControlTask.findUnique({ where: { id: taskId }, include: { run: { include: { workDayEntry: true, user: { select: { login: true } } } } } });
  if (!task || task.category !== 'handover' || task.run.department !== 'retail') return Response.json({ error: 'Retail handover task not found' }, { status: 404 });
  if (process.env.ENABLE_DEV_WORKDAY_TOOLS !== 'true' && task.run.user.login !== 'kkm_test') return Response.json({ error: 'Dev workday tools are disabled' }, { status: 403 });
  if (!task.run.workDayEntry.comment.startsWith('Dev/Test')) return Response.json({ error: 'Сценарий можно назначить только смене, созданной через Dev/Test' }, { status: 409 });

  const handoverData = record(task.handoverData);
  const simulation = { scenario, activatedAt: new Date().toISOString() };
  const updated = await prisma.shiftControlTask.update({
    where: { id: task.id },
    data: { handoverData: { ...handoverData, kkmCloseSimulation: simulation } as Prisma.InputJsonValue },
    select: { id: true, handoverData: true },
  });
  return Response.json({ task: updated, simulation: readKkmShiftCloseSimulation(record(updated.handoverData).kkmCloseSimulation), message: 'Dev/Test сценарий кассы установлен. Теперь пройдите сдачу смены под тестовым сотрудником.' });
}
