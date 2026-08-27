function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

async function getJson(url: string) {
  const started = Date.now();
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(30_000) });
    const body = await response.json().catch(() => null);
    return { status: response.status, ok: response.ok, durationMs: Date.now() - started, body: record(body), error: '' };
  } catch (error) {
    return { status: 0, ok: false, durationMs: Date.now() - started, body: null, error: error instanceof Error ? error.name : 'request_failed' };
  }
}

async function main() {
  const baseUrl = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!baseUrl) throw new Error('PLATFORMA_OFD_PROXY_BASE_URL is missing');
  const list = await getJson(`${baseUrl}/api/v1/ofd/platforma/kkts`);
  const kkts = Array.isArray(record(list.body?.data)?.kkts) ? record(list.body?.data)?.kkts as unknown[] : [];
  const periods = [['2026-07-01', '2026-08-01'], ['2026-08-01', '2026-09-01']];
  const checks = [];
  for (const raw of kkts) {
    const kkt = record(raw);
    const registrationNumber = String(kkt?.registrationNumber ?? '');
    for (const [from, to] of periods) {
      const query = new URLSearchParams({ kktRegNumber: registrationNumber, from: `${from}T00:00:00+03:00`, to: `${to}T00:00:00+03:00` });
      const result = await getJson(`${baseUrl}/api/v1/ofd/platforma/receipts?${query}`);
      const data = record(result.body?.data);
      const meta = record(result.body?.meta);
      checks.push({
        kkt: `…${registrationNumber.slice(-4)}`,
        period: `${from}/${to}`,
        ok: result.ok,
        status: result.status,
        durationMs: result.durationMs,
        complete: meta?.complete === true,
        receiptCount: Array.isArray(data?.receipts) ? data.receipts.length : 0,
        errorCode: String(result.body?.errorCode ?? result.body?.error ?? result.error ?? '').slice(0, 120),
        metaKeys: meta ? Object.keys(meta).sort() : [],
      });
    }
  }
  console.log(JSON.stringify({ list: { ok: list.ok, status: list.status, durationMs: list.durationMs, kktCount: kkts.length }, checks }, null, 2));
}

main();
