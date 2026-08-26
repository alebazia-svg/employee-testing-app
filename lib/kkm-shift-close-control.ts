import 'server-only';

import type { Prisma, PrismaClient } from '@prisma/client';
import { getCashShifts } from '@/lib/one-c';
import { loadOneCKkmChecks, loadPlatformaOfdZReports } from '@/lib/terminal-fiscal-sources';

type Db = PrismaClient | Prisma.TransactionClient;

export type KkmShiftCloseEvidence = {
  status: 'confirmed' | 'one_c_open' | 'ofd_missing' | 'unavailable';
  checkedAt: string;
  cashierRef: string;
  cashRegisterRef: string;
  cashRegisterName: string;
  kktRegistrationNumber: string;
  oneCShiftNumber: string;
  fiscalShiftNumber: string;
  oneCOpenedAt: string;
  oneCClosedAt: string;
  ofdOpenedAt: string;
  ofdClosedAt: string;
  ofdDocumentLink: string;
  sourceError: string;
  simulated?: boolean;
};

export type KkmShiftCloseSimulationScenario = 'confirmed' | 'delayed' | 'one_c_open' | 'ofd_missing' | 'one_c_unavailable' | 'ofd_unavailable';
export type KkmShiftCloseSimulation = { scenario: KkmShiftCloseSimulationScenario; activatedAt: string };

const simulationScenarios = new Set<KkmShiftCloseSimulationScenario>(['confirmed', 'delayed', 'one_c_open', 'ofd_missing', 'one_c_unavailable', 'ofd_unavailable']);

export function readKkmShiftCloseSimulation(value: unknown): KkmShiftCloseSimulation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (typeof source.scenario !== 'string' || !simulationScenarios.has(source.scenario as KkmShiftCloseSimulationScenario)) return null;
  if (typeof source.activatedAt !== 'string' || !Number.isFinite(Date.parse(source.activatedAt))) return null;
  return { scenario: source.scenario as KkmShiftCloseSimulationScenario, activatedAt: source.activatedAt };
}

export function simulateKkmShiftClose(simulation: KkmShiftCloseSimulation, now = new Date()): KkmShiftCloseEvidence {
  const common = {
    checkedAt: now.toISOString(), cashierRef: 'DEV-CASHIER', cashRegisterRef: 'DEV-CASHBOX', cashRegisterName: 'Тестовая касса',
    kktRegistrationNumber: '0000000000000000', oneCShiftNumber: 'DEV-1', fiscalShiftNumber: '777',
    oneCOpenedAt: simulation.activatedAt, oneCClosedAt: now.toISOString(), ofdOpenedAt: '', ofdClosedAt: '', ofdDocumentLink: '', simulated: true as const,
  };
  const delayedConfirmed = simulation.scenario === 'delayed' && now.getTime() - Date.parse(simulation.activatedAt) >= 45_000;
  if (simulation.scenario === 'confirmed' || delayedConfirmed) return { ...common, status: 'confirmed', ofdOpenedAt: simulation.activatedAt, ofdClosedAt: now.toISOString(), ofdDocumentLink: 'dev://z-report', sourceError: '' };
  if (simulation.scenario === 'one_c_open') return { ...common, oneCClosedAt: '', status: 'one_c_open', sourceError: 'Dev/Test: смена в 1С осталась открыта.' };
  if (simulation.scenario === 'one_c_unavailable') return { ...common, oneCClosedAt: '', status: 'unavailable', sourceError: 'Dev/Test: 1С временно недоступна.' };
  if (simulation.scenario === 'ofd_unavailable') return { ...common, status: 'unavailable', sourceError: 'Dev/Test: сервис проверки чеков временно недоступен.' };
  return { ...common, status: 'ofd_missing', sourceError: 'Dev/Test: чек закрытия смены не найден.' };
}

