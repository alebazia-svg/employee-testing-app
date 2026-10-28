import {applyFiscalAmountCoverage} from './terminal-fiscal-amount-coverage';
import { loadHistoricalCabinetEvidence } from '@/lib/tbank-cabinet-snapshot';
import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  bankOperationKey,
  canonicalFiscalKey,
  reconcileTerminalFiscalMvp,
  TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS,
  TERMINAL_FISCAL_MATCHING_VERSION,
  type TerminalMapping,
} from '@/lib/terminal-fiscal-matching';
import {
  acquireTerminalFiscalRunLease,
  failTerminalFiscalRun,
  persistTerminalFiscalCycle,
  terminalFiscalCycleKey,
} from '@/lib/terminal-fiscal-persistence';
import { loadCompleteTBankOperations, loadOneCTerminalFiscalEvidence, loadPlatformaOfdReceipts, technicalHash } from '@/lib/terminal-fiscal-sources';
import { getMoscowDateKey } from '@/lib/workday';
import { summarizeTerminalFiscalOutput } from '@/lib/terminal-fiscal-summary';
import { syncTerminalFiscalWorkdayControl } from '@/lib/terminal-fiscal-workday-control';
import {
  attributePeriodCoveredCashiers,
  oneCChecksAvailableForEmployeeReview,
  syncTerminalFiscalEmployeeReviews,
} from '@/lib/terminal-fiscal-employee-review';
import { syncTerminalFiscalSourceHealth } from '@/lib/terminal-fiscal-source-health';

function dateOnly(value: Date) {
  return getMoscowDateKey(value);
}

