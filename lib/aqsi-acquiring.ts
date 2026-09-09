import 'server-only';

import type { BankOperation } from '@/lib/terminal-fiscal-matching';
import type { SourceSnapshot } from '@/lib/terminal-fiscal-sources';

const DEFAULT_BASE_URL = 'https://api.aqsi.ru/pub';
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

type FetchLike = typeof fetch;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
}

function operationType(value: string): BankOperation['type'] {
  if (value === 'purchase') return 'Debit';
  if (value === 'refund') return 'Credit';
  return 'Other';
}

export async function loadAqsiOperations(input: {
  apiKey: string;
  portalTerminalKey: string;
  aqsiTerminalId: string;
  from: string;
  to: string;
  baseUrl?: string;
  fetcher?: FetchLike;
}): Promise<SourceSnapshot<BankOperation>> {
  const checkedAt = new Date().toISOString();
  const fromMs = new Date(input.from).getTime();
  const toMs = new Date(input.to).getTime();
  if (!input.apiKey.trim() || !input.portalTerminalKey.trim() || !input.aqsiTerminalId.trim()) {
    return { complete: false, checkedAt, data: [], errorCode: 'AQSI_NOT_CONFIGURED' };
  }
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) {
    return { complete: false, checkedAt, data: [], errorCode: 'INVALID_PERIOD' };
  }

  const fetcher = input.fetcher ?? fetch;
  const baseUrl = (input.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const operations = new Map<string, BankOperation>();
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const query = new URLSearchParams({
      pageSize: String(PAGE_SIZE),
      page: String(page),
      'filtered.processedAtTzFrom': input.from,
      'filtered.processedAtTzTo': input.to,
      'filtered.terminalId': input.aqsiTerminalId,
    });
    let response: Response;
    let body: unknown;
    try {
      response = await fetcher(`${baseUrl}/v4/Slips?${query}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json', 'x-client-key': `Application ${input.apiKey.trim()}` },
      });
      body = await response.json().catch(() => null);
    } catch {
      return { complete: false, checkedAt, data: [...operations.values()], errorCode: 'AQSI_REQUEST_FAILED', windows: page };
    }
    const root = record(body);
    const rows = Array.isArray(root?.rows) ? root.rows : null;
    if (!response.ok || !root || !rows) {
      return { complete: false, checkedAt, data: [...operations.values()], errorCode: 'AQSI_REQUEST_FAILED', windows: page };
    }
    for (const value of rows) {
      const row = record(value);
      const content = record(row?.content);
      const id = text(row?.id);
      const transactionDate = text(content?.dateTime) || text(row?.processedAtTz);
      const amountKopecks = Number(content?.amount);
      const type = operationType(text(content?.type));
      const terminalId = text(content?.terminalId);
      const iface = text(content?.iface).toLowerCase();
      const responseCode = text(content?.responseCode).toUpperCase();
      if (!id || !Number.isSafeInteger(amountKopecks) || amountKopecks <= 0
        || !Number.isFinite(new Date(transactionDate).getTime()) || type === 'Other'
        || terminalId !== input.aqsiTerminalId || !['000', 'SUCCESS'].includes(responseCode)
        || !['sbp', 'contactless', 'contact', 'magstripe'].includes(iface)) {
        return { complete: false, checkedAt, data: [...operations.values()], errorCode: 'AQSI_NORMALIZATION_FAILED', windows: page };
      }
      const rrn = text(content?.retrievalReferenceNumber) || `aqsi:${id}`;
      operations.set(id, {
        terminalKey: input.portalTerminalKey,
        rrn,
        transactionDate,
        amountKopecks,
        type,
        rawType: iface === 'sbp' ? 'TERM_SBP' : 'TERM_CARD',
      });
    }
    const pages = Number(root.pages);
    const count = Number(root.count);
    if ((Number.isSafeInteger(pages) && page >= pages) || rows.length < PAGE_SIZE) {
      if (Number.isSafeInteger(count) && operations.size !== count) {
        return { complete: false, checkedAt, data: [...operations.values()], errorCode: 'AQSI_PAGINATION_INCOMPLETE', windows: page };
      }
      return { complete: true, checkedAt, data: [...operations.values()].sort((a, b) => a.transactionDate.localeCompare(b.transactionDate)), windows: page };
    }
  }
  return { complete: false, checkedAt, data: [...operations.values()], errorCode: 'AQSI_PAGINATION_LIMIT', windows: MAX_PAGES };
}
