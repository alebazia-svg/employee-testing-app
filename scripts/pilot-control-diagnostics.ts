import { prisma } from '@/lib/prisma';

function moscowTime(value: Date | null) {
  return value?.toLocaleTimeString('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }) ?? null;
}

async function main() {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const from = new Date(`${today}T00:00:00+03:00`);
  const to = new Date(from.getTime() + 24 * 60 * 60_000);
  const runs = await prisma.terminalFiscalMatchRun.findMany({
    where: { periodFrom: { gte: from }, periodTo: { lte: to } },
    orderBy: { createdAt: 'desc' },
    include: { mapping: { select: { label: true } } },
  });
  const latestRunByMapping = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    if (!latestRunByMapping.has(run.mappingId)) latestRunByMapping.set(run.mappingId, run);
  }
  const latestByMapping = [...latestRunByMapping.values()];
  const terminal = await Promise.all(latestByMapping.map(async (run) => ({
    mapping: run.mapping.label,
    complete: { tbank: run.tbankComplete, oneC: run.oneCComplete, ofd: run.ofdComplete },
    matches: (await prisma.terminalFiscalMatch.findMany({
      where: { runId: run.id }, orderBy: { bankOperationAt: 'asc' },
      select: { bankOperationAt: true, status: true, reasonCode: true, oneCSourceRef: true, ofdFiscalKeyHash: true },
    })).map((match) => ({
      time: moscowTime(match.bankOperationAt), status: match.status, reason: match.reasonCode,
      oneCCheckFound: Boolean(match.oneCSourceRef), ofdReceiptFound: Boolean(match.ofdFiscalKeyHash),
    })),
  })));

  const creditRun = await prisma.creditRealizationControlRun.findFirst({ orderBy: { createdAt: 'desc' } });
  const creditCases = await prisma.creditRealizationControlCase.findMany({
    orderBy: { realizationAt: 'asc' },
    select: {
      documentNumber: true, realizationAt: true, amountKopecks: true, status: true, reasonCode: true,
      employeeActionCandidate: true, receiptDelayMinutes: true, lastCheckedAt: true,
    },
  });
  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(), today, terminal,
    credit: {
      latestRun: creditRun ? {
        periodFrom: creditRun.periodFrom, periodTo: creditRun.periodTo, status: creditRun.status,
        oneCComplete: creditRun.oneCComplete, ofdComplete: creditRun.ofdComplete,
        sourceDocuments: creditRun.sourceDocuments, confirmed: creditRun.confirmedCount,
        mismatch: creditRun.mismatchCount, needsReview: creditRun.needsReviewCount,
        pending: creditRun.pendingCount, unavailable: creditRun.unavailableCount,
        error: creditRun.lastErrorCode,
      } : null,
      cases: creditCases.map((item) => ({
        document: item.documentNumber, time: moscowTime(item.realizationAt), amount: item.amountKopecks / 100,
        status: item.status, reason: item.reasonCode, employeeAction: item.employeeActionCandidate,
        receiptDelayMinutes: item.receiptDelayMinutes, lastCheckedAt: item.lastCheckedAt,
      })),
    },
  }, null, 2));
}

main().finally(() => prisma.$disconnect());
