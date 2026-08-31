import 'server-only';

import { createHash } from 'node:crypto';
import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import { getTBankTerminalOperations, getTBankTerminals, type TBankTerminalOperation } from '@/lib/tbank-acquiring';
import { collectCompleteTBankWindow, splitIntoFixedWindows } from '@/lib/tbank-complete-window';
import type { BankOperation, MatchingItem, OfdReceipt, OneCCheck, TerminalMapping } from '@/lib/terminal-fiscal-matching';
import { normalizePlatformaOfdReceipt, normalizePlatformaOfdZReport, type NormalizedPlatformaOfdZReport } from '@/lib/terminal-fiscal-ofd-adapter';
import { normalizeOneCDateTime } from '@/lib/terminal-fiscal-one-c-adapter';
import { getMoscowDateKey } from '@/lib/workday';

export type SourceSnapshot<T> = {
  complete: boolean;
  checkedAt: string;
  data: T[];
  errorCode?: string;
  windows?: number;
};

export type PlatformaOfdZReport = NormalizedPlatformaOfdZReport;

type TBankPage = Awaited<ReturnType<typeof getTBankTerminalOperations>>;
type TBankPageLoader = (input: { terminalKey: string; from: string; till: string; limit: number }) => Promise<TBankPage>;

const ONE_C_PAGE_LIMIT = 500;
const ONE_C_MAX_OFFSET = 5000;
export const TBANK_MAX_WINDOW_MS = 12 * 60 * 60 * 1000;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function integer(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function decimal(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function bool(value: unknown) {
  return value === true;
}

function array(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function metadataRef(value: unknown) {
  const source = record(value);
  return source ? text(source.ref) || text(source.id) || text(source.value) : '';
}

function metadataName(value: unknown) {
  const source = record(value);
  return source ? text(source.name) || text(source.presentation) || text(source.description) : '';
}

export function technicalHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function tbankIdentity(operation: TBankTerminalOperation, terminalKey: string) {
  return [terminalKey, operation.rrn, operation.transactionDate, operation.type, operation.amountKopecks].join('|');
}

export async function loadCompleteTBankOperations(input: {
  terminalKey: string;
  from: string;
  to: string;
  loadPage?: TBankPageLoader;
}): Promise<SourceSnapshot<BankOperation>> {
  const checkedAt = new Date().toISOString();
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return { complete: false, checkedAt, data: [], errorCode: 'INVALID_PERIOD', windows: 0 };
  }

  const loader = input.loadPage ?? getTBankTerminalOperations;
  let lastRequestAt = 0;
  const rateLimitedLoader: TBankPageLoader = async (params) => {
    if (!input.loadPage) {
      const waitMs = Math.max(0, 1000 - (Date.now() - lastRequestAt));
      if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
      lastRequestAt = Date.now();
    }
    return loader(params);
  };
  const all = new Map<string, TBankTerminalOperation>();
  let complete = true;
  let windows = 0;
  for (const window of splitIntoFixedWindows(fromMs, toMs, TBANK_MAX_WINDOW_MS)) {
    const part = await collectCompleteTBankWindow<TBankTerminalOperation>({
      fromMs: window.fromMs,
      toMs: window.toMs,
      identity: (operation) => tbankIdentity(operation, input.terminalKey),
      loadPage: async (start, finish, limit) => rateLimitedLoader({
        terminalKey: input.terminalKey,
        from: new Date(start).toISOString(),
        till: new Date(finish).toISOString(),
        limit,
      }),
    });
    windows += part.windows;
    part.operations.forEach((operation) => all.set(tbankIdentity(operation, input.terminalKey), operation));
    if (!part.complete) {
      complete = false;
      break;
    }
  }
  return {
    complete,
    checkedAt,
    data: [...all.values()].map((operation) => ({
        terminalKey: input.terminalKey,
        rrn: operation.rrn,
        transactionDate: operation.transactionDate,
        amountKopecks: operation.amountKopecks,
        type: operation.type,
      })).sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)),
    errorCode: complete ? undefined : 'TBANK_INCOMPLETE',
    windows,
  };
}

function normalizeItems(value: unknown): MatchingItem[] {
  return array(value).flatMap((entry) => {
    const item = record(entry);
    if (!item) return [];
    const product = record(item.product);
    return [{
      name: text(product?.name) || text(item.name),
      quantity: decimal(item.quantity),
      priceKopecks: integer(item.priceKopecks ?? item.price),
      sumKopecks: integer(item.amountKopecks ?? item.sumKopecks ?? item.sum),
    }];
  });
}

