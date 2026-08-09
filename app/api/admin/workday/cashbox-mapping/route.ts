import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCashStatementDimensions, getKkmEquipmentDiagnostics } from '@/lib/one-c';
import { prisma } from '@/lib/prisma';
import { getMoscowDateKey, usesWorkdayShiftControl } from '@/lib/workday';

function redirectWithStatus(req: Request, redirectTo: string | null, key: 'cashboxMapping' | 'cashboxMappingError', value: string) {
  const target = new URL(redirectTo?.startsWith('/admin/workday') ? redirectTo : '/admin/workday', req.url);
  target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await req.formData();
  const redirectTo = formData.get('redirectTo');
  const userId = Number(formData.get('userId'));
  const oneCCashboxRef = String(formData.get('oneCCashboxRef') ?? '').trim();
  const oneCCashRegisterRef = String(formData.get('oneCCashRegisterRef') ?? '').trim();
  const oneCAcquiringTerminalRef = String(formData.get('oneCAcquiringTerminalRef') ?? '').trim();
  const tbankTerminalId = String(formData.get('tbankTerminalId') ?? '').trim();
  const kkmModeValue = String(formData.get('kkmMode') ?? 'personal').trim();
  const kkmMode = kkmModeValue === 'server' ? 'server' : 'personal';

  if (!Number.isInteger(userId) || userId <= 0) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'invalid-user');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, department: true },
  });

  if (!user || !usesWorkdayShiftControl(user)) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'unsupported-user');
  }

  if (!oneCCashboxRef) {
    await prisma.userOneCCashboxMapping.deleteMany({ where: { userId } });
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMapping', 'cleared');
  }

  const today = getMoscowDateKey();
  const [dimensions, kkmDiagnostics] = await Promise.all([
    getCashStatementDimensions(),
    getKkmEquipmentDiagnostics({ dateFrom: today, dateTo: today, limit: 300 }),
  ]);
  const cashbox = dimensions.cashboxes.find((item) => item.ref === oneCCashboxRef);

  if (!dimensions.ok || !cashbox) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'cashbox-not-found');
  }

  const cashRegisters = new Map(kkmDiagnostics.catalogCashRegisters.map((item) => [item.ref, item]));
  for (const item of kkmDiagnostics.cashRegisterUsage) cashRegisters.set(item.cashRegister.ref, item.cashRegister);
  for (const check of kkmDiagnostics.recentChecks) cashRegisters.set(check.cashRegister.ref, check.cashRegister);
  const acquiringTerminals = new Map(kkmDiagnostics.catalogAcquiringTerminals.map((item) => [item.ref, item]));
  for (const item of kkmDiagnostics.acquiringTerminalUsage) acquiringTerminals.set(item.acquiringTerminal.ref, item.acquiringTerminal);
  const cashRegister = oneCCashRegisterRef ? cashRegisters.get(oneCCashRegisterRef) ?? null : null;
  const acquiringTerminal = oneCAcquiringTerminalRef ? acquiringTerminals.get(oneCAcquiringTerminalRef) ?? null : null;
  if (oneCCashRegisterRef && !cashRegister) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'kkm-not-found');
  }
  if (oneCAcquiringTerminalRef && !acquiringTerminal) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'terminal-not-found');
  }

  await prisma.userOneCCashboxMapping.upsert({
    where: { userId },
    create: {
      userId,
      oneCCashboxRef: cashbox.ref,
      oneCCashboxName: cashbox.name,
      oneCCashRegisterRef: cashRegister?.ref ?? null,
      oneCCashRegisterName: cashRegister?.name ?? null,
      oneCAcquiringTerminalRef: acquiringTerminal?.ref ?? null,
      oneCAcquiringTerminalName: acquiringTerminal?.name ?? null,
      tbankTerminalId: tbankTerminalId || null,
      kkmMode,
      isActive: true,
    },
    update: {
      oneCCashboxRef: cashbox.ref,
      oneCCashboxName: cashbox.name,
      oneCCashRegisterRef: cashRegister?.ref ?? null,
      oneCCashRegisterName: cashRegister?.name ?? null,
      oneCAcquiringTerminalRef: acquiringTerminal?.ref ?? null,
      oneCAcquiringTerminalName: acquiringTerminal?.name ?? null,
      tbankTerminalId: tbankTerminalId || null,
      kkmMode,
      isActive: true,
    },
  });

  return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMapping', 'saved');
}
