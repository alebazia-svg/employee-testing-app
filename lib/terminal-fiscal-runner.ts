import 'server-only';

import { prisma } from '@/lib/prisma';
import {
  bankOperationKey,
  canonicalFiscalKey,
  reconcileTerminalFiscalMvp,
  TERMINAL_FISCAL_MATCHING_VERSION,
  type TerminalMapping,
} from '@/lib/terminal-fiscal-matching';
import {
  acquireTerminalFiscalRunLease,
  failTerminalFiscalRun,
  persistTerminalFiscalCycle,
  terminalFiscalCycleKey,
} from '@/lib/terminal-fiscal-persistence';
import { loadCompleteTBankOperations, loadOneCKkmChecks, loadPlatformaOfdReceipts, technicalHash } from '@/lib/terminal-fiscal-sources';
import { getMoscowDateKey } from '@/lib/workday';
import { summarizeTerminalFiscalOutput } from '@/lib/terminal-fiscal-summary';
import { syncTerminalFiscalWorkdayControl } from '@/lib/terminal-fiscal-workday-control';
import { syncTerminalFiscalEmployeeReviews } from '@/lib/terminal-fiscal-employee-review';

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
  syncWorkdayControl?: boolean;
}, dependencies: {
  loadTbank?: typeof loadCompleteTBankOperations;
  loadOneC?: typeof loadOneCKkmChecks;
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
    const [tbank, oneC, ofd] = await Promise.all([
      (dependencies.loadTbank ?? loadCompleteTBankOperations)({ terminalKey: mapping.terminalKey, from: input.periodFrom.toISOString(), to: input.periodTo.toISOString() }),
      (dependencies.loadOneC ?? loadOneCKkmChecks)({ fromDate: dateOnly(input.periodFrom), toDate: nextDateKey(dateOnly(new Date(input.periodTo.getTime() - 1))) }),
      (dependencies.loadOfd ?? loadPlatformaOfdReceipts)({ kktRegistrationNumber: mapping.kktRegistrationNumber, from: input.periodFrom.toISOString(), to: input.periodTo.toISOString() }),
    ]);
    const now = new Date().toISOString();
    const periodOneCChecks = oneC.data.filter((check) => {
      const at = new Date(check.dateTime).getTime();
      return Number.isFinite(at) && at >= input.periodFrom.getTime() && at < input.periodTo.getTime();
    });
    const output = reconcileTerminalFiscalMvp({
      now,
      sources: {
        tbank: { complete: tbank.complete, checkedAt: tbank.checkedAt, error: tbank.errorCode },
        oneC: { complete: oneC.complete, checkedAt: oneC.checkedAt, error: oneC.errorCode },
        ofd: { complete: ofd.complete, checkedAt: ofd.checkedAt, error: ofd.errorCode },
      },
      mappings: [mapping],
      bankOperations: tbank.data,
      oneCChecks: periodOneCChecks,
      ofdReceipts: ofd.data,
    });
    const sourceIdentityHashes = [
      ...tbank.data.map((value) => technicalHash(bankOperationKey(value))),
      ...periodOneCChecks.map((value) => technicalHash(value.sourceRef)),
      ...ofd.data.map((value) => technicalHash(canonicalFiscalKey(value) ?? 'incomplete')),
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
      if (input.syncWorkdayControl === true) {
        await syncTerminalFiscalWorkdayControl(prisma, output);
        if (process.env.TERMINAL_FISCAL_EMPLOYEE_REVIEW_ENABLED === 'true') {
          await syncTerminalFiscalEmployeeReviews(prisma, { output, mapping, oneCChecks: periodOneCChecks });
        }
      }
    }
    const summary = summarizeTerminalFiscalOutput(output);
    return {
      acquired: true as const,
      persisted: Boolean(lease),
      summary: input.syncWorkdayControl === true
        ? { ...summary, safety: { employeeVisible: true, incidentCreation: true, notifications: true } as const }
        : summary,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const errorCode = /^[A-Z0-9_]{1,100}$/.test(message) ? message : 'TERMINAL_FISCAL_RUN_FAILED';
    if (lease) await failTerminalFiscalRun(prisma, lease, errorCode);
    throw error;
  }
}
