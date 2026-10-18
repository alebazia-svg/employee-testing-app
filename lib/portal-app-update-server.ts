import 'server-only';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { accessSessionIdentity } from './portal-access-journal';
import { parseAppObservation, parseUpdateCommand, commandActive, sameRelease, type AppObservation } from './portal-app-observation';
import { readAppRelease } from './employee-app-update';

export function serverAppRelease() {
  return readAppRelease({ version: process.env.NEXT_PUBLIC_APP_VERSION, builtAt: process.env.NEXT_PUBLIC_APP_BUILT_AT });
}
export async function observeAppUpdate(userId: number, token: string | undefined, app: AppObservation, now = new Date()) {
  const identity = accessSessionIdentity(token, userId, now);
  if (!identity) return null;
  const session = await prisma.portalAccessSession.findUnique({ where: { sessionHash: identity.sessionHash } });
  if (!session || session.userId !== userId || session.loggedOutAt || session.expiresAt <= now) return null;
  const command = parseUpdateCommand(session.appUpdateCommand);
  const addressed = command && command.clientId === app.clientId;
  // While a command is pending, another tab cannot replace the target's version
  // or make its status look successful. The ordinary access journal still works.
  if (command && commandActive(command, now) && !addressed) return null;
  const acknowledged = addressed && app.commandId === command.id && commandActive(command, now);
  // The reported release, not a 'success' flag, confirms the targeted command.
  const updatedCommand = acknowledged ? { ...command, receivedAt: command.receivedAt ?? now.toISOString(),
    ...(sameRelease(app, command.target) ? { completedAt: now.toISOString() } : {}) } : null;
  const changed = await prisma.portalAccessSession.updateMany({ where: {
    id: session.id, userId, loggedOutAt: null, expiresAt: { gt: now },
    appCheckedAt: session.appCheckedAt,
    ...(session.appUpdateCommand ? { appUpdateCommand: { equals: session.appUpdateCommand } } : {}),
  }, data: { appObservation: app, appCheckedAt: now, ...(updatedCommand ? { appUpdateCommand: updatedCommand } : {}) } });
  if (!changed.count) return null; // newer observation/command won the race
  return addressed && commandActive(updatedCommand ?? command, now) && serverAppRelease() && sameRelease(command.target, serverAppRelease()!)
    ? { id: command.id } : null;
}

export async function requestAppUpdate(sessionId: string, adminId: number, now = new Date()) {
  const target = serverAppRelease();
  if (!target) return { status: 503, error: 'Не удалось определить опубликованную сборку.' };
  const session = await prisma.portalAccessSession.findFirst({ where: { id: sessionId, loggedOutAt: null, expiresAt: { gt: now }, user: { isActive: true } } });
  if (!session) return { status: 404, error: 'Подключение уже завершено. Обновите список.' };
  const app = parseAppObservation(session.appObservation);
  if (!app || !session.appCheckedAt || now.getTime() - session.appCheckedAt.getTime() > 86400000) return { status: 409, error: 'Нет свежих сведений о версии. Сотруднику нужно открыть портал.' };
  if (sameRelease(app, target)) return { status: 409, error: 'Это подключение уже сообщило актуальную версию.' };
  const previous = parseUpdateCommand(session.appUpdateCommand);
  if (previous && commandActive(previous, now) && sameRelease(previous.target, target)
    && !(previous.receivedAt && app.clientId === previous.clientId && app.state === 'reload_failed')) return { status: 200, command: previous };
  if (previous && now.getTime() - Date.parse(previous.requestedAt) < 300000) return { status: 429, error: 'Повторный запрос будет доступен через несколько минут.' };
  const command = { id: randomUUID(), clientId: app.clientId, target, requestedAt: now.toISOString(), requestedBy: adminId };
  // CAS prevents two administrator clicks from creating competing commands.
  const result = await prisma.portalAccessSession.updateMany({ where: { id: session.id, userId: session.userId, loggedOutAt: null, expiresAt: { gt: now }, appCheckedAt: session.appCheckedAt,
    ...(previous ? { appUpdateCommand: { equals: session.appUpdateCommand! } } : { appUpdateCommand: { equals: Prisma.DbNull } }),
  }, data: { appUpdateCommand: command } });
  return result.count ? { status: 200, command } : { status: 409, error: 'Сведения изменились. Обновите список и повторите.' };
}
