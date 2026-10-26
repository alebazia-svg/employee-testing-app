import { fiscalChainReview, type FiscalChainEvidence } from './terminal-fiscal-chain-review';
export const TERMINAL_FISCAL_MATCHING_VERSION = 'mvp-1.8';
export const TERMINAL_FISCAL_GRACE_MS = 120 * 60 * 1000;
export const TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const TERMINAL_FISCAL_TIME_TOLERANCE_MS = 5 * 60 * 1000;

export type MatchingStatus = 'confirmed' | 'pending' | 'mismatch' | 'unavailable' | 'needs_review';
export type MatchingOperationType = 'sale' | 'refund';

export type MatchingReasonCode =
  | 'MATCH_CONFIRMED'
  | 'MATCH_CONFIRMED_LATE'
  | 'MATCH_AMOUNT_COVERED'
  | 'SOURCE_TBANK_INCOMPLETE'
  | 'SOURCE_TBANK_HISTORICAL_INCOMPLETE'
  | 'SOURCE_ONE_C_INCOMPLETE'
  | 'SOURCE_OFD_INCOMPLETE'
  | 'TERMINAL_MAPPING_MISSING'
  | 'TERMINAL_MAPPING_CONFLICT'
  | 'BANK_OPERATION_DUPLICATE'
  | 'BANK_OPERATION_UNSUPPORTED'
  | 'BANK_OPERATION_INVALID'
  | 'ONE_C_CANDIDATE_PENDING'
  | 'ONE_C_CANDIDATE_NOT_FOUND'
  | 'ONE_C_MULTIPLE_CANDIDATES'
  | 'ONE_C_CHECK_REUSED'
  | 'ONE_C_SPLIT_RECEIPTS_REVIEW'
  | 'ONE_C_COMBINED_PAYMENTS_REVIEW'
  | 'ONE_C_EXCHANGE_REVIEW'
  | 'ONE_C_POSSIBLE_SPLIT_SALE'
  | 'ONE_C_MULTIPLE_CARD_PAYMENTS'
  | 'ONE_C_UNSUPPORTED_DOCUMENT'
  | 'FISCAL_DATA_PENDING'
  | 'FISCAL_DATA_UNCONFIRMED'
  | 'FISCAL_KEY_CONFLICT'
  | 'OFD_CANDIDATE_REQUIRES_LINK'
  | 'OFD_RECEIPT_PENDING'
  | 'OFD_RECEIPT_NOT_FOUND'
  | 'OFD_RECEIPT_DUPLICATE'
  | 'OFD_OPERATION_TYPE_MISMATCH'
  | 'OFD_TOTAL_AMOUNT_MISMATCH'
  | 'OFD_ELECTRONIC_AMOUNT_MISMATCH'
  | 'OFD_KKT_MISMATCH'
  | 'OFD_ITEM_PRESENTATION_DIFFERENCE'
  | 'OFD_ITEM_VALUES_MISMATCH'
  | 'OFD_ITEMS_MISMATCH';

type MatchingReasonContract = {
  meaning: string;
  allowedStatuses: readonly MatchingStatus[];
  employeeVisible: boolean;
};

