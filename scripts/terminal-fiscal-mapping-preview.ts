export {};

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : '';
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

function metadataRef(value: unknown) {
  const source = record(value);
  return source ? text(source.ref) || text(source.id) || text(source.value) : '';
}

function moscowDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function nextDateKey(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function json(url: string, headers: HeadersInit) {
  const response = await fetch(url, { method: 'GET', headers, cache: 'no-store' });
  const body = await response.json().catch(() => null) as unknown;
  if (!response.ok) throw new Error(`Read-only preview request failed: HTTP ${response.status}`);
  return record(body) ?? {};
}

async function main() {
  const from = argument('from');
  const to = argument('to');
  if (!from || !to) throw new Error('Usage: npm run matching:mapping:preview -- --from <ISO> --to <ISO>');

  const tbankBase = (process.env.TBANK_API_BASE_URL || 'https://business.tbank.ru/openapi').replace(/\/+$/, '');
  const tbankToken = process.env.TBANK_API_TOKEN?.trim();
  const oneCBase = process.env['1C_BASE_URL']?.trim().replace(/\/+$/, '');
  const oneCUser = process.env['1C_API_USER']?.trim();
  const oneCPassword = process.env['1C_API_PASSWORD'];
  if (!tbankToken || !oneCBase || !oneCUser || !oneCPassword) throw new Error('T-Bank or 1C read-only runtime configuration is missing');

  const terminalRows: Array<{ terminalKey: string; terminalId: string }> = [];
  for (let page = 0; page < 100; page += 1) {
    const body = await json(`${tbankBase}/api/v1/tacq/terminals?page=${page}&size=100`, {
      Authorization: `Bearer ${tbankToken}`, Accept: 'application/json',
    });
    const rows = Array.isArray(body.terminals) ? body.terminals : [];
    terminalRows.push(...rows.flatMap((entry) => {
      const terminal = record(entry);
      const terminalKey = text(terminal?.key);
      const terminalId = text(terminal?.id);
      return terminalKey && terminalId ? [{ terminalKey, terminalId }] : [];
    }));
    const totalPages = Number(body.totalPages);
    if (rows.length < 100 || (Number.isFinite(totalPages) && page + 1 >= totalPages)) break;
  }

  const combinations = new Map<string, { acquiringTerminalRef: string; cashRegisterRef: string; kktRegistrationNumber: string }>();
  const auth = Buffer.from(`${oneCUser}:${oneCPassword}`, 'utf8').toString('base64');
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || toDate <= fromDate) throw new Error('Invalid preview period');
  const oneCFrom = moscowDateKey(fromDate);
  const oneCTo = nextDateKey(moscowDateKey(new Date(toDate.getTime() - 1)));
  for (let offset = 0; offset <= 5000; offset += 500) {
    const query = new URLSearchParams({ from: oneCFrom, to: oneCTo, limit: '500', offset: String(offset) });
    const body = await json(`${oneCBase}/kkm-checks?${query}`, { Authorization: `Basic ${auth}`, Accept: 'application/json' });
    if (body.ok !== true) throw new Error('1C preview returned an incomplete response');
    const checks = Array.isArray(body.checks) ? body.checks : [];
    const facts = new Map((Array.isArray(body.fiscalFacts) ? body.fiscalFacts : []).flatMap((entry) => {
      const fact = record(entry);
      const key = text(fact?.fiscalKey);
      return fact && key ? [[key, fact] as const] : [];
    }));
    checks.forEach((entry) => {
      const check = record(entry);
      if (!check) return;
      const cashRegisterRef = metadataRef(check.cashRegister);
      const factKeys = Array.isArray(check.fiscalFactKeys) ? check.fiscalFactKeys.map(text) : [];
      const fact = factKeys.map((key) => facts.get(key)).find(Boolean);
      const kktRegistrationNumber = text(fact?.kktRegistrationNumber);
      const payments = Array.isArray(check.cardPayments) ? check.cardPayments : [];
      payments.forEach((value) => {
        const payment = record(value);
        const acquiringTerminalRef = metadataRef(payment?.acquiringTerminal);
        if (!acquiringTerminalRef || !cashRegisterRef || !kktRegistrationNumber) return;
        const key = [acquiringTerminalRef, cashRegisterRef, kktRegistrationNumber].join('|');
        combinations.set(key, { acquiringTerminalRef, cashRegisterRef, kktRegistrationNumber });
      });
    });
    const pagination = record(body.pagination);
    if (pagination?.has_more !== true) break;
    if (checks.length < 500) throw new Error('1C preview pagination contradiction');
  }

  process.stdout.write(`${JSON.stringify({
    complete: true,
    tbankTerminals: terminalRows,
    oneCCombinations: [...combinations.values()],
    automaticMappings: [],
    note: 'Preview only: связь terminalKey → терминал 1С → касса → ККТ требует ручного подтверждения; БД не изменена.',
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Preview failed'}\n`);
  process.exitCode = 1;
});