function nextDateKey(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function runTerminalFiscalHistoricalDryRun(input: {
  mappingId: string;
  periodFrom: Date;
  periodTo: Date;
  persist?: boolean;
  includeEvidence?: boolean;
  syncWorkdayControl?: boolean;
  syncSourceHealth?: boolean;
  deferEmployeeReviewSync?: boolean;
  closingEmployeeId?: number;
}, dependencies: {
  loadTbank?: typeof loadCompleteTBankOperations;
  loadOneC?: typeof loadOneCTerminalFiscalEvidence;
  loadOfd?: typeof loadPlatformaOfdReceipts;
} = {}) {
  const duration = input.periodTo.getTime() - input.periodFrom.getTime();
  if (!(duration > 0 && duration <= 7 * 24 * 60 * 60 * 1000)) throw new Error('TERMINAL_FISCAL_PERIOD_OUT_OF_RANGE');
  const mappingRow = await prisma.terminalFiscalMapping.findUnique({ where: { id: input.mappingId } });
  if (!mappingRow || !mappingRow.isActive) throw new Error('TERMINAL_FISCAL_MAPPING_NOT_FOUND');
  const mapping: TerminalMapping = {
    id: mappingRow.id,
    terminalKey: mappingRow.terminalKey,
    oneCAcquiringTerminalRef: mappingRow.oneCAcquiringTerminalRef,
    oneCCashRegisterRef: mappingRow.oneCCashRegisterRef,
    kktRegistrationNumber: mappingRow.kktRegistrationNumber,
    activeFrom: mappingRow.effectiveFrom.toISOString(),
    activeTo: mappingRow.effectiveTo?.toISOString(),
  };
  const lease = input.persist === true ? await acquireTerminalFiscalRunLease(prisma, {
    algorithmVersion: TERMINAL_FISCAL_MATCHING_VERSION,
    mappingId: mapping.id,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
  }) : null;
  if (input.persist === true && !lease) return { acquired: false as const };
  try {
    const lateMatchTo = new Date(Math.min(Date.now(), input.periodTo.getTime() + TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS));
    const [tbank, oneC, ofd] = await Promise.all([
      // Include competing later payments so a later day's own check cannot
      // falsely close an older same-amount gap.
      (dependencies.loadTbank ?? loadCompleteTBankOperations)({ terminalKey: mapping.terminalKey, from: input.periodFrom.toISOString(), to: lateMatchTo.toISOString() }),
      (dependencies.loadOneC ?? loadOneCTerminalFiscalEvidence)({ fromDate: dateOnly(input.periodFrom), toDate: nextDateKey(dateOnly(lateMatchTo)) }),
      (dependencies.loadOfd ?? loadPlatformaOfdReceipts)({ kktRegistrationNumber: mapping.kktRegistrationNumber, from: input.periodFrom.toISOString(), to: lateMatchTo.toISOString() }),
    ]);
    const archivePath = process.env.TBANK_CABINET_SNAPSHOT_PATH?.trim();
    if (archivePath) {
      const unresolved = await prisma.terminalFiscalEmployeeReview.findMany({
        where: { mappingId: mapping.id, status: { in: ['admin_review', 'open'] },
          bankOperationAt: { gte: input.periodFrom, lt: input.periodTo } }, select: { matchingHash: true },
      });
      const archived = await loadHistoricalCabinetEvidence({ path: archivePath, terminalKey: mapping.terminalKey,
        from: input.periodFrom.toISOString(), to: lateMatchTo.toISOString(),
        unresolvedHashes: new Set(unresolved.map(r => r.matchingHash)) });
      let restored = false;
      for (const operation of archived.operations) {
        // Different RRN at the same instant is not proof of a new payment.
        // Preserve the live record and leave any old ambiguous review intact.
        if (!tbank.data.some(live => live.terminalKey === operation.terminalKey
          && live.amountKopecks === operation.amountKopecks && live.type === operation.type
          && (live.rrn === operation.rrn || Date.parse(live.transactionDate) === Date.parse(operation.transactionDate)))) { tbank.data.push(operation); restored = true; }
      }
      if (restored && !archived.coversRequestedPeriod) {
        tbank.complete = false;
        tbank.errorCode = 'HISTORICAL_BANK_COVERAGE_INCOMPLETE';
      }
    }
    // Both physical aQsi devices can share one 1C acquiring terminal. Read
    // competing workplaces before widening an order match to the whole day;
    // otherwise two independent mapping runs could confirm the same order.
    const matchingMappings = [mapping];
    const matchingBankOperations = [...tbank.data];
    const matchingOfdReceipts = [...ofd.data];
    const orderCompetition = { bankComplete: true, ofdComplete: true };
    if (oneC.data.some(c => c.acquiringOrderState === 'complete'
      && c.cardPayments.some(p => p.acquiringTerminalRef === mapping.oneCAcquiringTerminalRef))) {
      let peers: Array<NonNullable<typeof mappingRow>> = [];
      try { peers = await prisma.terminalFiscalMapping.findMany({ where: {
        isActive: true, id: { not: mapping.id }, oneCAcquiringTerminalRef: mapping.oneCAcquiringTerminalRef,
        effectiveFrom: { lt: lateMatchTo }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: input.periodFrom } }],
      } }); } catch {
        orderCompetition.bankComplete = false; orderCompetition.ofdComplete = false;
      }
      for (const peer of peers) {
        matchingMappings.push({ id: peer.id, terminalKey: peer.terminalKey,
          oneCAcquiringTerminalRef: peer.oneCAcquiringTerminalRef, oneCCashRegisterRef: peer.oneCCashRegisterRef,
          kktRegistrationNumber: peer.kktRegistrationNumber, activeFrom: peer.effectiveFrom.toISOString(), activeTo: peer.effectiveTo?.toISOString() });
        const [bank, receipts] = await Promise.allSettled([
          (dependencies.loadTbank ?? loadCompleteTBankOperations)({ terminalKey: peer.terminalKey, from: input.periodFrom.toISOString(), to: lateMatchTo.toISOString() }),
          (dependencies.loadOfd ?? loadPlatformaOfdReceipts)({ kktRegistrationNumber: peer.kktRegistrationNumber, from: input.periodFrom.toISOString(), to: lateMatchTo.toISOString() }),
        ]);
        if (bank.status === 'fulfilled') matchingBankOperations.push(...bank.value.data);
        if (receipts.status === 'fulfilled') matchingOfdReceipts.push(...receipts.value.data);
        if (bank.status === 'rejected' || !bank.value.complete) orderCompetition.bankComplete = false;
        if (receipts.status === 'rejected' || !receipts.value.complete) orderCompetition.ofdComplete = false;
      }
    }
    const now = new Date().toISOString();
    const periodOneCChecks = oneC.data.filter((check) => {
      const at = new Date(check.dateTime).getTime();
      return Number.isFinite(at) && at >= input.periodFrom.getTime() && at < lateMatchTo.getTime();
    });
    const kkmChecks = oneC.data.filter((check) => check.sourceType !== 'acquiring_operation');
    const employeeReviewOneCChecks = oneCChecksAvailableForEmployeeReview({
      checks: kkmChecks,
      periodFrom: input.periodFrom,
      sourceCheckedAt: new Date(Math.min(Date.parse(oneC.checkedAt), input.periodTo.getTime() - 1)).toISOString(),
    });
    const workplaceOutput = reconcileTerminalFiscalMvp({
      now,
      sources: {
        tbank: { complete: tbank.complete, checkedAt: tbank.checkedAt, error: tbank.errorCode },
        oneC: { complete: oneC.complete, checkedAt: oneC.checkedAt, error: oneC.errorCode },
        ofd: { complete: ofd.complete, checkedAt: ofd.checkedAt, error: ofd.errorCode },
      },
      orderCompetition,
      mappings: matchingMappings,
      bankOperations: matchingBankOperations,
      oneCChecks: periodOneCChecks,
      ofdReceipts: matchingOfdReceipts,
    });
    const ownBankKeys = new Set(tbank.data.map(bankOperationKey));
    const strictOutput = { ...workplaceOutput, records: workplaceOutput.records.filter(r => ownBankKeys.has(r.bankOperationKey)) };
    const coveredOutput=applyFiscalAmountCoverage({output:strictOutput,mapping,bankOperations:tbank.data,oneCChecks:periodOneCChecks,ofdReceipts:ofd.data,from:input.periodFrom,to:input.periodTo,complete:{bank:tbank.complete,oneC:oneC.complete,ofd:ofd.complete}});
    const periodOutput = { ...coveredOutput, records: coveredOutput.records.filter(record => {
      const at = Date.parse(record.evidence.bankTransactionDate);
      return at >= input.periodFrom.getTime() && at < input.periodTo.getTime();
    }) };
    const output = attributePeriodCoveredCashiers({
      output: periodOutput,
      mapping,
      oneCChecks: employeeReviewOneCChecks,
    });
    const sourceIdentityHashes = [
      ...matchingBankOperations.map((value) => technicalHash(bankOperationKey(value))),
      ...periodOneCChecks.map((value) => technicalHash(value.sourceRef)),
      ...matchingOfdReceipts.map((value) => technicalHash(canonicalFiscalKey(value) ?? 'incomplete')),
    ];
    if (lease) {
      const cycleKey = terminalFiscalCycleKey({
        runKey: lease.runKey,
        sourceIdentityHashes,
        evaluationIdentityHashes: output.records.map((record) => technicalHash(JSON.stringify({
          matchingKey: record.matchingKey,
          status: record.status,
          reasonCode: record.reasonCode,
          oneCCheckKey: record.oneCCheckKey ?? null,
          oneCCashierRef: record.oneCCashierRef ?? null,
          amountCoverage:record.evidence.amountCoverage??null,
          ofdReceiptKey: record.ofdReceiptKey ?? null,
        }))),
      });
      await persistTerminalFiscalCycle(prisma, {
        lease,
        cycleKey,
        output,
        sourceCheckedAt: { tbank: tbank.checkedAt, oneC: oneC.checkedAt, ofd: ofd.checkedAt },
        sourceCompleteness: { tbank: tbank.complete, oneC: oneC.complete, ofd: ofd.complete },
      });
      if (input.syncSourceHealth === true) {
        await syncTerminalFiscalSourceHealth(prisma, {
          mappingId: mapping.id,
          mappingLabel: mappingRow.label,
          periodFrom: input.periodFrom,
          checkedAt: new Date(now),
          sources: {
            aqsi: { complete: tbank.complete, errorCode: tbank.errorCode },
            oneC: { complete: oneC.complete, errorCode: oneC.errorCode },
            ofd: { complete: ofd.complete, errorCode: ofd.errorCode },
          },
        });
      }
      if (input.syncWorkdayControl === true) {
        await syncTerminalFiscalWorkdayControl(prisma, output);
        const employeeReviewMode = process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED === 'true'
          ? 'notify'
          : process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_SHADOW_ENABLED === 'true'
            ? 'shadow'
            : null;
        if (employeeReviewMode && input.deferEmployeeReviewSync !== true) {
          await syncTerminalFiscalEmployeeReviews(prisma, {
            output,
            closingEmployeeId: input.closingEmployeeId,
            mapping,
            oneCChecks: employeeReviewOneCChecks,
            mode: employeeReviewMode,
          });
        }
      }
    }
    const summary = summarizeTerminalFiscalOutput(output);
    const employeeReviewMode = process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED === 'true'
      ? 'notify' as const
      : process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_SHADOW_ENABLED === 'true'
        ? 'shadow' as const
        : null;
    return {
      acquired: true as const,
      output: input.includeEvidence ? output : undefined,
      evidence: input.includeEvidence ? {bankOperations:tbank.data,oneCChecks:periodOneCChecks,ofdReceipts:ofd.data,mapping,
        complete:{bank:tbank.complete,oneC:oneC.complete,ofd:ofd.complete}} : undefined,
      persisted: Boolean(lease),
      summary: input.syncWorkdayControl === true
        ? { ...summary, safety: { employeeVisible: true, incidentCreation: true, notifications: true } as const }
        : summary,
      employeeReviewContext: input.deferEmployeeReviewSync === true && employeeReviewMode
        ? { output, mapping, oneCChecks: employeeReviewOneCChecks, mode: employeeReviewMode }
        : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const errorCode = /^[A-Z0-9_]{1,100}$/.test(message) ? message : 'TERMINAL_FISCAL_RUN_FAILED';
    if (lease) await failTerminalFiscalRun(prisma, lease, errorCode);
    throw error;
  }
}
