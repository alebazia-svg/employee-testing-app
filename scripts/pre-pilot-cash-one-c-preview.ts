import { prisma } from '@/lib/prisma';
import { getCashStatementDimensions, previewOneCCashExpenseOrder } from '@/lib/one-c';

const targetNames = { phone_reserve: 'резерв под телефоны', deposit_safe: 'сейф депозитный' } as const;
const normalize = (value: string) => value.trim().toLowerCase().replace(/ё/g, 'е');

async function main() {
  const operations = await prisma.cashOperation.findMany({
    where: { id: { in: [1, 2, 3, 4, 5, 6, 7] } },
    include: { user: { select: { name: true, oneCCashboxMapping: true } } },
    orderBy: { id: 'asc' },
  });
  const dimensions = await getCashStatementDimensions();
  const organization = dimensions.organizations.find((item) => normalize(item.name).includes('оффоника')) ?? dimensions.organizations[0] ?? null;
  if (!dimensions.ok || !organization) throw new Error('1C dimensions unavailable');

  const results = [];
  for (const operation of operations) {
    const mapping = operation.user.oneCCashboxMapping;
    const targetName = targetNames[operation.direction as keyof typeof targetNames];
    const target = targetName ? dimensions.cashboxes.find((item) => normalize(item.name) === targetName) : null;
    if (!mapping?.isActive || !target) {
      results.push({ id: operation.id, previewOk: false, reason: 'mapping_unavailable' });
      continue;
    }
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
    results.push({
      id: operation.id, previewOk: preview.ok, idempotentReplay: preview.idempotentReplay,
      confirmationRequired: preview.confirmationRequired, pairComplete: preview.pairComplete,
      expenseExists: Boolean(preview.document), expensePosted: preview.document?.posted ?? null,
      receiptExists: Boolean(preview.receiptDocument), receiptPosted: preview.receiptDocument?.posted ?? null,
      error: preview.error ?? null,
    });
  }
  console.log(JSON.stringify({ mode: 'one_c_preview_only', results }, null, 2));
}

main().finally(() => prisma.$disconnect());