function nextDate(date: string) {
  const value = new Date(`${date}T12:00:00+03:00`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toLocaleDateString('sv-SE', { timeZone: 'Europe/Moscow' });
}

function moscowPeriod(date: string) {
  return { from: `${date}T00:00:00+03:00`, to: `${nextDate(date)}T00:00:00+03:00` };
}

function normalized(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

export async function verifyEmployeeKkmShiftClose(input: { db: Db; userId: number; date: string; simulation?: KkmShiftCloseSimulation | null }): Promise<KkmShiftCloseEvidence> {
  if (input.simulation) {
    const simulatedUser = await input.db.user.findUnique({ where: { id: input.userId }, select: { login: true } });
    if (process.env.ENABLE_DEV_WORKDAY_TOOLS === 'true' || simulatedUser?.login === 'kkm_test') return simulateKkmShiftClose(input.simulation);
  }
  const checkedAt = new Date().toISOString();
  const empty = { checkedAt, cashierRef: '', cashRegisterRef: '', cashRegisterName: '', kktRegistrationNumber: '', oneCShiftNumber: '', fiscalShiftNumber: '', oneCOpenedAt: '', oneCClosedAt: '', ofdOpenedAt: '', ofdClosedAt: '', ofdDocumentLink: '' };
  const identity = await input.db.userOneCCashboxMapping.findUnique({ where: { userId: input.userId } });
  const cashierRef = identity?.oneCCashierRef?.trim() || '';
  if (!cashierRef) return { ...empty, status: 'unavailable', sourceError: 'Кассир сотрудника не сопоставлен с 1С.' };

  const checks = await loadOneCKkmChecks({ fromDate: input.date, toDate: input.date }).catch(() => ({ complete: false as const, checkedAt, data: [], errorCode: 'ONE_C_REQUEST_FAILED' }));
  if (!checks.complete) return { ...empty, cashierRef, status: 'unavailable', sourceError: 'Не удалось получить полный список чеков 1С.' };
  const employeeChecks = checks.data.filter((check) => check.cashier.ref === cashierRef).sort((a, b) => Date.parse(a.dateTime) - Date.parse(b.dateTime));
  const lastCheck = employeeChecks.at(-1) ?? null;
  if (!lastCheck?.cashRegisterRef || !lastCheck.kktRegistrationNumber) {
    return { ...empty, cashierRef, status: 'unavailable', sourceError: 'По чекам 1С не удалось определить ККТ сотрудника за этот день.' };
  }

  const shifts = await getCashShifts(input.date).catch(() => ({ ok: false as const, dateFrom: input.date, dateTo: input.date, shifts: [], error: 'ONE_C_REQUEST_FAILED' }));
  if (!shifts.ok) return { ...empty, cashierRef, cashRegisterRef: lastCheck.cashRegisterRef, kktRegistrationNumber: lastCheck.kktRegistrationNumber, status: 'unavailable', sourceError: 'Не удалось проверить состояние смены в 1С.' };
  const candidates = shifts.shifts.filter((shift) => shift.cashRegister.ref === lastCheck.cashRegisterRef && shift.posted !== false && shift.deletionMark !== true);
  const shift = [...candidates].sort((a, b) => Date.parse(b.closedAt || b.openedAt || b.datetime) - Date.parse(a.closedAt || a.openedAt || a.datetime))[0] ?? null;
  if (!shift) return { ...empty, cashierRef, cashRegisterRef: lastCheck.cashRegisterRef, kktRegistrationNumber: lastCheck.kktRegistrationNumber, status: 'one_c_open', sourceError: 'Смена этой ККМ в 1С не найдена.' };
  const common = { ...empty, cashierRef, cashRegisterRef: shift.cashRegister.ref, cashRegisterName: shift.cashRegister.name, kktRegistrationNumber: lastCheck.kktRegistrationNumber, oneCShiftNumber: shift.number, fiscalShiftNumber: shift.fiscalShiftNumber, oneCOpenedAt: shift.openedAt, oneCClosedAt: shift.closedAt };
  const oneCClosed = Boolean(shift.closedAt) && normalized(shift.status).includes('закрыт');
  if (!oneCClosed) return { ...common, status: 'one_c_open', sourceError: `Состояние смены в 1С: ${shift.status || 'не указано'}.` };

  const period = moscowPeriod(input.date);
  const ofd = await loadPlatformaOfdZReports({ kktRegistrationNumber: lastCheck.kktRegistrationNumber, ...period }).catch(() => ({ complete: false as const, checkedAt, data: [], errorCode: 'OFD_REQUEST_FAILED' }));
  if (!ofd.complete) return { ...common, status: 'unavailable', sourceError: 'Платформа OFD временно не ответила полностью.' };
  const report = ofd.data.find((item) => item.shiftNumber === shift.fiscalShiftNumber) ?? null;
  if (!report) return { ...common, status: 'ofd_missing', sourceError: '1С закрыла смену, но Z‑отчёт этой ККТ не найден в OFD.' };
  return { ...common, status: 'confirmed', ofdOpenedAt: report.openedAt, ofdClosedAt: report.closedAt, ofdDocumentLink: report.documentLink, sourceError: '' };
}

export function kkmShiftCloseFingerprint(workDayEntryId: number) {
  return `kkm-shift-close:${workDayEntryId}`;
}

export async function syncKkmShiftCloseIssue(db: Db, input: { userId: number; taskId: number; workDayEntryId: number; date: string; evidence: KkmShiftCloseEvidence; now: Date }) {
  const fingerprint = kkmShiftCloseFingerprint(input.workDayEntryId);
  const existing = await db.workdayControlIssue.findUnique({ where: { fingerprint } });
  if (input.evidence.status === 'confirmed') {
    if (existing?.status === 'open') {
      await db.workdayControlIssue.update({ where: { id: existing.id }, data: { status: 'resolved', resolvedAt: input.now, lastDetectedAt: input.now, nextReminderAt: null } });
      await db.workdayNotification.updateMany({ where: { issueId: existing.id, status: 'pending' }, data: { status: 'cancelled' } });
    }
    return null;
  }
  const title = input.evidence.status === 'one_c_open' ? 'Касса не закрыта' : input.evidence.status === 'ofd_missing' ? 'ККТ не подтвердила закрытие' : 'Не удалось проверить кассу';
  const detail = input.evidence.status === 'one_c_open'
    ? 'Закройте кассовую смену и нажмите «Проверить снова».'
    : input.evidence.status === 'ofd_missing'
      ? 'Касса не передала чек закрытия смены. Если чек распечатался — приложите фото; если не вышел — сообщите администратору.'
      : 'Портал временно не может подтвердить закрытие кассы. Попробуйте снова; если не получается — сообщите администратору.';
  const issue = await db.workdayControlIssue.upsert({
    where: { fingerprint },
    create: { userId: input.userId, taskId: input.taskId, fingerprint, ruleKey: 'kkm_shift_not_closed', severity: 'error', status: 'open', title, detail, sourceData: input.evidence as unknown as Prisma.InputJsonValue, employeeActionRequired: true, originDate: input.date, detectedAt: input.now, lastDetectedAt: input.now },
    update: { userId: input.userId, taskId: input.taskId, severity: 'error', status: 'open', title, detail, sourceData: input.evidence as unknown as Prisma.InputJsonValue, employeeActionRequired: true, originDate: input.date, resolvedAt: null, lastDetectedAt: input.now },
  });
  const [employee, admins] = await Promise.all([
    db.user.findUnique({ where: { id: input.userId }, select: { name: true } }),
    db.user.findMany({ where: { role: 'ADMIN', isActive: true }, select: { id: true } }),
  ]);
  const event = await db.adminInboxEvent.upsert({
    where: { eventKey: `kkm_shift_close:${input.workDayEntryId}:attention` },
    create: {
      eventKey: `kkm_shift_close:${input.workDayEntryId}:attention`,
      type: 'workday.kkm_shift_close_attention',
      title,
      body: `${employee?.name || 'Сотрудник'} · ${input.evidence.cashRegisterName || 'ККТ не определена'} · ${input.evidence.sourceError}`,
      href: `/admin/workday/issues/${issue.id}`,
      sourceType: 'workday_control_issue',
      sourceId: String(issue.id),
      occurredAt: input.now,
    },
    update: { title, body: `${employee?.name || 'Сотрудник'} · ${input.evidence.cashRegisterName || 'ККТ не определена'} · ${input.evidence.sourceError}`, occurredAt: input.now },
  });
  if (admins.length) await db.adminInboxReceipt.createMany({ data: admins.map((admin) => ({ eventId: event.id, userId: admin.id })), skipDuplicates: true });
  return issue;
}

export async function recheckOpenKkmShiftCloseIssues(now = new Date()) {
  const { prisma } = await import('@/lib/prisma');
  const issues = await prisma.workdayControlIssue.findMany({
    where: { ruleKey: 'kkm_shift_not_closed', status: 'open' },
    include: { task: { select: { id: true, handoverData: true, run: { select: { date: true, workDayEntryId: true } } } } },
    take: 5,
  });
  let resolved = 0;
  for (const issue of issues) {
    if (!issue.task) continue;
    const handover = issue.task.handoverData && typeof issue.task.handoverData === 'object' && !Array.isArray(issue.task.handoverData) ? issue.task.handoverData as Record<string, unknown> : null;
    const evidence = await verifyEmployeeKkmShiftClose({ db: prisma, userId: issue.userId, date: issue.task.run.date, simulation: readKkmShiftCloseSimulation(handover?.kkmCloseSimulation) });
    await syncKkmShiftCloseIssue(prisma, { userId: issue.userId, taskId: issue.task.id, workDayEntryId: issue.task.run.workDayEntryId, date: issue.task.run.date, evidence, now });
    if (evidence.status === 'confirmed') resolved += 1;
  }
  return { checked: issues.length, resolved };
}
