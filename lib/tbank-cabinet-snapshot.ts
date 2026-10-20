import 'server-only';

import { readFile } from 'node:fs/promises';
import type { BankOperation } from '@/lib/terminal-fiscal-matching';
import type { SourceSnapshot } from '@/lib/terminal-fiscal-sources';

export const TBANK_CABINET_SNAPSHOT_VERSION = 1;
export const TBANK_CABINET_MAX_AGE_MS = 10 * 60 * 1000;

type CabinetOperation = {
  operationId: string;
  rrn: string;
  terminalKey: string;
  transactionDate: string;
  amountKopecks: number;
  type: 'Debit' | 'Credit';
  source: 'TERM_CARD' | 'TERM_SBP';
};

type CabinetSnapshot = {
  version: number;
  generatedAt: string;
  periodFrom: string;
  periodTo: string;
  complete: boolean;
  operations: CabinetOperation[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string') return null;
  const milliseconds = new Date(value).getTime();
  return Number.isFinite(milliseconds) ? { value, milliseconds } : null;
}

export function parseTBankCabinetSnapshot(value: unknown): CabinetSnapshot | null {
  const root = record(value);
  const generatedAt = parseDate(root?.generatedAt);
  const periodFrom = parseDate(root?.periodFrom);
  const periodTo = parseDate(root?.periodTo);
  if (root?.version !== TBANK_CABINET_SNAPSHOT_VERSION || !generatedAt || !periodFrom || !periodTo
    || periodTo.milliseconds <= periodFrom.milliseconds || typeof root?.complete !== 'boolean'
    || !Array.isArray(root?.operations)) return null;
  const operations: CabinetOperation[] = [];
  const identities = new Set<string>();
  for (const value of root.operations) {
    const item = record(value);
    const transactionDate = parseDate(item?.transactionDate);
    if (!item || typeof item.operationId !== 'string' || !item.operationId.trim()
      || typeof item.rrn !== 'string'
      || typeof item.terminalKey !== 'string' || !item.terminalKey.trim() || !transactionDate
      || !Number.isSafeInteger(item.amountKopecks) || Number(item.amountKopecks) <= 0
      || !['Debit', 'Credit'].includes(String(item.type))
      || !['TERM_CARD', 'TERM_SBP'].includes(String(item.source))
      || (item.source === 'TERM_CARD' && !item.rrn.trim())) return null;
    if (identities.has(item.operationId)) return null;
    identities.add(item.operationId);
    operations.push({
      operationId: item.operationId,
      rrn: item.rrn,
      terminalKey: item.terminalKey,
      transactionDate: transactionDate.value,
      amountKopecks: Number(item.amountKopecks),
      type: item.type as CabinetOperation['type'],
      source: item.source as CabinetOperation['source'],
    });
  }
  return {
    version: TBANK_CABINET_SNAPSHOT_VERSION,
    generatedAt: generatedAt.value,
    periodFrom: periodFrom.value,
    periodTo: periodTo.value,
    complete: root.complete,
    operations,
  };
}

export async function loadTBankCabinetOperations(input: {
  path: string;
  terminalKey: string;
  from: string;
  to: string;
  now?: Date;
}): Promise<SourceSnapshot<BankOperation>> {
  const checkedAt = (input.now ?? new Date()).toISOString();
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(input.path, 'utf8'));
  } catch {
    return { complete: false, checkedAt, data: [], errorCode: 'TBANK_CABINET_SNAPSHOT_UNREADABLE' };
  }
  const snapshot = parseTBankCabinetSnapshot(raw);
  if (!snapshot) return { complete: false, checkedAt, data: [], errorCode: 'TBANK_CABINET_SNAPSHOT_INVALID' };
  const nowMs = (input.now ?? new Date()).getTime();
  const generatedAtMs = new Date(snapshot.generatedAt).getTime();
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();
  if (generatedAtMs > nowMs + 60_000 || nowMs - generatedAtMs > TBANK_CABINET_MAX_AGE_MS) {
    return { complete: false, checkedAt, data: [], errorCode: 'TBANK_CABINET_SNAPSHOT_STALE' };
  }
  if (!snapshot.complete || !Number.isFinite(fromMs) || !Number.isFinite(toMs)
    || new Date(snapshot.periodFrom).getTime() > fromMs || new Date(snapshot.periodTo).getTime() < toMs) {
    return { complete: false, checkedAt, data: [], errorCode: 'TBANK_CABINET_PERIOD_INCOMPLETE' };
  }
  return {
    complete: true,
    checkedAt: snapshot.generatedAt,
    data: snapshot.operations
      .filter((operation) => operation.terminalKey === input.terminalKey)
      .filter((operation) => {
        const at = new Date(operation.transactionDate).getTime();
        return at >= fromMs && at < toMs;
      })
      .map((operation) => ({
        terminalKey: operation.terminalKey,
        rrn: operation.rrn || `cabinet:${operation.operationId}`,
        transactionDate: operation.transactionDate,
        amountKopecks: operation.amountKopecks,
        type: operation.type,
        rawType: operation.source,
      }))
      .sort((left, right) => left.transactionDate.localeCompare(right.transactionDate)),
  };
}

// Archived evidence may restore an already recorded operation after a provider
// change. It never substitutes a stale snapshot for today's live source.
export async function loadHistoricalCabinetEvidence(input: {
  path: string; terminalKey: string; from: string; to: string;
  unresolvedHashes: ReadonlySet<string>;
}): Promise<{ operations: BankOperation[]; coversRequestedPeriod: boolean }> {
  if (!input.unresolvedHashes.size) return { operations: [], coversRequestedPeriod: false };
  let snapshot: CabinetSnapshot | null;
  try { snapshot = parseTBankCabinetSnapshot(JSON.parse(await readFile(input.path, 'utf8'))); } catch { return { operations: [], coversRequestedPeriod: false }; }
  if (!snapshot?.complete) return { operations: [], coversRequestedPeriod: false };
  const from = Date.parse(input.from), to = Date.parse(input.to);
  const generated = Date.parse(snapshot.generatedAt);
  const start = Date.parse(snapshot.periodFrom), end = Math.min(Date.parse(snapshot.periodTo), generated);
  const eligible = snapshot.operations.filter(o => o.terminalKey === input.terminalKey
    && Date.parse(o.transactionDate) >= Math.max(from, start) && Date.parse(o.transactionDate) < Math.min(to, end))
    .map(o => ({ terminalKey: o.terminalKey, rrn: o.rrn || `cabinet:${o.operationId}`,
      transactionDate: o.transactionDate, amountKopecks: o.amountKopecks, type: o.type, rawType: o.source }));
  const { createHash } = await import('node:crypto');
  const known = eligible.some(o => input.unresolvedHashes.has(createHash('sha256')
    .update(`terminal-fiscal:${[o.terminalKey, o.rrn, o.transactionDate, o.type, o.amountKopecks].join('|')}`).digest('hex')));
  return { operations: known ? eligible : [], coversRequestedPeriod: known && start <= from && end >= to };
}
