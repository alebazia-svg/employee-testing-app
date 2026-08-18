import 'server-only';

import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { exportUnifiedAusnOfdReceipts, fiscalKey, type AusnOfdReceipt } from '@/lib/ausn-ofd';
import {
  buildCreditRealizationControlInput,
  creditFiscalKey,
  evaluateCreditRealization,
  type CreditRealizationControlInput,
  type CreditRealizationControlResult,
} from '@/lib/credit-realization-control';
import {
  getSalesRealizationLinks,
  getSalesRealizations,
  type OneCSalesRealizationDocument,
  type OneCSalesRealizationLinks,
} from '@/lib/one-c';
import { loadOneCKkmChecks } from '@/lib/terminal-fiscal-sources';
import { syncCreditRealizationWorkdayControl } from '@/lib/credit-realization-workday-control';

export const CREDIT_REALIZATION_CONTROL_VERSION = 'credit-shadow-v1';
export const CREDIT_REALIZATION_EMPLOYEE_CONTROL_ENABLED = process.env.CREDIT_REALIZATION_EMPLOYEE_CONTROL_ENABLED === 'true';
export const CREDIT_REALIZATION_CUSTOMER_REF = '537e501e-4640-11ed-8f49-0025901e48ee';
const PAGE_LIMIT = 500;
const MAX_OFFSET = 5_000;
const MONEY_TOLERANCE = 0.01;

