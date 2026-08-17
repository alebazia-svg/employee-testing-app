import 'server-only';

import { readOneCRuntimeEnv } from '@/lib/one-c-env';
import type { ExpenseRequestInput, OneCNamedRef } from '@/lib/expense-request-completeness';

export type ExpenseRequestSourceBranch<T = unknown> = {
  source?: string;
  complete?: boolean;
  truncated?: boolean;
  missing_fields?: unknown[];
  errors?: unknown[];
  rows?: T[];
};

export type ExpenseRequestSourceRow = ExpenseRequestInput & {
  number?: string | null;
  posted?: boolean | null;
  deletion_mark?: boolean | null;
  status?: (OneCNamedRef & { key?: string | null }) | null;
  cashbox?: OneCNamedRef | null;
  payment_form?: { value?: string | null; cash?: boolean; cashless?: boolean; card?: boolean } | null;
  department?: OneCNamedRef | null;
  author?: OneCNamedRef | null;
  decided_by?: OneCNamedRef | null;
  desired_payment_date?: string | null;
  payment_date?: string | null;
  linked_cash_expense_orders?: ExpenseRequestSourceBranch<{
    ref?: string | null;
    number?: string | null;
    date?: string | null;
    posted?: boolean | null;
    deletion_mark?: boolean | null;
    amount?: number | null;
    request_amount?: number | null;
    executed_amount?: number | null;
    cashbox?: OneCNamedRef | null;
    source_paths?: string[];
  }> | null;
  planned_distribution?: ExpenseRequestSourceBranch | null;
};

type ExpenseRequestPage = {
  ok?: boolean;
  rows?: ExpenseRequestSourceRow[];
  pagination?: { limit?: number; offset?: number; has_more?: boolean };
  completeness?: Record<string, boolean | undefined> & { complete?: boolean };
};

export type ExpenseRequestSnapshot = {
  rows: ExpenseRequestSourceRow[];
  complete: boolean;
  checkedAt: string;
  pageCount: number;
  errors: string[];
};

const MAX_PERIOD_MS = 31 * 24 * 60 * 60 * 1000;
const PAGE_LIMIT = 100;
const MAX_ROWS = 10_000;
const MOSCOW_TIME_ZONE = 'Europe/Moscow';

export function expenseRequestMoscowCalendarDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: MOSCOW_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export async function fetchExpenseRequestSnapshot(input: { from: Date; to: Date }): Promise<ExpenseRequestSnapshot> {
  if (!(input.from instanceof Date) || Number.isNaN(input.from.getTime()) || !(input.to instanceof Date) || Number.isNaN(input.to.getTime())) {
    throw new Error('EXPENSE_REQUEST_PERIOD_INVALID');
  }
  if (input.to <= input.from || input.to.getTime() - input.from.getTime() > MAX_PERIOD_MS) {
    throw new Error('EXPENSE_REQUEST_PERIOD_INVALID');
  }
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw new Error('EXPENSE_REQUEST_SOURCE_UNCONFIGURED');
  const timeoutMs = readPositiveInteger(env.requestTimeoutMs, 15_000);
  const auth = `Basic ${Buffer.from(`${env.user}:${env.password}`, 'utf8').toString('base64')}`;
  const rows: ExpenseRequestSourceRow[] = [];
  const errors: string[] = [];
  let complete = true;
  let pageCount = 0;

  for (let offset = 0; offset <= MAX_ROWS; offset += PAGE_LIMIT) {
    const query = new URLSearchParams({
      from: expenseRequestMoscowCalendarDate(input.from),
      to: expenseRequestMoscowCalendarDate(input.to),
      limit: String(PAGE_LIMIT),
      offset: String(offset),
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    let payload: ExpenseRequestPage;
    try {
      response = await fetch(`${env.baseUrl}/expense-requests?${query}`, {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: auth },
        cache: 'no-store',
        signal: controller.signal,
      });
      payload = await response.json() as ExpenseRequestPage;
    } catch (error) {
      const code = error instanceof DOMException && error.name === 'AbortError' ? 'SOURCE_TIMEOUT' : 'SOURCE_REQUEST_FAILED';
      throw new Error(code);
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok || payload.ok === false) throw new Error(`EXPENSE_REQUEST_SOURCE_HTTP_${response.status}`);
    const pageRows = Array.isArray(payload.rows) ? payload.rows : [];
    rows.push(...pageRows);
    pageCount += 1;
    if (payload.completeness?.complete === false) complete = false;
    if (pageRows.length < PAGE_LIMIT) break;
    if (rows.length >= MAX_ROWS) {
      complete = false;
      errors.push('SOURCE_ROW_LIMIT_REACHED');
      break;
    }
  }

  const uniqueRows = new Map<string, ExpenseRequestSourceRow>();
  for (const row of rows) {
    const ref = String(row.ref ?? '').trim();
    if (!ref) {
      complete = false;
      errors.push('ROW_REF_MISSING');
      continue;
    }
    if (uniqueRows.has(ref)) {
      complete = false;
      errors.push('ROW_REF_DUPLICATED');
      continue;
    }
    uniqueRows.set(ref, row);
  }

  return { rows: [...uniqueRows.values()], complete, checkedAt: new Date().toISOString(), pageCount, errors: [...new Set(errors)] };
}
