export const TBANK_MATCHING_PAGE_LIMIT = 1000;
export const TBANK_MATCHING_MIN_WINDOW_MS = 1000;

export type CompleteWindowPage<T> = { ok: boolean; operations: T[] };

export function splitIntoFixedWindows(fromMs: number, toMs: number, maxWindowMs: number) {
  if (!(toMs > fromMs) || maxWindowMs <= 0) return [];
  const windows: Array<{ fromMs: number; toMs: number }> = [];
  for (let cursor = fromMs; cursor < toMs; cursor += maxWindowMs) {
    windows.push({ fromMs: cursor, toMs: Math.min(cursor + maxWindowMs, toMs) });
  }
  return windows;
}

export async function collectCompleteTBankWindow<T>(input: {
  fromMs: number;
  toMs: number;
  loadPage: (fromMs: number, toMs: number, limit: number) => Promise<CompleteWindowPage<T>>;
  identity: (value: T) => string;
}) {
  const collected = new Map<string, T>();
  let windows = 0;
  async function loadWindow(fromMs: number, toMs: number): Promise<boolean> {
    windows += 1;
    const page = await input.loadPage(fromMs, toMs, TBANK_MATCHING_PAGE_LIMIT);
    if (!page.ok) return false;
    if (page.operations.length === TBANK_MATCHING_PAGE_LIMIT) {
      if (toMs - fromMs <= TBANK_MATCHING_MIN_WINDOW_MS) return false;
      const middle = fromMs + Math.floor((toMs - fromMs) / 2);
      return (await loadWindow(fromMs, middle)) && (await loadWindow(middle, toMs));
    }
    page.operations.forEach((operation) => collected.set(input.identity(operation), operation));
    return true;
  }
  const complete = await loadWindow(input.fromMs, input.toMs);
  return { complete, windows, operations: [...collected.values()] };
}