export function normalizeOneCCheck(value: unknown, fiscalFacts: Map<string, Record<string, unknown>>): OneCCheck | null {
  const source = record(value);
  if (!source) return null;
  const sourceTypeValue = text(source.sourceDocumentType || source.sourceType);
  const sourceType = sourceTypeValue === 'sale_check' || sourceTypeValue === 'refund_check'
    || sourceTypeValue === 'correction' || sourceTypeValue === 'correction_check'
    || sourceTypeValue === 'credit_realization' ? sourceTypeValue : '';
  const actualSourceType = sourceType === 'correction_check' ? 'correction' : sourceType;
  if (!['sale_check', 'refund_check', 'correction', 'credit_realization'].includes(actualSourceType)) return null;
  const operation = text(source.operationType);
  if (!['sale', 'refund', 'correction'].includes(operation)) return null;
  const sourceRef = text(source.sourceRef || source['1cCheckRef']);
  const dateTime = normalizeOneCDateTime(source.date || source.dateTime);
  if (!sourceRef || !dateTime) return null;
  const factKeys = array(source.fiscalFactKeys).map(text);
  const fact = factKeys.map((key) => fiscalFacts.get(key)).find(Boolean);
  const payments = array(source.cardPayments).flatMap((entry) => {
    const payment = record(entry);
    if (!payment || bool(payment.cancelled)) return [];
    return [{
      lineNumber: text(payment.lineNumber),
      amountKopecks: integer(payment.amountKopecks),
      acquiringTerminalRef: metadataRef(payment.acquiringTerminal) || text(payment.acquiringTerminalRef),
      referenceNumber: text(payment.referenceNumber),
      authorizationCode: text(payment.authorizationCode),
      terminalReceiptNumber: text(payment.terminalReceiptNumber),
    }];
  });
  return {
    sourceRef,
    sourceType: actualSourceType as OneCCheck['sourceType'],
    operationType: operation as OneCCheck['operationType'],
    dateTime,
    cashRegisterRef: metadataRef(source.cashRegister) || text(source.cashRegisterRef),
    kktRegistrationNumber: text(fact?.kktRegistrationNumber) || text(source.kktRegistrationNumber),
    totalKopecks: integer(source.amountKopecks ?? source.totalKopecks),
    electronicKopecks: integer(source.electronicKopecks),
    cashier: {
      ref: metadataRef(source.cashier),
      name: metadataName(source.cashier),
    },
    cardPayments: payments,
    items: normalizeItems(source.items),
    fiscalState: (['confirmed', 'incomplete', 'unconfirmed'].includes(text(source.fiscalState)) ? text(source.fiscalState) : 'unconfirmed') as OneCCheck['fiscalState'],
    fiscalStateMeaning: 'data_state_only',
    fiscalDriveNumber: text(fact?.fiscalDriveNumber) || undefined,
    fiscalDocumentNumber: text(fact?.fiscalDocumentNumber) || undefined,
    fiscalSign: text(fact?.fiscalSign) || undefined,
    fiscalConflict: bool(source.fiscalConflict),
  };
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, method: 'GET', cache: 'no-store' });
  const body = await response.json().catch(() => null) as unknown;
  return { response, body };
}

