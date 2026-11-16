import 'server-only';
import { prisma } from '@/lib/prisma';

type Actor = { id: number; name: string; role: string; portalArea: string; oneCManagerName: string | null };
export const procurementCreatorSelect = { id: true, name: true, role: true, portalArea: true, oneCManagerName: true, isActive: true } as const;

/** The responsible buyer remains the 1C ownership/matching identity. The
 * authenticated administrator is recorded separately as the event actor. */
export async function resolveProcurementCreator(actor: Actor, managerUserId: unknown) {
  if (actor.role === 'EMPLOYEE' && actor.portalArea === 'PROCUREMENT' && managerUserId == null)
    return { ok: true, manager: actor } as const;
  if (actor.role !== 'ADMIN') return { ok: false, error: 'Нет доступа', status: 403 } as const;
  if (managerUserId == null) return { ok: false, error: 'Выберите ответственного за оплату.', status: 403 } as const;
  if (typeof managerUserId !== 'number' || !Number.isSafeInteger(managerUserId) || managerUserId <= 0)
    return { ok: false, error: 'Выберите ответственного за оплату.', status: 400 } as const;
  const manager = await prisma.user.findUnique({ where: { id: managerUserId }, select: procurementCreatorSelect });
  if (!manager || !manager.isActive || manager.role !== 'EMPLOYEE' || manager.portalArea !== 'PROCUREMENT')
    return { ok: false, error: 'Ответственный за оплату недоступен. Обновите список.', status: 403 } as const;
  return { ok: true, manager } as const;
}
