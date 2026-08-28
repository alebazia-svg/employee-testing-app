import { prisma } from '@/lib/prisma';
import { getCashStatementDimensions, previewOneCCashExpenseOrder } from '@/lib/one-c';

const targetIds = [4, 5, 6, 7];
const targetNames = { phone_reserve: 'резерв под телефоны', deposit_safe: 'сейф депозитный' } as const;
const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е');

async function main() {
  const apply = process.argv.includes('--confirm-portal-write');
  const operations = await prisma.cashOperation.findMany({
    where: { id: { in: targetIds } },
    include: { user: { select: { name: true, oneCCashboxMapping: true } } },
    orderBy: { id: 'asc' },
  });
  if (operations.length !== targetIds.length) throw new Error('Not all target operations exist');

  const dimensions = await getCashStatementDimensions();
  const organization = dimensions.organizations.find((item) => normalize(item.name).includes('оффоника')) ?? dimensions.organizations[0] ?? null;
  if (!dimensions.ok || !organization) throw new Error('1C dimensions unavailable');

  const verified = [];
  for (const operation of operations) {
    const mapping = operation.user.oneCCashboxMapping;
    const targetName = targetNames[operation.direction as keyof typeof targetNames];
    const target = targetName ? dimensions.cashboxes.find((item) => normalize(item.name) === targetName) : null;
    if (!mapping?.isActive || !target) throw new Error(`Mapping unavailable for operation ${operation.id}`);
    const preview = await previewOneCCashExpenseOrder({
      idempotencyKey: operation.idempotencyKey,
      organizationRef: organization.ref,
      cashboxRef: mapping.oneCCashboxRef,
      targetCashboxRef: target.ref,
      employeeName: operation.user.name,
      amount: operation.amount,
      direction: operation.direction as keyof typeof targetNames,
      employeeComment: operation.comment,
    });
    if (!preview.ok || !preview.idempotentReplay || !preview.pairComplete || !preview.document || !preview.receiptDocument || preview.document.posted !== true || preview.receiptDocument.posted !== true) {
      throw new Error(`Complete posted 1C pair not verified for operation ${operation.id}`);
    }
    verified.push({ operation, document: preview.document, receipt: preview.receiptDocument });
  }

  const before = verified.map(({ operation }) => ({ id: operation.id, status: operation.status, hasExpenseRef: Boolean(operation.oneCDocumentRef), hasReceiptRef: Boolean(operation.oneCReceiptDocumentRef) }));
  if (apply) {
    await prisma.$transaction(verified.map(({ operation, document, receipt }) => prisma.cashOperation.update({
      where: { id: operation.id },
      data: {
        status: 'posted_1c_pair',
        oneCDocumentRef: document.ref,
        oneCDocumentNumber: document.number,
        oneCReceiptDocumentRef: receipt.ref,
        oneCReceiptDocumentNumber: receipt.number,
        oneCError: '',
        oneCCreatedAt: operation.oneCCreatedAt ?? new Date(),
        oneCPostedAt: operation.oneCPostedAt ?? new Date(),
      },
    })));
  }
  const readback = await prisma.cashOperation.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, status: true, oneCDocumentRef: true, oneCReceiptDocumentRef: true, oneCError: true },
    orderBy: { id: 'asc' },
  });
  const after = readback.map((row) => ({ id: row.id, status: row.status, hasExpenseRef: Boolean(row.oneCDocumentRef), hasReceiptRef: Boolean(row.oneCReceiptDocumentRef), errorCleared: row.oneCError === '' }));
  const verifiedAfterWrite = !apply || after.every((row) => row.status === 'posted_1c_pair' && row.hasExpenseRef && row.hasReceiptRef && row.errorCleared);
  process.stdout.write(`${JSON.stringify({ ok: verifiedAfterWrite, applied: apply, before, after })}\n`);
  if (!verifiedAfterWrite) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
