import { createHash, randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

export const WORKSTATION_COOKIE_NAME = 'offonika_workstation';
export const WORKSTATION_PROVISIONING_TTL_MINUTES = 30;

export type WorkstationContextSource = 'device_login' | 'manual_select';

export function hashWorkstationToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function createWorkstationToken() {
  return randomBytes(32).toString('base64url');
}

const PROVISIONING_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeWorkstationProvisioningCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function createWorkstationProvisioningCode() {
  const bytes = randomBytes(12);
  const raw = [...bytes].map((value) => PROVISIONING_ALPHABET[value % PROVISIONING_ALPHABET.length]).join('');
  return raw.match(/.{1,4}/g)!.join('-');
}

export async function claimWorkstationDevice(prisma: PrismaClient, input: { code: string; now?: Date }) {
  const now = input.now ?? new Date();
  const code = normalizeWorkstationProvisioningCode(input.code);
  if (code.length !== 12) return { status: 'invalid' as const };
  const binding = await prisma.workstationDeviceBinding.findUnique({
    where: { tokenHash: hashWorkstationToken(code) },
    include: { workstation: { select: { code: true, label: true, isActive: true } } },
  });
  if (!binding?.isActive || binding.revokedAt || binding.boundAt || !binding.provisioningExpiresAt
    || binding.provisioningExpiresAt <= now || !binding.workstation.isActive) {
    return { status: 'invalid' as const };
  }
  const deviceToken = createWorkstationToken();
  const claimed = await prisma.workstationDeviceBinding.updateMany({
    where: {
      id: binding.id,
      isActive: true,
      revokedAt: null,
      boundAt: null,
      provisioningExpiresAt: { gt: now },
    },
    data: { tokenHash: hashWorkstationToken(deviceToken), boundAt: now },
  });
  if (claimed.count !== 1) return { status: 'invalid' as const };
  return { status: 'bound' as const, deviceToken, bindingId: binding.id, workstation: binding.workstation };
}

export function isWorkstationAssignmentRace(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}

export type WorkstationAssignmentDecision =
  | { action: 'reuse'; assignmentId: number }
  | { action: 'conflict'; reason: 'workstation_occupied'; employeeId: number }
  | { action: 'create'; closeAssignmentIds: number[] };

type ActiveAssignment = {
  id: number;
  userId: number;
  workstationId: string | null;
  workDayEntryId: number | null;
  workDayEndedAt: Date | null;
};

export function planWorkstationAssignment(input: {
  userId: number;
  workDayEntryId: number;
  workstationId: string;
  activeAssignments: ActiveAssignment[];
}): WorkstationAssignmentDecision {
  const live = input.activeAssignments.filter((row) => !row.workDayEndedAt);
  const same = live.find((row) => row.userId === input.userId
    && row.workDayEntryId === input.workDayEntryId
    && row.workstationId === input.workstationId);
  if (same) return { action: 'reuse', assignmentId: same.id };
  const occupied = live.find((row) => row.workstationId === input.workstationId && row.userId !== input.userId);
  if (occupied) return { action: 'conflict', reason: 'workstation_occupied', employeeId: occupied.userId };
  return {
    action: 'create',
    closeAssignmentIds: live.filter((row) => row.userId === input.userId || row.workDayEntryId === input.workDayEntryId).map((row) => row.id),
  };
}

export async function resolveWorkstationContext(prisma: PrismaClient, input: { token?: string | null; manualCode?: string | null }) {
  const token = input.token?.trim();
  const manualCode = input.manualCode?.trim();
  const binding = token ? await prisma.workstationDeviceBinding.findUnique({
    where: { tokenHash: hashWorkstationToken(token) },
    include: { workstation: true },
  }) : null;
  const deviceWorkstation = binding?.isActive && Boolean(binding.boundAt) && !binding.revokedAt && binding.workstation.isActive ? binding.workstation : null;
  const manualWorkstation = manualCode ? await prisma.retailWorkstation.findUnique({ where: { code: manualCode } }) : null;
  if (deviceWorkstation && manualWorkstation && deviceWorkstation.id !== manualWorkstation.id) {
    return { status: 'conflict' as const, workstation: null, deviceBindingId: binding!.id, source: null };
  }
  if (deviceWorkstation) {
    return { status: 'resolved' as const, workstation: deviceWorkstation, deviceBindingId: binding!.id, source: 'device_login' as const };
  }
  if (manualWorkstation?.isActive) {
    return { status: 'resolved' as const, workstation: manualWorkstation, deviceBindingId: null, source: 'manual_select' as const };
  }
  return { status: 'missing' as const, workstation: null, deviceBindingId: null, source: null };
}

export async function openWorkstationAssignment(prisma: PrismaClient, input: {
  userId: number;
  date: string;
  workDayEntryId: number;
  shiftCode: string;
  workstation: {
    id: string;
  };
  equipment?: { oneCCashRegisterRef: string; oneCCashRegisterName: string | null } | null;
  deviceBindingId: string | null;
  source: WorkstationContextSource;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  try {
    return await prisma.$transaction(async (tx) => {
      const rows = await tx.workdayKkmAssignment.findMany({
        where: {
          date: input.date,
          effectiveTo: null,
          workstationId: { not: null },
          OR: [{ workstationId: input.workstation.id }, { userId: input.userId }, { workDayEntryId: input.workDayEntryId }],
        },
        include: { workDayEntry: { select: { endedAt: true } } },
      });
      const stale = rows.filter((row) => Boolean(row.workDayEntry?.endedAt));
      for (const row of stale) {
        await tx.workdayKkmAssignment.update({
          where: { id: row.id },
          data: { effectiveTo: row.workDayEntry!.endedAt!, changeReason: 'workday_completed' },
        });
      }
      const decision = planWorkstationAssignment({
        userId: input.userId,
        workDayEntryId: input.workDayEntryId,
        workstationId: input.workstation.id,
        activeAssignments: rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          workstationId: row.workstationId,
          workDayEntryId: row.workDayEntryId,
          workDayEndedAt: row.workDayEntry?.endedAt ?? null,
        })),
      });
      if (decision.action !== 'create') return decision;
      if (decision.closeAssignmentIds.length > 0) {
        await tx.workdayKkmAssignment.updateMany({
          where: { id: { in: decision.closeAssignmentIds }, effectiveTo: null },
          data: { effectiveTo: now, changeReason: 'workstation_switch' },
        });
      }
      const created = await tx.workdayKkmAssignment.create({
        data: {
          userId: input.userId,
          date: input.date,
          plannedShiftCode: input.shiftCode,
          oneCCashRegisterRef: input.equipment?.oneCCashRegisterRef ?? null,
          oneCCashRegisterName: input.equipment?.oneCCashRegisterName ?? null,
          kkmMode: input.equipment ? 'personal' : 'workstation',
          source: input.source,
          effectiveFrom: now,
          assignedById: null,
          workDayEntryId: input.workDayEntryId,
          workstationId: input.workstation.id,
          deviceBindingId: input.deviceBindingId,
        },
        select: { id: true },
      });
      return { action: 'created' as const, assignmentId: created.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (!isWorkstationAssignmentRace(error)) throw error;
    const winner = await prisma.workdayKkmAssignment.findFirst({
      where: {
        date: input.date,
        workstationId: input.workstation.id,
        effectiveTo: null,
      },
      select: { id: true, userId: true, workDayEntryId: true },
    });
    if (winner?.userId === input.userId && winner.workDayEntryId === input.workDayEntryId) {
      return { action: 'reuse' as const, assignmentId: winner.id };
    }
    if (winner) return { action: 'conflict' as const, reason: 'workstation_occupied' as const, employeeId: winner.userId };
    throw error;
  }
}