export const MATCHING_REASON_CODE_CONTRACT = {
  MATCH_AMOUNT_COVERED: { meaning: 'Сумма оплат покрыта фискальными чеками; точные пары документов не назначены', allowedStatuses: ['confirmed'], employeeVisible: false },
  MATCH_CONFIRMED: { meaning: 'Три источника однозначно совпали', allowedStatuses: ['confirmed'], employeeVisible: false },
  MATCH_CONFIRMED_LATE: { meaning: 'Три источника однозначно совпали, дата документа 1С отличается от времени оплаты; просрочка фискализации не установлена', allowedStatuses: ['confirmed'], employeeVisible: false },
  SOURCE_TBANK_HISTORICAL_INCOMPLETE: { meaning: 'Историческая банковская выгрузка не покрывает период проверки', allowedStatuses: ['unavailable'], employeeVisible: false },
  SOURCE_TBANK_INCOMPLETE: { meaning: 'Источник Т-Банка получен не полностью', allowedStatuses: ['unavailable'], employeeVisible: false },
  SOURCE_ONE_C_INCOMPLETE: { meaning: 'Источник 1С получен не полностью', allowedStatuses: ['unavailable'], employeeVisible: false },
  SOURCE_OFD_INCOMPLETE: { meaning: 'Источник OFD получен не полностью', allowedStatuses: ['unavailable'], employeeVisible: false },
  TERMINAL_MAPPING_MISSING: { meaning: 'Не найден маппинг терминала', allowedStatuses: ['unavailable'], employeeVisible: false },
  TERMINAL_MAPPING_CONFLICT: { meaning: 'Одновременно активны несколько маппингов терминала', allowedStatuses: ['unavailable'], employeeVisible: false },
  BANK_OPERATION_DUPLICATE: { meaning: 'Банковская операция продублирована во входном снимке', allowedStatuses: ['needs_review'], employeeVisible: false },
  BANK_OPERATION_UNSUPPORTED: { meaning: 'Тип банковской операции не входит в MVP', allowedStatuses: ['needs_review'], employeeVisible: false },
  BANK_OPERATION_INVALID: { meaning: 'Банковская операция содержит невалидные обязательные поля', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_CANDIDATE_PENDING: { meaning: 'Подтверждающий документ 1С ещё может появиться в пределах grace period', allowedStatuses: ['pending'], employeeVisible: false },
  ONE_C_CANDIDATE_NOT_FOUND: { meaning: 'После grace period не найден чек ККМ или эквайринговая операция 1С по строгим критериям', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_MULTIPLE_CANDIDATES: { meaning: 'Найдено несколько равноправных документов 1С', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_CHECK_REUSED: { meaning: 'Один документ 1С претендует на несколько банковских операций', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_SPLIT_RECEIPTS_REVIEW: { meaning: 'Оплата согласуется с несколькими фискальными чеками; связь требует проверки', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_COMBINED_PAYMENTS_REVIEW: { meaning: 'Несколько оплат согласуются с одним фискальным чеком; связь требует проверки', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_EXCHANGE_REVIEW: { meaning: 'Найдена цепочка продажи, возврата и доплаты; связь требует проверки', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_POSSIBLE_SPLIT_SALE: { meaning: 'Части продажи в 1С по сумме и товарам согласуются с общим чеком ОФД, связь требует проверки', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_MULTIPLE_CARD_PAYMENTS: { meaning: 'В чеке несколько карточных строк; случай вне MVP', allowedStatuses: ['needs_review'], employeeVisible: false },
  ONE_C_UNSUPPORTED_DOCUMENT: { meaning: 'Документ 1С является кредитом или коррекцией; случай вне MVP', allowedStatuses: ['needs_review'], employeeVisible: false },
  FISCAL_DATA_PENDING: { meaning: 'Полная фискальная тройка ещё может появиться в grace period', allowedStatuses: ['pending'], employeeVisible: false },
  FISCAL_DATA_UNCONFIRMED: { meaning: 'Фискальная тройка отсутствует или неполна после grace period', allowedStatuses: ['needs_review'], employeeVisible: false },
  FISCAL_KEY_CONFLICT: { meaning: '1С вернула конфликтующие фискальные факты', allowedStatuses: ['needs_review'], employeeVisible: false },
  OFD_CANDIDATE_REQUIRES_LINK: { meaning: 'Есть возможный чек ОФД, но связь с оплатой и документом 1С не доказана', allowedStatuses: ['needs_review'], employeeVisible: false },
  OFD_RECEIPT_PENDING: { meaning: 'Фискальный чек OFD ещё может появиться в grace period', allowedStatuses: ['pending'], employeeVisible: false },
  OFD_RECEIPT_NOT_FOUND: { meaning: 'После grace period точный фискальный ключ не найден в OFD', allowedStatuses: ['needs_review'], employeeVisible: false },
  OFD_RECEIPT_DUPLICATE: { meaning: 'Один канонический фискальный ключ встречается в OFD несколько раз', allowedStatuses: ['needs_review'], employeeVisible: false },
  OFD_OPERATION_TYPE_MISMATCH: { meaning: 'По точному фискальному ключу расходится тип операции', allowedStatuses: ['pending', 'mismatch'], employeeVisible: true },
  OFD_TOTAL_AMOUNT_MISMATCH: { meaning: 'По точному фискальному ключу расходится общая сумма', allowedStatuses: ['pending', 'mismatch'], employeeVisible: true },
  OFD_ELECTRONIC_AMOUNT_MISMATCH: { meaning: 'По точному фискальному ключу расходится электронная сумма', allowedStatuses: ['pending', 'mismatch'], employeeVisible: true },
  OFD_KKT_MISMATCH: { meaning: 'По точному фискальному ключу расходится ККТ', allowedStatuses: ['pending', 'mismatch'], employeeVisible: true },
  OFD_ITEM_PRESENTATION_DIFFERENCE: { meaning: 'Финансовая и фискальная связка подтверждена, но представление наименований позиций отличается', allowedStatuses: ['confirmed'], employeeVisible: false },
  OFD_ITEM_VALUES_MISMATCH: { meaning: 'Финансовая и фискальная связка подтверждена, но количество, цена или сумма позиций требуют проверки ADMIN', allowedStatuses: ['confirmed'], employeeVisible: false },
  OFD_ITEMS_MISMATCH: { meaning: 'Исторический ADMIN-only код расхождения товаров до разделения финансовой и товарной проверки', allowedStatuses: ['needs_review'], employeeVisible: false },
} as const satisfies Record<MatchingReasonCode, MatchingReasonContract>;

export type MatchingSourceState = {
  complete: boolean;
  checkedAt: string;
  error?: string;
};

export type TerminalMapping = {
  id: string;
  terminalKey: string;
  oneCAcquiringTerminalRef: string;
  oneCCashRegisterRef: string;
  kktRegistrationNumber: string;
  activeFrom: string;
  activeTo?: string;
};

export type BankOperation = {
  terminalKey: string;
  rrn: string;
  terminalReceiptNumber?: string;
  transactionDate: string;
  amountKopecks: number;
  type: 'Debit' | 'Credit' | 'Other';
  rawType?: string;
};

export type OneCCardPayment = {
  lineNumber: string;
  amountKopecks: number;
  acquiringTerminalRef: string;
  referenceNumber: string;
  authorizationCode: string;
  terminalReceiptNumber: string;
};

export type MatchingItem = {
  name: string;
  quantity: number;
  priceKopecks: number;
  sumKopecks: number;
};

export type OneCCashier = {
  ref: string;
  name: string;
};

export type OneCCheck = {
  sourceRef: string;
  sourceType: 'sale_check' | 'refund_check' | 'acquiring_operation' | 'correction' | 'credit_realization';
  operationType: 'sale' | 'refund' | 'correction';
  dateTime: string;
  // KKT clock time from the fiscal register, not the document date or first read.
  fiscalDateTime?: string;
  cashRegisterRef: string;
  kktRegistrationNumber: string;
  totalKopecks: number;
  electronicKopecks: number;
  cashier: OneCCashier;
  cardPayments: OneCCardPayment[];
  items: MatchingItem[];
  fiscalState: 'confirmed' | 'incomplete' | 'unconfirmed';
  fiscalStateMeaning: 'data_state_only';
  fiscalDriveNumber?: string;
  fiscalDocumentNumber?: string;
  fiscalSign?: string;
  fiscalConflict?: boolean;
};

export type OfdReceipt = {
  fiscalDriveNumber: string;
  fiscalDocumentNumber: string;
  fiscalSign: string;
  operationType: number;
  receiptAt: string;
  kktRegistrationNumber: string;
  totalKopecks: number;
  electronicKopecks: number;
  items: MatchingItem[];
};

export type MatchingHistoryEntry = {
  at: string;
  status: MatchingStatus;
  reasonCode: MatchingReasonCode;
};

export type MatchingAuditRecord = {
  matchingKey: string;
  version: string;
  status: MatchingStatus;
  reasonCode: MatchingReasonCode;
  evaluatedAt: string;
  graceUntil: string;
  mappingId?: string;
  bankOperationKey: string;
  oneCCheckKey?: string;
  oneCCashierRef?: string;
  oneCCashierName?: string;
  ofdReceiptKey?: string;
  operationType?: MatchingOperationType;
  amountKopecks: number;
  // Absolute difference between document date and payment time; not fiscalization latency.
  timeDifferenceSeconds?: number;
  candidateCount: number;
  evidence: {
    chain?: FiscalChainEvidence;
    amountCoverage?: {bankKeys:string[];oneCRefs:string[]};
    bankTransactionDate: string;
    bankOperationRawType?: string;
    terminalReceiptNumber?: string;
    oneCDateTime?: string;
    oneCFiscalDateTime?: string;
    oneCTotalKopecks?: number;
    oneCElectronicKopecks?: number;
    ofdReceiptAt?: string;
    ofdTotalKopecks?: number;
    ofdElectronicKopecks?: number;
  };
  sourceCheckedAt: {
    tbank: string;
    oneC: string;
    ofd: string;
  };
  sourceCompleteness: {
    tbank: boolean;
    oneC: boolean;
    ofd: boolean;
  };
  history: MatchingHistoryEntry[];
};

export type TerminalFiscalMatchingInput = {
  now: string;
  sources: {
    tbank: MatchingSourceState;
    oneC: MatchingSourceState;
    ofd: MatchingSourceState;
  };
  mappings: TerminalMapping[];
  bankOperations: BankOperation[];
  oneCChecks: OneCCheck[];
  ofdReceipts: OfdReceipt[];
  previous?: MatchingAuditRecord[];
};

export type TerminalFiscalMatchingOutput = {
  version: string;
  evaluatedAt: string;
  records: MatchingAuditRecord[];
};

export type MatchingActionPolicy = {
  employeeVisible: boolean;
  adminVisible: boolean;
  automaticAction: 'none' | 'retry' | 'open_incident' | 'manual_review' | 'close_incident';
};

export function matchingActionPolicy(record: Pick<MatchingAuditRecord, 'status' | 'reasonCode'>): MatchingActionPolicy {
  if (record.status === 'confirmed') {
    return { employeeVisible: false, adminVisible: true, automaticAction: 'close_incident' };
  }
  if (record.status === 'pending') {
    return { employeeVisible: false, adminVisible: true, automaticAction: 'retry' };
  }
  if (record.status === 'unavailable') {
    return { employeeVisible: false, adminVisible: true, automaticAction: 'retry' };
  }
  if (record.status === 'needs_review') {
    return { employeeVisible: false, adminVisible: true, automaticAction: 'manual_review' };
  }
  return { employeeVisible: true, adminVisible: true, automaticAction: 'open_incident' };
}

function timestamp(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function operationType(value: BankOperation['type']): MatchingOperationType | null {
  if (value === 'Debit') return 'sale';
  if (value === 'Credit') return 'refund';
  return null;
}

function expectedOfdOperationType(value: MatchingOperationType) {
  return value === 'sale' ? 1 : 2;
}

export function bankOperationKey(value: BankOperation) {
  return [value.terminalKey, value.rrn, value.transactionDate, value.type, value.amountKopecks].join('|');
}

function matchingKey(value: BankOperation) {
  return `terminal-fiscal:${bankOperationKey(value)}`;
}

function moscowDay(value: string) {
  const parsed = timestamp(value);
  return parsed === null ? '' : new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(parsed));
}

function activeMappings(value: BankOperation, mappings: TerminalMapping[]) {
  const at = timestamp(value.transactionDate);
  if (at === null) return [];
  return mappings.filter((mapping) => {
    const from = timestamp(mapping.activeFrom);
    const to = mapping.activeTo ? timestamp(mapping.activeTo) : Number.POSITIVE_INFINITY;
    return mapping.terminalKey === value.terminalKey && from !== null && to !== null && at >= from && at < to;
  });
}

function oneCOperationType(check: OneCCheck): MatchingOperationType | null {
  if (check.sourceType === 'sale_check' && check.operationType === 'sale') return 'sale';
  if (check.sourceType === 'refund_check' && check.operationType === 'refund') return 'refund';
  if (check.sourceType === 'acquiring_operation' && (check.operationType === 'sale' || check.operationType === 'refund')) {
    return check.operationType;
  }
  return null;
}

function isAcquiringOperation(check: OneCCheck) {
  return check.sourceType === 'acquiring_operation';
}

export function normalizeMatchingItemName(value: string) {
  return value
    .normalize('NFKC')
    .replace(/[\u00ad\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/[‐‑‒–—―−]/g, '-')
    .replace(/[«»„“”‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[ёЁ]/g, 'е')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s*([/\-])\s*/g, '$1')
    .toLocaleLowerCase('ru-RU');
}

function normalizeFiscalComponent(value: string | undefined) {
  return value?.normalize('NFKC').trim() ?? '';
}

function normalizeFiscalSign(value: string | undefined) {
  const normalized = normalizeFiscalComponent(value);
  if (!/^\d+$/.test(normalized)) return normalized;
  return normalized.replace(/^0+(?=\d)/, '');
}

export function canonicalFiscalKey(value: {
  fiscalDriveNumber?: string;
  fiscalDocumentNumber?: string;
  fiscalSign?: string;
}) {
  const parts = [
    normalizeFiscalComponent(value.fiscalDriveNumber),
    normalizeFiscalComponent(value.fiscalDocumentNumber),
    normalizeFiscalSign(value.fiscalSign),
  ];
  return parts.every(Boolean) ? parts.map((part) => `${part.length}:${part}`).join('|') : null;
}

function normalizedItems(items: MatchingItem[]) {
  return items.map((item) => ({
    name: normalizeMatchingItemName(item.name),
    quantity: item.quantity,
    priceKopecks: item.priceKopecks,
    sumKopecks: item.sumKopecks,
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function normalizedItemValues(items: MatchingItem[]) {
  return items.map((item) => ({
    quantity: item.quantity,
    priceKopecks: item.priceKopecks,
    sumKopecks: item.sumKopecks,
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
}

function sameItemValues(left: MatchingItem[], right: MatchingItem[]) {
  return JSON.stringify(normalizedItemValues(left)) === JSON.stringify(normalizedItemValues(right));
}

function sameItems(left: MatchingItem[], right: MatchingItem[], allowShortenedNames = false) {
  if (JSON.stringify(normalizedItems(left)) === JSON.stringify(normalizedItems(right))) return true;
  if (left.length !== right.length) return false;

  const nameTokens = (value: string) => normalizeMatchingItemName(allowShortenedNames ? value.replace(/\s*\(шт\.?\)\s*$/iu, '') : value).match(/[\p{L}\p{N}]+(?:[.,]\p{N}+)*/gu) ?? [];
  const numericParts = (value: string) => normalizeMatchingItemName(value).match(/\d+(?:[.,]\d+)*/g) ?? [];
  const safeExtendedName = (oneCName: string, ofdName: string) => {
    if (JSON.stringify(numericParts(oneCName)) !== JSON.stringify(numericParts(ofdName))) return false;
    const oneC = nameTokens(oneCName);
    const ofd = nameTokens(ofdName);
    if (oneC.length > ofd.length) return false;
    let oneCIndex = 0;
    for (const token of ofd) {
      if (oneCIndex < oneC.length && token === oneC[oneCIndex]) {
        oneCIndex += 1;
      } else if (/\d/.test(token)) {
        return false;
      }
    }
    return oneCIndex === oneC.length;
  };
  const compatible = (oneC: MatchingItem, ofd: MatchingItem) => (
    oneC.quantity === ofd.quantity
    && oneC.priceKopecks === ofd.priceKopecks
    && oneC.sumKopecks === ofd.sumKopecks
    && (safeExtendedName(oneC.name, ofd.name) || (allowShortenedNames && safeExtendedName(ofd.name, oneC.name)))
  );
  const used = new Set<number>();
  const assign = (index: number): boolean => {
    if (index === left.length) return true;
    for (let candidate = 0; candidate < right.length; candidate += 1) {
      if (used.has(candidate) || !compatible(left[index], right[candidate])) continue;
      used.add(candidate);
      if (assign(index + 1)) return true;
      used.delete(candidate);
    }
    return false;
  };
  return assign(0);
}

function withHistory(record: Omit<MatchingAuditRecord, 'history'>, previous: Map<string, MatchingAuditRecord>) {
  const old = previous.get(record.matchingKey);
  const history = old ? [...old.history] : [];
  if (!old || old.status !== record.status || old.reasonCode !== record.reasonCode) {
    history.push({ at: record.evaluatedAt, status: record.status, reasonCode: record.reasonCode });
  }
  return { ...record, history };
}

function sourceFailure(input: TerminalFiscalMatchingInput): MatchingReasonCode | null {
  if (!input.sources.tbank.complete) return input.sources.tbank.error === 'HISTORICAL_BANK_COVERAGE_INCOMPLETE' ? 'SOURCE_TBANK_HISTORICAL_INCOMPLETE' : 'SOURCE_TBANK_INCOMPLETE';
  if (!input.sources.oneC.complete) return 'SOURCE_ONE_C_INCOMPLETE';
  if (!input.sources.ofd.complete) return 'SOURCE_OFD_INCOMPLETE';
  return null;
}

export function reconcileTerminalFiscalMvp(input: TerminalFiscalMatchingInput): TerminalFiscalMatchingOutput {
  const now = timestamp(input.now);
  if (now === null) throw new Error('now must be a valid ISO date');
  const previous = new Map((input.previous ?? []).map((record) => [record.matchingKey, record]));
  const duplicateBankKeys = new Set<string>();
  const bankKeyCounts = new Map<string, number>();
  for (const operation of input.bankOperations) {
    const key = bankOperationKey(operation);
    bankKeyCounts.set(key, (bankKeyCounts.get(key) ?? 0) + 1);
  }
  bankKeyCounts.forEach((count, key) => { if (count > 1) duplicateBankKeys.add(key); });

  type Context = {
    operation: BankOperation;
    operationType: MatchingOperationType | null;
    mapping?: TerminalMapping;
    mappingsCount: number;
    candidates: Array<{ check: OneCCheck; difference: number }>;
    strictCandidateCount: number;
    dayCandidates: Array<{ check: OneCCheck; difference: number }>;
  };
  const contexts: Context[] = input.bankOperations.map((operation) => {
    const mappings = activeMappings(operation, input.mappings);
    const mapping = mappings.length === 1 ? mappings[0] : undefined;
    const bankAt = timestamp(operation.transactionDate);
    const type = operationType(operation.type);
    const allDayCandidates = !mapping || type === null || bankAt === null ? [] : input.oneCChecks.flatMap((check) => {
      if (oneCOperationType(check) !== type || check.cardPayments.length !== 1) return [];
      const payment = check.cardPayments[0];
      const checkAt = timestamp(check.dateTime);
      if (checkAt === null) return [];
      if (!isAcquiringOperation(check) && check.cashRegisterRef !== mapping.oneCCashRegisterRef) return [];
      if (payment.acquiringTerminalRef !== mapping.oneCAcquiringTerminalRef) return [];
      if (payment.amountKopecks !== operation.amountKopecks) return [];
      if (checkAt < bankAt - TERMINAL_FISCAL_TIME_TOLERANCE_MS
        || checkAt - bankAt > TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS) return [];
      return [{ check, difference: Math.abs(checkAt - bankAt) }];
    });
    // A native KKM check carries a stronger fiscal identity than the acquiring
    // register document. Use the latter only as a fallback so the same sale is
    // never reported as two equal 1C candidates.
    const kkmCandidates = allDayCandidates.filter(({ check }) => !isAcquiringOperation(check));
    const dayCandidates = kkmCandidates.length > 0 ? kkmCandidates : allDayCandidates;
    const candidates = dayCandidates.filter((candidate) => candidate.difference <= TERMINAL_FISCAL_TIME_TOLERANCE_MS);
    return { operation, operationType: type, mapping, mappingsCount: mappings.length,
      candidates, strictCandidateCount: candidates.length, dayCandidates };
  });

  // Checks may legally be created hours after the terminal payment. For every
  // same-day terminal/type/amount bucket, pair the still-unmatched operations
  // and checks in chronological order only when counts are equal. This keeps
  // repeated equal amounts one-to-one and leaves partial/ambiguous buckets for
  // review instead of guessing.
  const strictCheckRefs = new Set(contexts.flatMap((context) => (
    context.strictCandidateCount === 1 ? [context.candidates[0].check.sourceRef] : []
  )));
  const lateGroups = new Map<string, Context[]>();
  for (const context of contexts) {
    if (context.strictCandidateCount !== 0 || !context.mapping || !context.operationType || context.dayCandidates.length === 0) continue;
    const key = [context.mapping.id, context.operationType, context.operation.amountKopecks,
      moscowDay(context.operation.transactionDate)].join('|');
    lateGroups.set(key, [...(lateGroups.get(key) ?? []), context]);
  }
  for (const group of lateGroups.values()) {
    const orderedOperations = [...group].sort((a, b) => (timestamp(a.operation.transactionDate) ?? 0) - (timestamp(b.operation.transactionDate) ?? 0));
    const checksByRef = new Map<string, OneCCheck>();
    group.flatMap((context) => context.dayCandidates.map((candidate) => ({ ...candidate, context }))).forEach(({ check, context }) => {
      if (moscowDay(check.dateTime) !== moscowDay(context.operation.transactionDate)) return;
      if (!strictCheckRefs.has(check.sourceRef)) checksByRef.set(check.sourceRef, check);
    });
    const orderedChecks = [...checksByRef.values()].sort((a, b) => (timestamp(a.dateTime) ?? 0) - (timestamp(b.dateTime) ?? 0));
    if (orderedChecks.length !== orderedOperations.length) continue;
    const orderedPairs = orderedOperations.map((context, index) => ({ context, check: orderedChecks[index] }));
    if (orderedPairs.some(({ context, check }) => (
      (timestamp(check.dateTime) ?? 0) <= (timestamp(context.operation.transactionDate) ?? 0)
    ))) continue;
    orderedPairs.forEach(({ context, check }) => {
      context.candidates = [{ check, difference: Math.abs((timestamp(check.dateTime) ?? 0) - (timestamp(context.operation.transactionDate) ?? 0)) }];
    });
  }

  // A bucket can contain an older same-amount 1C check which has no terminal
  // operation in the current snapshot.  Do not let that unrelated earlier
  // check block a single, unambiguous check created after the payment.  The
  // wider window is bounded by the normal two-hour grace period and is used
  // only when both sides have exactly one possible partner.
  const unresolved = contexts.filter((context) => (
    context.strictCandidateCount === 0 && context.candidates.length === 0
    && context.mapping && context.operationType
  ));
  const forwardCandidates = new Map<Context, Array<{ check: OneCCheck; difference: number }>>();
  for (const context of unresolved) {
    const bankAt = timestamp(context.operation.transactionDate) ?? 0;
    forwardCandidates.set(context, context.dayCandidates.filter(({ check }) => {
      const checkAt = timestamp(check.dateTime) ?? 0;
      return !strictCheckRefs.has(check.sourceRef)
        && checkAt > bankAt
        && checkAt - bankAt <= TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS;
    }));
  }
  const forwardUse = new Map<string, number>();
  forwardCandidates.forEach((candidates) => candidates.forEach(({ check }) => (
    forwardUse.set(check.sourceRef, (forwardUse.get(check.sourceRef) ?? 0) + 1)
  )));
  forwardCandidates.forEach((candidates, context) => {
    if (candidates.length !== 1) return;
    const candidate = candidates[0];
    if ((forwardUse.get(candidate.check.sourceRef) ?? 0) !== 1) return;
    context.candidates = [candidate];
  });

  // Resolve only forced one-to-one assignments. Item/fiscal proof confirms
  // that the candidate really is a receipt; it never invents a bank link.
  // Equal two-by-two alternatives remain ambiguous instead of being guessed.
  function hasReceiptProof(context: Context, check: OneCCheck) {
    if (isAcquiringOperation(check) || check.fiscalConflict || check.fiscalState !== 'confirmed'
      || !check.items.length || !canonicalFiscalKey(check)) return false;
    const receipts = input.ofdReceipts.filter(receipt => canonicalFiscalKey(receipt) === canonicalFiscalKey(check));
    if (receipts.length !== 1) return false;
    const receipt = receipts[0];
    return receipt.operationType === expectedOfdOperationType(context.operationType!)
      && receipt.kktRegistrationNumber === context.mapping?.kktRegistrationNumber
      && receipt.totalKopecks === check.totalKopecks
      && receipt.electronicKopecks === check.electronicKopecks
      && receipt.electronicKopecks === context.operation.amountKopecks
      && sameItems(check.items, receipt.items);
  }
  if (!sourceFailure(input)) {
    let changed = true;
    while (changed) {
      changed = false;
      const uses = new Map<string, number>();
      for (const context of contexts) {
        if (context.candidates.length !== 1) continue;
        const ref = context.candidates[0].check.sourceRef;
        uses.set(ref, (uses.get(ref) ?? 0) + 1);
      }
      const reserved = new Set(contexts.flatMap(context => context.candidates.length === 1
        && uses.get(context.candidates[0].check.sourceRef) === 1
        && hasReceiptProof(context, context.candidates[0].check)
        ? [context.candidates[0].check.sourceRef] : []));
      for (const context of contexts) {
        if (context.candidates.length < 2) continue;
        const remaining = context.candidates.filter(candidate => !reserved.has(candidate.check.sourceRef));
        if (remaining.length !== 1 || !hasReceiptProof(context, remaining[0].check)) continue;
        context.candidates = remaining;
        changed = true;
      }
    }
  }

  function hasExcludedMultipleCardCandidate(context: Context) {
    if (!context.mapping || !context.operationType) return false;
    const bankAt = timestamp(context.operation.transactionDate);
    if (bankAt === null) return false;
    return input.oneCChecks.some((check) => {
      const checkAt = timestamp(check.dateTime);
      if (checkAt === null || check.cardPayments.length <= 1) return false;
      return oneCOperationType(check) === context.operationType
        && check.cashRegisterRef === context.mapping?.oneCCashRegisterRef
        && Math.abs(checkAt - bankAt) <= TERMINAL_FISCAL_TIME_TOLERANCE_MS
        && check.cardPayments.some((payment) => (
          payment.acquiringTerminalRef === context.mapping?.oneCAcquiringTerminalRef
          && payment.amountKopecks === context.operation.amountKopecks
        ));
    });
  }

  function hasExcludedDocumentCandidate(context: Context) {
    if (!context.mapping || !context.operationType) return false;
    const bankAt = timestamp(context.operation.transactionDate);
    if (bankAt === null) return false;
    return input.oneCChecks.some((check) => {
      if (check.sourceType === 'sale_check' || check.sourceType === 'refund_check' || check.sourceType === 'acquiring_operation') return false;
      const checkAt = timestamp(check.dateTime);
      if (checkAt === null) return false;
      return check.cashRegisterRef === context.mapping?.oneCCashRegisterRef
        && Math.abs(checkAt - bankAt) <= TERMINAL_FISCAL_TIME_TOLERANCE_MS
        && check.cardPayments.some((payment) => (
          payment.acquiringTerminalRef === context.mapping?.oneCAcquiringTerminalRef
          && payment.amountKopecks === context.operation.amountKopecks
        ));
    });
  }

  const checkCandidateUse = new Map<string, number>();
  const fiscalCandidateUse = new Map<string, number>();
  contexts.forEach((context) => {
    if (context.candidates.length === 1) {
      const ref = context.candidates[0].check.sourceRef;
      checkCandidateUse.set(ref, (checkCandidateUse.get(ref) ?? 0) + 1);
      const key = canonicalFiscalKey(context.candidates[0].check);
      if (key) fiscalCandidateUse.set(key, (fiscalCandidateUse.get(key) ?? 0) + 1);
    }
  });

  function possibleSplitSale(context: Context) {
    const bankAt = timestamp(context.operation.transactionDate);
    if (!context.mapping || !context.operationType || bankAt === null) return false;
    const parts = input.oneCChecks.filter(check => {
      const at = timestamp(check.dateTime);
      return !isAcquiringOperation(check) && !check.fiscalConflict && check.items.length > 0
        && oneCOperationType(check) === context.operationType && check.cardPayments.length === 1
        && check.cashRegisterRef === context.mapping!.oneCCashRegisterRef
        && check.cardPayments[0].acquiringTerminalRef === context.mapping!.oneCAcquiringTerminalRef
        && check.cardPayments[0].amountKopecks === check.electronicKopecks
        && check.electronicKopecks > 0 && check.electronicKopecks < context.operation.amountKopecks
        && !checkCandidateUse.has(check.sourceRef) && at !== null
        && at >= bankAt - TERMINAL_FISCAL_TIME_TOLERANCE_MS
        && at <= bankAt + TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS;
    });
    const byAmount = new Map<number, OneCCheck[]>();
    for (const part of parts) byAmount.set(part.electronicKopecks, [...(byAmount.get(part.electronicKopecks) ?? []), part]);
    for (const first of parts) {
      for (const second of byAmount.get(context.operation.amountKopecks - first.electronicKopecks) ?? []) {
        if (first.sourceRef === second.sourceRef
          || Math.abs(Date.parse(first.dateTime) - Date.parse(second.dateTime)) > TERMINAL_FISCAL_TIME_TOLERANCE_MS) continue;
        if (input.ofdReceipts.some(receipt => receipt.operationType === expectedOfdOperationType(context.operationType!)
          && receipt.kktRegistrationNumber === context.mapping!.kktRegistrationNumber
          && receipt.totalKopecks === first.totalKopecks + second.totalKopecks
          && receipt.electronicKopecks === context.operation.amountKopecks
          && Math.abs(Date.parse(receipt.receiptAt) - Date.parse(first.dateTime)) <= TERMINAL_FISCAL_TIME_TOLERANCE_MS
          && sameItems([...first.items, ...second.items], receipt.items))) return true;
      }
    }
    return false;
  }

  const globalSourceFailure = sourceFailure(input);
  const claimedKeys = new Set(contexts.flatMap(peer => peer.candidates.flatMap(candidate => {
    const key = canonicalFiscalKey(candidate.check);
    return key ? [key] : [];
  })));
  const records = contexts.map((context): MatchingAuditRecord => {
    const operation = context.operation;
    const operationAt = timestamp(operation.transactionDate);
    const graceUntilMs = (operationAt ?? now) + TERMINAL_FISCAL_GRACE_MS;
    const isPending = now < graceUntilMs;
    let status: MatchingStatus = 'needs_review';
    let reasonCode: MatchingReasonCode = 'BANK_OPERATION_INVALID';
    let oneCCheck: OneCCheck | undefined;
    let ofdReceipt: OfdReceipt | undefined;
    let timeDifferenceSeconds: number | undefined;

    if (globalSourceFailure) {
      status = 'unavailable';
      reasonCode = globalSourceFailure;
      // A temporarily incomplete OFD read must not keep an employee's
      // "check missing in 1C" task open when the complete T-Bank and 1C reads
      // already provide one safe, non-reused check for this operation. The
      // financial three-source match stays unavailable until OFD is complete;
      // only the narrower fact that the 1C check now exists is exposed here.
      if (
        globalSourceFailure === 'SOURCE_OFD_INCOMPLETE'
        && !duplicateBankKeys.has(bankOperationKey(operation))
        && operationAt !== null
        && Number.isInteger(operation.amountKopecks)
        && operation.amountKopecks > 0
        && context.operationType !== null
        && context.mappingsCount === 1
        && context.candidates.length === 1
        && (checkCandidateUse.get(context.candidates[0].check.sourceRef) ?? 0) === 1
      ) {
        oneCCheck = context.candidates[0].check;
        timeDifferenceSeconds = Math.round(context.candidates[0].difference / 1000);
      }
    } else if (duplicateBankKeys.has(bankOperationKey(operation))) {
      reasonCode = 'BANK_OPERATION_DUPLICATE';
    } else if (operationAt === null || !Number.isInteger(operation.amountKopecks) || operation.amountKopecks <= 0) {
      reasonCode = 'BANK_OPERATION_INVALID';
    } else if (context.operationType === null) {
      reasonCode = 'BANK_OPERATION_UNSUPPORTED';
    } else if (context.mappingsCount === 0) {
      status = 'unavailable';
      reasonCode = 'TERMINAL_MAPPING_MISSING';
    } else if (context.mappingsCount > 1) {
      status = 'unavailable';
      reasonCode = 'TERMINAL_MAPPING_CONFLICT';
    } else if (context.candidates.length > 1) {
      reasonCode = 'ONE_C_MULTIPLE_CANDIDATES';
    } else if (context.candidates.length === 0) {
      const splitSale = possibleSplitSale(context);
      const multipleCardPayments = hasExcludedMultipleCardCandidate(context);
      const unsupportedDocument = hasExcludedDocumentCandidate(context);
      status = splitSale || multipleCardPayments || unsupportedDocument ? 'needs_review' : isPending ? 'pending' : 'needs_review';
      // An OFD candidate is not proof of a three-source match. It is enough
      // to withhold a request to fiscalize again until ADMIN links the sale.
      // Ignore receipts already claimed by another 1C candidate. Never adjust
      // equipment clocks or infer a delay from the document date here.
      const possibleOfd = !multipleCardPayments && !unsupportedDocument && input.ofdReceipts.some(receipt => {
        const at = timestamp(receipt.receiptAt);
        const key = canonicalFiscalKey(receipt);
        return Boolean(key) && !claimedKeys.has(key!) && at !== null && at <= now
          && Math.abs(at - operationAt) <= TERMINAL_FISCAL_LATE_MATCH_WINDOW_MS
          && receipt.kktRegistrationNumber === context.mapping?.kktRegistrationNumber
          && receipt.operationType === expectedOfdOperationType(context.operationType!)
          && receipt.electronicKopecks === operation.amountKopecks
          && receipt.totalKopecks >= operation.amountKopecks;
      });
      if (possibleOfd) status = 'needs_review';
      reasonCode = splitSale
        ? 'ONE_C_POSSIBLE_SPLIT_SALE'
        : possibleOfd
        ? 'OFD_CANDIDATE_REQUIRES_LINK'
        : multipleCardPayments
        ? 'ONE_C_MULTIPLE_CARD_PAYMENTS'
        : unsupportedDocument
          ? 'ONE_C_UNSUPPORTED_DOCUMENT'
          : isPending
            ? 'ONE_C_CANDIDATE_PENDING'
            : 'ONE_C_CANDIDATE_NOT_FOUND';
    } else {
      oneCCheck = context.candidates[0].check;
      timeDifferenceSeconds = Math.round(context.candidates[0].difference / 1000);
      if ((checkCandidateUse.get(oneCCheck.sourceRef) ?? 0) > 1
        || (fiscalCandidateUse.get(canonicalFiscalKey(oneCCheck) ?? '') ?? 0) > 1) {
        reasonCode = 'ONE_C_CHECK_REUSED';
      } else if (isAcquiringOperation(oneCCheck)) {
        const receipts = input.ofdReceipts.filter((receipt) => {
          const receiptAt = timestamp(receipt.receiptAt);
          return receiptAt !== null
            && operationAt !== null
            && Math.abs(receiptAt - operationAt) <= TERMINAL_FISCAL_TIME_TOLERANCE_MS
            && receipt.operationType === expectedOfdOperationType(context.operationType!)
            && receipt.kktRegistrationNumber === context.mapping?.kktRegistrationNumber
            && receipt.totalKopecks === operation.amountKopecks
            && receipt.electronicKopecks === operation.amountKopecks;
        });
        if (receipts.length === 0) {
          status = isPending ? 'pending' : 'needs_review';
          reasonCode = isPending ? 'OFD_RECEIPT_PENDING' : 'OFD_RECEIPT_NOT_FOUND';
        } else if (receipts.length > 1) {
          reasonCode = 'OFD_RECEIPT_DUPLICATE';
        } else {
          ofdReceipt = receipts[0];
          status = 'confirmed';
          reasonCode = (timeDifferenceSeconds ?? 0) > TERMINAL_FISCAL_TIME_TOLERANCE_MS / 1000
            ? 'MATCH_CONFIRMED_LATE'
            : 'MATCH_CONFIRMED';
        }
      } else if (oneCCheck.fiscalConflict) {
        reasonCode = 'FISCAL_KEY_CONFLICT';
      } else if (oneCCheck.fiscalState !== 'confirmed' || !canonicalFiscalKey(oneCCheck)) {
        status = isPending ? 'pending' : 'needs_review';
        reasonCode = isPending ? 'FISCAL_DATA_PENDING' : 'FISCAL_DATA_UNCONFIRMED';
      } else {
        const oneCFiscalKey = canonicalFiscalKey(oneCCheck);
        const receipts = input.ofdReceipts.filter((receipt) => canonicalFiscalKey(receipt) === oneCFiscalKey);
        if (receipts.length === 0) {
          status = isPending ? 'pending' : 'needs_review';
          reasonCode = isPending ? 'OFD_RECEIPT_PENDING' : 'OFD_RECEIPT_NOT_FOUND';
        } else if (receipts.length > 1) {
          reasonCode = 'OFD_RECEIPT_DUPLICATE';
        } else {
          ofdReceipt = receipts[0];
          if (ofdReceipt.operationType !== expectedOfdOperationType(context.operationType)) {
            status = isPending ? 'pending' : 'mismatch';
            reasonCode = 'OFD_OPERATION_TYPE_MISMATCH';
          } else if (ofdReceipt.kktRegistrationNumber !== context.mapping?.kktRegistrationNumber) {
            status = isPending ? 'pending' : 'mismatch';
            reasonCode = 'OFD_KKT_MISMATCH';
          } else if (ofdReceipt.totalKopecks !== oneCCheck.totalKopecks) {
            status = isPending ? 'pending' : 'mismatch';
            reasonCode = 'OFD_TOTAL_AMOUNT_MISMATCH';
          } else if (ofdReceipt.electronicKopecks !== oneCCheck.electronicKopecks
            || ofdReceipt.electronicKopecks !== operation.amountKopecks) {
            status = isPending ? 'pending' : 'mismatch';
            reasonCode = 'OFD_ELECTRONIC_AMOUNT_MISMATCH';
          } else if (!sameItems(oneCCheck.items, ofdReceipt.items)) {
            status = 'confirmed';
            reasonCode = sameItemValues(oneCCheck.items, ofdReceipt.items)
              ? 'OFD_ITEM_PRESENTATION_DIFFERENCE'
              : 'OFD_ITEM_VALUES_MISMATCH';
          } else {
            status = 'confirmed';
            reasonCode = (timeDifferenceSeconds ?? 0) > TERMINAL_FISCAL_TIME_TOLERANCE_MS / 1000
              ? 'MATCH_CONFIRMED_LATE'
              : 'MATCH_CONFIRMED';
          }
        }
      }
    }

    return withHistory({
      matchingKey: matchingKey(operation),
      version: TERMINAL_FISCAL_MATCHING_VERSION,
      status,
      reasonCode,
      evaluatedAt: input.now,
      graceUntil: new Date(graceUntilMs).toISOString(),
      mappingId: context.mapping?.id,
      bankOperationKey: bankOperationKey(operation),
      oneCCheckKey: oneCCheck?.sourceRef,
      oneCCashierRef: oneCCheck?.cashier.ref || undefined,
      oneCCashierName: oneCCheck?.cashier.name || undefined,
      ofdReceiptKey: ofdReceipt ? canonicalFiscalKey(ofdReceipt) ?? undefined : undefined,
      operationType: context.operationType ?? undefined,
      amountKopecks: operation.amountKopecks,
      timeDifferenceSeconds,
      candidateCount: context.candidates.length,
      evidence: {
        bankTransactionDate: operation.transactionDate,
        bankOperationRawType: operation.rawType,
        terminalReceiptNumber: operation.terminalReceiptNumber,
        oneCDateTime: oneCCheck?.dateTime,
        oneCFiscalDateTime: oneCCheck?.fiscalDateTime,
        oneCTotalKopecks: oneCCheck?.totalKopecks,
        oneCElectronicKopecks: oneCCheck?.electronicKopecks,
        ofdReceiptAt: ofdReceipt?.receiptAt,
        ofdTotalKopecks: ofdReceipt?.totalKopecks,
        ofdElectronicKopecks: ofdReceipt?.electronicKopecks,
      },
      sourceCheckedAt: {
        tbank: input.sources.tbank.checkedAt,
        oneC: input.sources.oneC.checkedAt,
        ofd: input.sources.ofd.checkedAt,
      },
      sourceCompleteness: {
        tbank: input.sources.tbank.complete,
        oneC: input.sources.oneC.complete,
        ofd: input.sources.ofd.complete,
      },
    }, previous);
  });

  const reviewed = sourceFailure(input) ? records : fiscalChainReview(input, records, (check, mapping) => {
    if (check.fiscalConflict || check.fiscalState !== 'confirmed' || !check.items.length || !canonicalFiscalKey(check)
      || check.cashRegisterRef !== mapping.oneCCashRegisterRef) return false;
    const receipts = input.ofdReceipts.filter(r => canonicalFiscalKey(r) === canonicalFiscalKey(check));
    return input.oneCChecks.filter(c => canonicalFiscalKey(c) === canonicalFiscalKey(check)).length === 1
      && receipts.length === 1 && receipts[0].kktRegistrationNumber === mapping.kktRegistrationNumber
      && receipts[0].operationType === (check.operationType === 'refund' ? 2 : 1)
      && receipts[0].totalKopecks === check.totalKopecks && receipts[0].electronicKopecks === check.electronicKopecks
      && sameItems(check.items, receipts[0].items, true);
  });
  return { version: TERMINAL_FISCAL_MATCHING_VERSION, evaluatedAt: input.now,
    records: reviewed.map(({ history, ...record }) => withHistory(record, previous)) };
}
