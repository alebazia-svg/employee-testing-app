import 'server-only';
import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import { ASTEMIR_ONE_C_IDENTITY } from '@/lib/payroll-purchase-suppliers';
import type { PayrollSupplierSettlement } from '@/lib/payroll-purchase-suppliers';

type OneCReadResult<T> = {
  ok: boolean;
  checkedAt: string;
  data: T | null;
  error?: string;
};

export type PayrollOneCCloseState = {
  date: string;
  ready: boolean;
  executionDate: string | null;
  finishedAt: string | null;
  costDocument: string | null;
  blockingIssues: string[];
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readString(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function readNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBoolean(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'boolean') return value;
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false') return false;
  }
  return null;
}

function getConfig() {
  const env = readOneCRuntimeEnv();
  return {
    baseUrl: env.baseUrl,
    user: env.user,
    password: env.password,
    timeoutMs: Math.max(1000, Number(env.requestTimeoutMs) || 15000),
  };
}

async function requestOneC(path: string, searchParams: URLSearchParams): Promise<OneCReadResult<unknown>> {
  const checkedAt = new Date().toISOString();
  const config = getConfig();
  if (!config.baseUrl || !config.user || !config.password) {
    return { ok: false, checkedAt, data: null, error: 'Не настроено безопасное чтение данных из 1С.' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await fetch(`${config.baseUrl}${path}?${searchParams}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${Buffer.from(`${config.user}:${config.password}`, 'utf8').toString('base64')}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) as unknown : null;
    } catch {
      data = null;
    }
    if (!response.ok) return { ok: false, checkedAt, data: null, error: `1С вернула HTTP ${response.status}.` };
    return { ok: true, checkedAt, data };
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError'
      ? '1С не ответила вовремя.'
      : 'Не удалось прочитать данные из 1С.';
    return { ok: false, checkedAt, data: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeOperation(value: string) {
  return value.toLocaleLowerCase('ru').replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function operationCompleted(operations: Record<string, unknown>[], fragment: string) {
  const expected = normalizeOperation(fragment);
  return operations.some((operation) => {
    const name = normalizeOperation(readString(operation, ['operation', 'presentation', 'name', 'Операция']));
    const running = readBoolean(operation, ['running', 'Выполняется']) === true;
    const hadErrors = readBoolean(operation, ['had_errors', 'has_errors', 'Ошибки']) === true;
    const finished = Boolean(readString(operation, ['end_time', 'finished_at', 'ДатаОкончания']));
    return name.includes(expected) && finished && !running && !hadErrors;
  });
}

function formatRussianDate(date: string) {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
}

export async function getPayrollOneCCloseState(
  date: string,
  options: { requireExecutionDate?: boolean } = {},
): Promise<OneCReadResult<PayrollOneCCloseState>> {
  const result = await requestOneC('/month-close-execution-state', new URLSearchParams({ date }));
  if (!result.ok) return { ...result, data: null };
  const payload = readRecord(result.data);
  if (!payload || payload.ok !== true) {
    return { ok: false, checkedAt: result.checkedAt, data: null, error: '1С не подтвердила состояние закрытия дня.' };
  }

  const operations = readArray(payload.execution_register).map(readRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  const costDocuments = readArray(payload.cost_calculation_documents).map(readRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  const required = [
    'Формирование движений по расчетам с партнерами',
    'Переоценка денежных средств',
    'Расчет себестоимости',
    'Оформление документов распределения расходов',
    'Распределение расходов',
    'Распределение доходов',
    'Формирование движений по НДС',
  ];
  const missingOperations = required.filter((name) => !operationCompleted(operations, name));
  const finalCostDocument = costDocuments.find((document) => (
    readBoolean(document, ['posted', 'Проведен']) === true
      && readBoolean(document, ['deletion_mark', 'ПометкаУдаления']) !== true
      && readBoolean(document, ['preliminary', 'Предварительный']) !== true
  ));
  const runningOrFailed = operations.some((operation) => (
    readBoolean(operation, ['running', 'Выполняется']) === true
      || readBoolean(operation, ['had_errors', 'has_errors', 'Ошибки']) === true
  ));
  const finishedAt = operations
    .map((operation) => readString(operation, ['end_time', 'finished_at', 'ДатаОкончания']))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  const expectedExecutionDate = formatRussianDate(date);
  const executionDates = Array.from(new Set(operations
    .map((operation) => readString(operation, ['start_time', 'started_at', 'ДатаНачала']).slice(0, 10))
    .filter(Boolean)));
  const executionDate = executionDates.length === 1 ? executionDates[0] : null;
  const blockingIssues = [
    options.requireExecutionDate !== false && executionDate !== expectedExecutionDate
      ? 'Последнее закрытие выполнено не за выбранную дату.' : '',
    runningOrFailed ? 'Закрытие месяца ещё выполняется или завершилось с ошибкой.' : '',
    ...missingOperations.map((name) => `Не подтверждён этап «${name}».`),
    !finalCostDocument ? 'Нет проведённого итогового документа расчёта себестоимости.' : '',
  ].filter(Boolean);

  return {
    ok: true,
    checkedAt: result.checkedAt,
    data: {
      date,
      ready: blockingIssues.length === 0,
      executionDate,
      finishedAt,
      costDocument: finalCostDocument ? readString(finalCostDocument, ['name', 'presentation', 'number', 'Номер']) || null : null,
      blockingIssues,
    },
  };
}

export type PayrollPurchaseAttribution = {
  contractVersion: 'payroll-purchase-attribution-v1';
  employeeRef: string;
  employeeName: string;
  documentCount: number;
  reviewDocumentCount: number;
  ignoredOtherDocumentCount: number;
  settlements: PayrollSupplierSettlement[];
};

function normalizeRef(value: string) {
  return value.trim().toLocaleLowerCase('en-US');
}

function normalizeIdentityName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');
}

function isRubleCurrency(value: string) {
  const normalized = value.toLocaleLowerCase('ru').replace(/\./g, '').trim();
  return !normalized || ['руб', 'rub', 'rur', 'российский рубль'].includes(normalized);
}

export async function getPayrollPurchaseAttribution(
  dateFrom: string,
  dateTo: string,
): Promise<OneCReadResult<PayrollPurchaseAttribution>> {
  const result = await requestOneC('/payroll-purchase-attribution', new URLSearchParams({
    date_from: dateFrom,
    date_to: dateTo,
    organization: 'ОФФОНИКА',
    limit: '5000',
  }));
  if (!result.ok) return { ...result, data: null };
  const payload = readRecord(result.data);
  if (
    !payload
    || payload.ok !== true
    || readString(payload, ['endpoint']) !== 'payroll-purchase-attribution'
    || readString(payload, ['contract_version']) !== 'payroll-purchase-attribution-v1'
    || readBoolean(payload, ['complete']) !== true
    || readBoolean(payload, ['affects_payroll']) !== false
    || readBoolean(payload, ['write_operations']) !== false
  ) {
    return { ok: false, checkedAt: result.checkedAt, data: null, error: '1С не подтвердила полный безопасный источник документов закупок.' };
  }
  if (!Array.isArray(payload.rows)) {
    return { ok: false, checkedAt: result.checkedAt, data: null, error: '1С не вернула список документов закупок.' };
  }

  const expectedRef = normalizeRef(ASTEMIR_ONE_C_IDENTITY.ref);
  const expectedName = normalizeIdentityName(ASTEMIR_ONE_C_IDENTITY.name);
  const seenDocuments = new Set<string>();
  const grouped = new Map<string, PayrollSupplierSettlement>();
  let documentCount = 0;
  let reviewDocumentCount = 0;
  let ignoredOtherDocumentCount = 0;

  for (const value of payload.rows) {
    const row = readRecord(value);
    if (!row) {
      return { ok: false, checkedAt: result.checkedAt, data: null, error: '1С вернула некорректную строку документа закупки.' };
    }
    const documentRef = normalizeRef(readString(row, ['document_ref']));
    if (!documentRef || seenDocuments.has(documentRef)) {
      return { ok: false, checkedAt: result.checkedAt, data: null, error: '1С вернула пустой или повторяющийся документ закупки.' };
    }
    seenDocuments.add(documentRef);

    const authorRef = normalizeRef(readString(row, ['author_ref']));
    const managerRef = normalizeRef(readString(row, ['manager_ref']));
    const belongsToAstemir = authorRef === expectedRef || managerRef === expectedRef;
    if (!belongsToAstemir) {
      ignoredOtherDocumentCount += 1;
      continue;
    }
    const identityMatched = readBoolean(row, ['author_manager_match']) === true
      && authorRef === expectedRef
      && managerRef === expectedRef;
    if (!identityMatched) {
      reviewDocumentCount += 1;
      continue;
    }
    if (
      normalizeIdentityName(readString(row, ['author_name'])) !== expectedName
      || normalizeIdentityName(readString(row, ['manager_name'])) !== expectedName
    ) {
      return { ok: false, checkedAt: result.checkedAt, data: null, error: 'В 1С изменилось имя, связанное с подтверждённым идентификатором Астемира.' };
    }

    const supplierName = readString(row, ['supplier_partner']);
    const organizationName = readString(row, ['organization']);
    const currency = readString(row, ['settlement_currency']);
    const debtIncrease = readNumber(row, ['debt_increase']);
    if (!supplierName || debtIncrease === null) {
      return { ok: false, checkedAt: result.checkedAt, data: null, error: '1С вернула неполный документ закупки Астемира.' };
    }
    if (!isRubleCurrency(currency)) {
      return { ok: false, checkedAt: result.checkedAt, data: null, error: `Документ Астемира по поставщику «${supplierName}» рассчитан не в рублях.` };
    }
    if (organizationName.toLocaleLowerCase('ru') !== 'оффоника') {
      return { ok: false, checkedAt: result.checkedAt, data: null, error: `В документах Астемира найдена другая организация: «${organizationName || 'не указана'}».` };
    }
    const key = JSON.stringify([supplierName.trim(), organizationName.trim(), currency.trim()]);
    const current = grouped.get(key) ?? { supplierName, organizationName, currency, debtIncrease: 0, sourceRows: 0 };
    current.debtIncrease += debtIncrease;
    current.sourceRows += 1;
    grouped.set(key, current);
    documentCount += 1;
  }

  return {
    ok: true,
    checkedAt: result.checkedAt,
    data: {
      contractVersion: 'payroll-purchase-attribution-v1',
      employeeRef: ASTEMIR_ONE_C_IDENTITY.ref,
      employeeName: ASTEMIR_ONE_C_IDENTITY.name,
      documentCount,
      reviewDocumentCount,
      ignoredOtherDocumentCount,
      settlements: Array.from(grouped.values()),
    },
  };
}
