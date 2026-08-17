import { PrismaClient } from '@prisma/client';

type Input = { userId: number; oneCCashierRef: string; oneCCashierName: string };

function normalize(value: string) {
  return value.normalize('NFKC').replace(/[ёЁ]/g, 'е').toLocaleLowerCase('ru-RU').replace(/[^а-яa-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

async function readStdin() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Input;
}

async function main() {
  if (!process.argv.includes('--confirm')) throw new Error('Refusing to write without --confirm');
  const input = await readStdin();
  if (!Number.isInteger(input.userId) || !input.oneCCashierRef?.trim() || !input.oneCCashierName?.trim()) throw new Error('Incomplete cashier mapping input');
  const prisma = new PrismaClient();
  try {
    const employee = await prisma.user.findFirst({ where: { id: input.userId, role: 'EMPLOYEE', isActive: true }, select: { id: true, name: true } });
    if (!employee || normalize(employee.name) !== normalize(input.oneCCashierName)) throw new Error('Employee identity does not match cashier name');
    const collision = await prisma.userOneCCashboxMapping.findFirst({ where: { oneCCashierRef: input.oneCCashierRef.trim(), userId: { not: input.userId } }, select: { userId: true } });
    if (collision) throw new Error('Cashier ref is already assigned to another employee');
    const mapping = await prisma.userOneCCashboxMapping.update({
      where: { userId: input.userId },
      data: { oneCCashierRef: input.oneCCashierRef.trim(), oneCCashierName: input.oneCCashierName.trim() },
      select: { userId: true, oneCCashierRef: true, oneCCashierName: true },
    });
    process.stdout.write(`${JSON.stringify({ ok: true, mapping })}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Cashier mapping failed'}\n`);
  process.exitCode = 1;
});
