import { PrismaClient } from '@prisma/client';
import { createWorkstationToken, hashWorkstationToken } from '../lib/workstation-context';

type Input = {
  code: string;
  label: string;
  deviceLabel: string;
  terminalFiscalMappingId?: string;
};

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Input;
}

async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Refusing to write without --confirm');
  const input = await readStdin();
  if (!/^retail-[a-z0-9-]+$/.test(input.code)) throw new Error('Invalid stable workstation code');
  const required = ['label', 'deviceLabel'] as const;
  if (required.some((field) => !String(input[field] ?? '').trim())) throw new Error('Incomplete workstation input');
  const token = createWorkstationToken();
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const mappingId = input.terminalFiscalMappingId?.trim() || null;
      if (mappingId) {
        const mapping = await tx.terminalFiscalMapping.findUnique({ where: { id: mappingId }, select: { isActive: true, workstationId: true } });
        if (!mapping?.isActive || mapping.workstationId) throw new Error('Terminal mapping is unavailable or already attached');
      }
      const workstation = await tx.retailWorkstation.create({
        data: {
          code: input.code,
          label: input.label.trim(),
          deviceBindings: { create: { tokenHash: hashWorkstationToken(token), label: input.deviceLabel.trim() } },
        },
        select: { id: true, code: true },
      });
      const attachedMapping = mappingId
        ? await tx.terminalFiscalMapping.update({ where: { id: mappingId }, data: { workstationId: workstation.id }, select: { id: true } })
        : null;
      return { workstation, attachedMappingId: attachedMapping?.id ?? null };
    });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result, deviceToken: token, warning: 'Store this token on the workstation; it is shown once.' })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Workstation configuration failed'}\n`);
  process.exitCode = 1;
});
