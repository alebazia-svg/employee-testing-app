export type PlatformaWindowResult<T> = { complete: boolean; receipts: T[]; providerTimeout: boolean };

/** Retry only a provider-confirmed timeout with smaller contiguous windows.
 * Keep requests sequential within a job; the caller's existing pool stays bounded.
 */
export async function readPlatformaReceiptWindow<T>(input: {
  from: string;
  toExclusive: string;
  read: (from: string, toExclusive: string) => Promise<PlatformaWindowResult<T>>;
}): Promise<PlatformaWindowResult<T>> {
  const moscow = (time: number) => new Date(time + 3 * 60 * 60 * 1000).toISOString().slice(0, 19) + '+03:00';
  async function visit(from: string, to: string, depth: number): Promise<PlatformaWindowResult<T>> {
    const result = await input.read(from, to);
    if (result.complete || !result.providerTimeout || depth >= 3) return result;
    const start = Date.parse(from), end = Date.parse(to);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end - start < 6 * 60 * 60 * 1000) return result;
    const middle = moscow(start + (end - start) / 2);
    const left = await visit(from, middle, depth + 1);
    if (!left.complete) return left;
    const right = await visit(middle, to, depth + 1);
    return { complete: right.complete, providerTimeout: right.providerTimeout, receipts: [...left.receipts, ...right.receipts] };
  }
  return visit(input.from, input.toExclusive, 0);
}