function digest(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function oneCCheckFiscalKey(check: { fiscalDriveNumber?: string; fiscalDocumentNumber?: string; fiscalSign?: string }) {
  const parts = [check.fiscalDriveNumber, check.fiscalDocumentNumber, check.fiscalSign].map((value) => value?.trim() ?? '');
  return parts.every(Boolean) ? parts.join(':') : '';
}

function moscowDate(value: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(value);
}

function parseOneCDate(value: string) {
  const match = value.match(/^(\d{1,2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return new Date(value);
  return new Date(Date.UTC(
    Number(match[3]), Number(match[2]) - 1, Number(match[1]),
    Number(match[4]) - 3, Number(match[5]), Number(match[6] ?? 0),
  ));
}

function moneyMatches(left: number, right: number) {
  return Math.abs(left - right) <= MONEY_TOLERANCE;
}

function exactUnlinkedReceipts(links: OneCSalesRealizationLinks, receipts: AusnOfdReceipt[]) {
  const realization = links.realization;
  if (!realization || realization.amount === null) return [];
  const directPayments = [
    ...links.cashReceipts.direct.map((document) => ({ kind: 'cash' as const, document })),
    ...links.acquiring.direct.map((document) => ({ kind: 'electronic' as const, document })),
  ];
  if (directPayments.length > 1 || directPayments.some(({ document }) => document.amount === null)) return [];
  const payment = directPayments[0];
  const paymentAmount = payment?.document.amount ?? 0;
  const expectedCash = payment?.kind === 'cash' ? paymentAmount : 0;
  const expectedElectronic = payment?.kind === 'electronic' ? paymentAmount : 0;
  const expectedCredit = realization.amount - paymentAmount;
  const sourceAt = Math.max(
    parseOneCDate(realization.date).getTime(),
    ...(payment ? [parseOneCDate(payment.document.date).getTime()] : []),
  );
  const linkedKeys = new Set(links.fiscalControl.documents.flatMap((document) => (
    document.operations.map(creditFiscalKey).filter(Boolean)
  )));

  return receipts.filter((receipt) => {
    const receiptAt = new Date(receipt.date).getTime();
    return receipt.operationType === 1
      && !linkedKeys.has(fiscalKey(receipt))
      && receiptAt >= sourceAt - 60 * 60_000
      && receiptAt <= sourceAt + 7 * 24 * 60 * 60_000
      && moneyMatches(receipt.totalSum, realization.amount!)
      && moneyMatches(receipt.cashTotalSum, expectedCash)
      && moneyMatches(receipt.ecashTotalSum, expectedElectronic)
      && moneyMatches(receipt.prepaidSum, 0)
      && moneyMatches(receipt.creditSum, expectedCredit);
  }).map((receipt) => ({
    datetime: receipt.date,
    total: receipt.totalSum,
    cash: receipt.cashTotalSum,
    electronic: receipt.ecashTotalSum,
    credit: receipt.creditSum,
  }));
}

async function loadRealizations(periodFrom: Date, periodTo: Date) {
  const documents: OneCSalesRealizationDocument[] = [];
  const apiDateTo = moscowDate(new Date(periodTo.getTime() + 24 * 60 * 60_000));
  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_LIMIT) {
    const page = await getSalesRealizations({
      dateFrom: moscowDate(periodFrom),
      dateTo: apiDateTo,
      customerRef: CREDIT_REALIZATION_CUSTOMER_REF,
      posted: 'all',
      limit: PAGE_LIMIT,
      offset,
      includeLines: false,
    });
    if (!page.ok) return { complete: false, documents, errorCode: 'ONE_C_REALIZATIONS_INCOMPLETE' };
    documents.push(...page.documents.filter((document) => {
      const documentAt = parseOneCDate(document.date).getTime();
      return Number.isFinite(documentAt)
        && documentAt >= periodFrom.getTime()
        && documentAt < periodTo.getTime();
    }));
    if (page.responseDocumentCount < PAGE_LIMIT) return { complete: true, documents, errorCode: null };
  }
  return { complete: false, documents, errorCode: 'ONE_C_REALIZATIONS_OFFSET_LIMIT' };
}

async function mapConcurrent<T, R>(values: T[], concurrency: number, map: (value: T) => Promise<R>) {
  let index = 0;
  const output = new Array<R>(values.length);
  async function worker() {
    while (index < values.length) {
      const current = index++;
      output[current] = await map(values[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, worker));
  return output;
}

export type CreditShadowSnapshotRow = {
  document: OneCSalesRealizationDocument;
  links: OneCSalesRealizationLinks;
  result: CreditRealizationControlResult;
  evidenceHash: string;
  receiptCashierRef: string | null;
  receiptCashierName: string | null;
};

export type CreditShadowSnapshot = {
  checkedAt: Date;
  periodFrom: Date;
  periodTo: Date;
  complete: boolean;
  oneCComplete: boolean;
  ofdComplete: boolean;
  errorCode: string | null;
  rows: CreditShadowSnapshotRow[];
};

export async function loadCreditRealizationShadowSnapshot(input: {
  periodFrom: Date;
  periodTo: Date;
  now?: Date;
}): Promise<CreditShadowSnapshot> {
  const checkedAt = input.now ?? new Date();
  const realizations = await loadRealizations(input.periodFrom, input.periodTo);
  if (!realizations.complete) {
    return { checkedAt, periodFrom: input.periodFrom, periodTo: input.periodTo, complete: false, oneCComplete: false, ofdComplete: false, errorCode: realizations.errorCode, rows: [] };
  }

  const linksResults = await mapConcurrent(realizations.documents, 4, async (document) => ({
    document,
    links: await getSalesRealizationLinks(document.ref),
  }));
  const linksComplete = linksResults.every(({ links }) => links.ok && links.links?.completeness.complete === true);
  if (!linksComplete) {
    return { checkedAt, periodFrom: input.periodFrom, periodTo: input.periodTo, complete: false, oneCComplete: false, ofdComplete: false, errorCode: 'ONE_C_REALIZATION_LINKS_INCOMPLETE', rows: [] };
  }

  const dateToInclusive = new Date(input.periodTo.getTime() - 1);
  const ofd = await exportUnifiedAusnOfdReceipts({
    organizationInn: process.env.SABY_OFD_ORGANIZATION_INN?.trim() || '071306665560',
    dateFrom: moscowDate(input.periodFrom),
    dateTo: moscowDate(dateToInclusive),
    queryLimit: 1_000,
    maxDocuments: 20_000,
  });
  const confirmedFiscalKeys = ofd.receipts.map(fiscalKey).filter(Boolean);
  const rows: CreditShadowSnapshotRow[] = linksResults.flatMap(({ document, links: linksResult }) => {
    const links = linksResult.links!;
    const controlInput = buildCreditRealizationControlInput({
      links,
      now: checkedAt,
      graceMinutes: 15,
      ofd: {
        complete: ofd.completeness.complete,
        confirmedFiscalKeys,
        unlinkedExactReceipts: exactUnlinkedReceipts(links, ofd.receipts),
      },
    });
    if (!controlInput) return [];
    const result = evaluateCreditRealization(controlInput);
    const evidenceHash = digest(JSON.stringify({
      version: CREDIT_REALIZATION_CONTROL_VERSION,
      status: result.status,
      reasons: result.reasonCodes,
      managerRef: controlInput.realization.managerRef,
      payments: controlInput.directPayments.map((payment) => `${payment.kind}:${payment.ref}:${payment.posted}:${payment.amount}`),
      fiscal: controlInput.fiscalDocuments.flatMap((fiscalDocument) => fiscalDocument.operations.map((operation) => `${fiscalDocument.sourceType}:${fiscalDocument.documentRef}:${creditFiscalKey(operation)}:${operation.amount}:${operation.cashPayment}:${operation.electronicPayment}:${operation.postpayment}`)),
      oneCComplete: links.completeness.complete,
      ofdComplete: ofd.completeness.complete,
    }));
    return [{ document, links, result, evidenceHash, receiptCashierRef: null, receiptCashierName: null }];
  });

  const lateReceiptRows = rows.filter((row) => (row.result.receiptDelayMinutes ?? 0) > 15);
  if (lateReceiptRows.length > 0) {
    const oneCChecks = await loadOneCKkmChecks({
      fromDate: moscowDate(input.periodFrom),
      toDate: moscowDate(new Date(input.periodTo.getTime() + 24 * 60 * 60_000)),
    });
    if (oneCChecks.complete) {
      const checksByFiscalKey = new Map(oneCChecks.data.flatMap((check) => {
        const key = oneCCheckFiscalKey(check);
        return key ? [[key, check] as const] : [];
      }));
      for (const row of lateReceiptRows) {
        const operation = row.links.fiscalControl.documents.flatMap((document) => document.operations)[0];
        const check = operation ? checksByFiscalKey.get(creditFiscalKey(operation)) : null;
        row.receiptCashierRef = check?.cashier.ref || null;
        row.receiptCashierName = check?.cashier.name || null;
        row.evidenceHash = digest(`${row.evidenceHash}:${row.result.receiptDelayMinutes}:${row.receiptCashierRef ?? ''}`);
      }
    }
  }

  return {
    checkedAt,
    periodFrom: input.periodFrom,
    periodTo: input.periodTo,
    complete: ofd.completeness.complete,
    oneCComplete: true,
    ofdComplete: ofd.completeness.complete,
    errorCode: ofd.completeness.complete ? null : 'OFD_SOURCE_INCOMPLETE',
    rows,
  };
}

export function creditShadowRunKey(periodFrom: Date, periodTo: Date) {
  return digest(`${CREDIT_REALIZATION_CONTROL_VERSION}:${periodFrom.toISOString()}:${periodTo.toISOString()}`);
}

function statusCounts(rows: CreditShadowSnapshotRow[]) {
  const counts = { confirmed: 0, mismatch: 0, needs_review: 0, pending: 0, unavailable: 0 };
  for (const row of rows) counts[row.result.status] += 1;
  return counts;
}

export async function persistCreditRealizationShadowSnapshot(prisma: PrismaClient, snapshot: CreditShadowSnapshot) {
  const runKey = creditShadowRunKey(snapshot.periodFrom, snapshot.periodTo);
  const existing = await prisma.creditRealizationControlRun.findUnique({ where: { runKey }, select: { id: true } });
  if (existing) return { acquired: false, runId: existing.id, persisted: false, counts: statusCounts(snapshot.rows) };

  const run = await prisma.creditRealizationControlRun.create({
    data: {
      runKey,
      mode: CREDIT_REALIZATION_EMPLOYEE_CONTROL_ENABLED ? 'live' : 'shadow',
      algorithmVersion: CREDIT_REALIZATION_CONTROL_VERSION,
      periodFrom: snapshot.periodFrom,
      periodTo: snapshot.periodTo,
      status: snapshot.complete ? 'running' : 'incomplete',
      oneCComplete: snapshot.oneCComplete,
      ofdComplete: snapshot.ofdComplete,
      sourceDocuments: snapshot.rows.length,
      lastErrorCode: snapshot.errorCode,
      ...(snapshot.complete ? {} : { completedAt: snapshot.checkedAt }),
    },
  });
  const counts = statusCounts(snapshot.rows);
  if (!snapshot.complete) return { acquired: true, runId: run.id, persisted: true, counts };

  await prisma.$transaction(async (tx) => {
    for (const row of snapshot.rows) {
      const reasonCode = row.result.reasonCodes[0];
      const realizationAt = parseOneCDate(row.document.date);
      const existingCase = await tx.creditRealizationControlCase.findUnique({
        where: { realizationRef: row.document.ref },
        select: {
          id: true,
          status: true,
          resolvedAt: true,
          mismatchFirstDetectedAt: true,
          completeMismatchReads: true,
        },
      });
      const resolvedAt = row.result.status === 'confirmed'
        ? (existingCase?.status === 'confirmed' ? existingCase.resolvedAt : snapshot.checkedAt)
        : null;
      const mismatchFirstDetectedAt = row.result.status === 'mismatch'
        ? (existingCase?.status === 'mismatch' ? existingCase.mismatchFirstDetectedAt ?? snapshot.checkedAt : snapshot.checkedAt)
        : null;
      const completeMismatchReads = row.result.status === 'mismatch'
        ? (existingCase?.status === 'mismatch' ? existingCase.completeMismatchReads + 1 : 1)
        : 0;
      const controlCase = await tx.creditRealizationControlCase.upsert({
        where: { realizationRef: row.document.ref },
        create: {
          realizationRef: row.document.ref,
          documentNumber: row.document.number,
          realizationAt,
          amountKopecks: Math.round((row.document.amount ?? 0) * 100),
          managerRef: row.document.managerRef || null,
          status: row.result.status,
          reasonCode,
          employeeActionCandidate: row.result.employeeActionEligible,
          mismatchFirstDetectedAt,
          completeMismatchReads,
          receiptDelayMinutes: row.result.receiptDelayMinutes,
          receiptCashierRef: row.receiptCashierRef,
          receiptCashierName: row.receiptCashierName,
          firstDetectedAt: snapshot.checkedAt,
          lastCheckedAt: snapshot.checkedAt,
        },
        update: {
          documentNumber: row.document.number,
          realizationAt,
          amountKopecks: Math.round((row.document.amount ?? 0) * 100),
          managerRef: row.document.managerRef || null,
          status: row.result.status,
          reasonCode,
          employeeActionCandidate: row.result.employeeActionEligible,
          mismatchFirstDetectedAt,
          completeMismatchReads,
          receiptDelayMinutes: row.result.receiptDelayMinutes,
          receiptCashierRef: row.receiptCashierRef,
          receiptCashierName: row.receiptCashierName,
          lastCheckedAt: snapshot.checkedAt,
          resolvedAt,
        },
      });
      await tx.creditRealizationControlEvaluation.upsert({
        where: { caseId_evidenceHash: { caseId: controlCase.id, evidenceHash: row.evidenceHash } },
        create: {
          caseId: controlCase.id,
          runId: run.id,
          evidenceHash: row.evidenceHash,
          algorithmVersion: CREDIT_REALIZATION_CONTROL_VERSION,
          status: row.result.status,
          reasonCode,
          employeeActionCandidate: row.result.employeeActionEligible,
          receiptDelayMinutes: row.result.receiptDelayMinutes,
          receiptCashierRef: row.receiptCashierRef,
          receiptCashierName: row.receiptCashierName,
          oneCComplete: snapshot.oneCComplete,
          ofdComplete: snapshot.ofdComplete,
          evaluatedAt: snapshot.checkedAt,
        },
        update: {},
      });
    }
    await tx.creditRealizationControlRun.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        confirmedCount: counts.confirmed,
        mismatchCount: counts.mismatch,
        needsReviewCount: counts.needs_review,
        pendingCount: counts.pending,
        unavailableCount: counts.unavailable,
        completedAt: snapshot.checkedAt,
      },
    });
  });
  const lifecycle = CREDIT_REALIZATION_EMPLOYEE_CONTROL_ENABLED
    ? await syncCreditRealizationWorkdayControl(prisma, snapshot.checkedAt)
    : null;
  return { acquired: true, runId: run.id, persisted: true, counts, lifecycle };
}

export function automaticCreditShadowPeriod(now = new Date(), days = 14) {
  const periodTo = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  return { periodFrom: new Date(periodTo.getTime() - days * 24 * 60 * 60_000), periodTo };
}
