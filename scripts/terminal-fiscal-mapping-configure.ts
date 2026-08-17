import { PrismaClient } from '@prisma/client';
import { terminalFiscalMappingConflictFields } from '../lib/terminal-fiscal-mapping-validation';

type Input = {
  label: string;
  terminalKey: string;
  tbankTerminalId?: string;
  oneCAcquiringTerminalRef: string;
  oneCCashRegisterRef: string;
  kktRegistrationNumber: string;
  effectiveFrom: string;
  workstationCode?: string;
};

function mask(value: string) {
  return value.length <= 6 ? '***' : `${value.slice(0, 3)}…${value.slice(-3)}`;
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Input;
}

async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Refusing to write without --confirm');
  const input = await readStdin();
  const required = ['label', 'terminalKey', 'oneCAcquiringTerminalRef', 'oneCCashRegisterRef', 'kktRegistrationNumber', 'effectiveFrom'] as const;
  if (required.some((field) => typeof input[field] !== 'string' || !input[field].trim())) throw new Error('Incomplete mapping input');
  const effectiveFrom = new Date(input.effectiveFrom);
  if (Number.isNaN(effectiveFrom.getTime())) throw new Error('Invalid effectiveFrom');
  const prisma = new PrismaClient();
  try {
    const workstationCode = input.workstationCode?.trim() || null;
    const workstation = workstationCode
      ? await prisma.retailWorkstation.findUnique({ where: { code: workstationCode }, select: { id: true, isActive: true } })
      : null;
    if (workstationCode && !workstation?.isActive) throw new Error('Active workstation not found');
    const possibleConflicts = await prisma.terminalFiscalMapping.findMany({
      where: {
        isActive: true,
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
        AND: [{ OR: [
          { terminalKey: input.terminalKey.trim() },
          { oneCCashRegisterRef: input.oneCCashRegisterRef.trim() },
          { kktRegistrationNumber: input.kktRegistrationNumber.trim() },
        ] }],
      },
      select: {
        id: true, terminalKey: true, oneCAcquiringTerminalRef: true, oneCCashRegisterRef: true,
        kktRegistrationNumber: true, effectiveFrom: true, effectiveTo: true,
      },
    });
    const candidate = {
      terminalKey: input.terminalKey.trim(),
      oneCAcquiringTerminalRef: input.oneCAcquiringTerminalRef.trim(),
      oneCCashRegisterRef: input.oneCCashRegisterRef.trim(),
      kktRegistrationNumber: input.kktRegistrationNumber.trim(),
      effectiveFrom,
      effectiveTo: null,
    };
    const conflict = possibleConflicts.find((row) => terminalFiscalMappingConflictFields(candidate, row).length > 0);
    if (conflict) {
      throw new Error(`Active mapping conflict: ${terminalFiscalMappingConflictFields(candidate, conflict).join(',')}`);
    }
    const mapping = await prisma.terminalFiscalMapping.create({
      data: {
        label: input.label.trim(),
        terminalKey: input.terminalKey.trim(),
        tbankTerminalId: input.tbankTerminalId?.trim() || null,
        oneCAcquiringTerminalRef: input.oneCAcquiringTerminalRef.trim(),
        oneCCashRegisterRef: input.oneCCashRegisterRef.trim(),
        kktRegistrationNumber: input.kktRegistrationNumber.trim(),
        effectiveFrom,
        workstationId: workstation?.id ?? null,
        source: 'confirmed_live_preview',
      },
      select: { id: true, terminalKey: true, kktRegistrationNumber: true, label: true, effectiveFrom: true },
    });
    process.stdout.write(`${JSON.stringify({ ok: true, mappingId: mapping.id, label: mapping.label, terminalKey: mask(mapping.terminalKey), kkt: mask(mapping.kktRegistrationNumber), effectiveFrom: mapping.effectiveFrom.toISOString() })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Mapping configuration failed'}\n`);
  process.exitCode = 1;
});