export async function loadOneCKkmChecks(input: { fromDate: string; toDate: string }): Promise<SourceSnapshot<OneCCheck>> {
  const checkedAt = new Date().toISOString();
  const config = readOneCRuntimeEnv();
  if (!config.baseUrl || !config.user || !config.password) return { complete: false, checkedAt, data: [], errorCode: 'ONE_C_NOT_CONFIGURED' };
  const output: OneCCheck[] = [];
  for (let offset = 0; offset <= ONE_C_MAX_OFFSET; offset += ONE_C_PAGE_LIMIT) {
    const query = new URLSearchParams({ from: input.fromDate, to: input.toDate, limit: String(ONE_C_PAGE_LIMIT), offset: String(offset) });
    const auth = Buffer.from(`${config.user}:${config.password}`).toString('base64');
    const { response, body } = await fetchJson(`${config.baseUrl}/kkm-checks?${query}`, { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
    const root = record(body);
    if (!response.ok || !root || root.ok !== true) return { complete: false, checkedAt, data: output, errorCode: 'ONE_C_REQUEST_FAILED' };
    const facts = new Map(array(root.fiscalFacts).flatMap((entry) => {
      const fact = record(entry);
      const key = text(fact?.fiscalKey);
      return fact && key ? [[key, fact] as const] : [];
    }));
    const checks = array(root.checks);
    const normalizedChecks = checks.map((check) => normalizeOneCCheck(check, facts)).filter(Boolean) as OneCCheck[];
    if (normalizedChecks.length !== checks.length) return { complete: false, checkedAt, data: output, errorCode: 'ONE_C_NORMALIZATION_FAILED' };
    output.push(...normalizedChecks);
    const pagination = record(root.pagination);
    if (!bool(pagination?.has_more)) return { complete: true, checkedAt, data: output };
    if (checks.length < ONE_C_PAGE_LIMIT) return { complete: false, checkedAt, data: output, errorCode: 'ONE_C_PAGINATION_CONTRADICTION' };
  }
  return { complete: false, checkedAt, data: output, errorCode: 'ONE_C_OFFSET_LIMIT' };
}

export async function loadPlatformaOfdReceipts(input: {
  kktRegistrationNumber: string;
  from: string;
  to: string;
}, dependencies: {
  fetchJson?: typeof fetchJson;
  sleep?: (milliseconds: number) => Promise<void>;
} = {}): Promise<SourceSnapshot<OfdReceipt>> {
  const checkedAt = new Date().toISOString();
  const baseUrl = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) return { complete: false, checkedAt, data: [], errorCode: 'OFD_PROXY_NOT_CONFIGURED' };
  const query = new URLSearchParams({ kktRegNumber: input.kktRegistrationNumber, from: input.from, to: input.to });
  const request = dependencies.fetchJson ?? fetchJson;
  const sleep = dependencies.sleep ?? ((milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  let latest: SourceSnapshot<OfdReceipt> = { complete: false, checkedAt, data: [], errorCode: 'OFD_REQUEST_FAILED' };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { response, body } = await request(`${baseUrl}/api/v1/ofd/platforma/receipts?${query}`, { headers: { Accept: 'application/json' } });
      const root = record(body);
      if (!response.ok || !root) {
        latest = { complete: false, checkedAt, data: [], errorCode: 'OFD_REQUEST_FAILED' };
      } else {
        const dataRoot = record(root.data);
        const receipts = array(root.receipts ?? dataRoot?.receipts);
        const meta = record(root.meta);
        const normalizedReceipts = receipts.map(normalizePlatformaOfdReceipt).filter(Boolean) as OfdReceipt[];
        const providerComplete = root.complete === true || dataRoot?.complete === true || meta?.complete === true;
        const complete = providerComplete && normalizedReceipts.length === receipts.length;
        latest = {
          complete,
          checkedAt,
          data: normalizedReceipts,
          errorCode: complete ? undefined : normalizedReceipts.length !== receipts.length ? 'OFD_NORMALIZATION_FAILED' : 'OFD_INCOMPLETE',
        };
      }
    } catch {
      latest = { complete: false, checkedAt, data: [], errorCode: 'OFD_REQUEST_FAILED' };
    }
    if (latest.complete || attempt === 2) return latest;
    await sleep((attempt + 1) * 1_000);
  }
  return latest;
}

export async function loadPlatformaOfdZReports(input: {
  kktRegistrationNumber: string;
  from: string;
  to: string;
}): Promise<SourceSnapshot<PlatformaOfdZReport>> {
  const checkedAt = new Date().toISOString();
  const baseUrl = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) return { complete: false, checkedAt, data: [], errorCode: 'OFD_PROXY_NOT_CONFIGURED' };
  const query = new URLSearchParams({ kktRegNumber: input.kktRegistrationNumber, from: input.from, to: input.to });
  const { response, body } = await fetchJson(`${baseUrl}/api/v1/ofd/platforma/z-reports?${query}`, { headers: { Accept: 'application/json' } });
  const root = record(body);
  const dataRoot = record(root?.data);
  const rows = array(dataRoot?.zReports ?? root?.zReports);
  if (!response.ok || !root) return { complete: false, checkedAt, data: [], errorCode: 'OFD_REQUEST_FAILED' };
  const normalized = rows.map((value) => normalizePlatformaOfdZReport(value, input.kktRegistrationNumber)).filter(Boolean) as PlatformaOfdZReport[];
  const meta = record(root.meta);
  const providerComplete = root.complete === true || dataRoot?.complete === true || meta?.complete === true;
  const complete = providerComplete && normalized.length === rows.length;
  return { complete, checkedAt, data: normalized, errorCode: complete ? undefined : normalized.length !== rows.length ? 'OFD_NORMALIZATION_FAILED' : 'OFD_INCOMPLETE' };
}

export async function previewTerminalFiscalMappings(input: { from: string; to: string }) {
  const terminals = await getTBankTerminals();
  const fromDate = new Date(input.from);
  const toDate = new Date(input.to);
  const lastIncluded = new Date(toDate.getTime() - 1);
  const toKeyDate = new Date(`${getMoscowDateKey(lastIncluded)}T00:00:00.000Z`);
  toKeyDate.setUTCDate(toKeyDate.getUTCDate() + 1);
  const oneC = await loadOneCKkmChecks({ fromDate: getMoscowDateKey(fromDate), toDate: toKeyDate.toISOString().slice(0, 10) });
  const oneCPairs = new Map<string, { acquiringTerminalRef: string; cashRegisterRef: string; kktRegistrationNumber: string }>();
  for (const check of oneC.data) {
    for (const payment of check.cardPayments) {
      if (payment.acquiringTerminalRef && check.cashRegisterRef && check.kktRegistrationNumber) {
        const key = [payment.acquiringTerminalRef, check.cashRegisterRef, check.kktRegistrationNumber].join('|');
        oneCPairs.set(key, { acquiringTerminalRef: payment.acquiringTerminalRef, cashRegisterRef: check.cashRegisterRef, kktRegistrationNumber: check.kktRegistrationNumber });
      }
    }
  }
  return {
    complete: terminals.ok && oneC.complete,
    tbankTerminals: terminals.terminals.map((terminal) => ({ terminalKey: terminal.key, terminalId: terminal.id })),
    oneCCombinations: [...oneCPairs.values()],
    automaticMappings: [] as TerminalMapping[],
    note: 'Связка требует явного подтверждения администратора; production mapping автоматически не создаётся.',
  };
}
