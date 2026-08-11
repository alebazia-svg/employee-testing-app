import { PrismaClient } from '@prisma/client';

type Input = {
  label: string;
  terminalKey: string;
  tbankTerminalId?: string;
  oneCAcquiringTerminalRef: string;
  oneCCashRegisterRef: string;
  kktRegistrationNumber: string;
  effectiveFrom: string;
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
    const conflict = await prisma.terminalFiscalMapping.findFirst({
      where: {
        isActive: true,
        effectiveTo: null,
        OR: [
          { terminalKey: input.terminalKey.trim() },
          { oneCAcquiringTerminalRef: input.oneCAcquiringTerminalRef.trim() },
          { kktRegistrationNumber: input.kktRegistrationNumber.trim() },
        ],
      },
      select: { id: true },
    });
    if (conflict) throw new Error('Active mapping conflict');
    const mapping = await prisma.terminalFiscalMapping.create({
      data: {
        label: input.label.trim(),
        terminalKey: input.terminalKey.trim(),
        tbankTerminalId: input.tbankTerminalId?.trim() || null,
        oneCAcquiringTerminalRef: input.oneCAcquiringTerminalRef.trim(),
        oneCCashRegisterRef: input.oneCCashRegisterRef.trim(),
        kktRegistrationNumber: input.kktRegistrationNumber.trim(),
        effectiveFrom,
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
