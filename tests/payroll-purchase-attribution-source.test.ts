import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { ASTEMIR_ONE_C_IDENTITY } from '../lib/payroll-purchase-suppliers';
import { getPayrollPurchaseAttribution } from '../lib/payroll-one-c-control-source';

const originalFetch = globalThis.fetch;
const envKeys = ['1C_BASE_URL', '1C_API_USER', '1C_API_PASSWORD'];
const previous = envKeys.map((key) => process.env[key]);

before(() => envKeys.forEach((key, index) => {
  process.env[key] = ['http://one-c.invalid', 'test', 'test'][index];
}));
beforeEach(() => { globalThis.fetch = originalFetch; });
after(() => {
  globalThis.fetch = originalFetch;
  envKeys.forEach((key, index) => {
    if (previous[index] === undefined) delete process.env[key];
    else process.env[key] = previous[index];
  });
});

function document(overrides: Record<string, unknown> = {}) {
  return {
    document_ref: crypto.randomUUID(),
    document_date: '2026-08-01T12:00:00',
    author_ref: ASTEMIR_ONE_C_IDENTITY.ref,
    author_name: ASTEMIR_ONE_C_IDENTITY.name,
    manager_ref: ASTEMIR_ONE_C_IDENTITY.ref,
    manager_name: ASTEMIR_ONE_C_IDENTITY.name,
    author_manager_match: true,
    supplier_partner: 'Luxo',
    organization: 'ОФФОНИКА',
    settlement_currency: 'руб.',
    debt_increase: 100,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    endpoint: 'payroll-purchase-attribution',
    contract_version: 'payroll-purchase-attribution-v1',
    complete: true,
    affects_payroll: false,
    write_operations: false,
    rows: [document()],
    ...overrides,
  };
}

function respond(body: unknown) {
  const calls: URL[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, 'GET');
    const url = new URL(String(input));
    calls.push(url);
    return Response.json(body);
  }) as typeof fetch;
  return calls;
}

describe('Astemir purchase-document attribution source', () => {
  it('includes only documents with the exact approved author and manager identity', async () => {
    const calls = respond(payload({ rows: [
      document({ debt_increase: 100 }),
      document({ supplier_partner: 'Luxo', debt_increase: 50 }),
      document({ author_ref: 'other', author_name: 'Другой', manager_ref: 'other', manager_name: 'Другой' }),
    ] }));

    const result = await getPayrollPurchaseAttribution('2026-08-01', '2026-08-31');
    assert.equal(result.ok, true);
    assert.equal(result.data?.documentCount, 2);
    assert.equal(result.data?.ignoredOtherDocumentCount, 1);
    assert.equal(result.data?.reviewDocumentCount, 0);
    assert.equal(result.data?.settlements[0].debtIncrease, 150);
    assert.equal(result.data?.settlements[0].sourceRows, 2);
    assert.equal(calls[0].pathname, '/payroll-purchase-attribution');
    assert.equal(calls[0].searchParams.get('organization'), 'ОФФОНИКА');
    assert.equal(calls[0].searchParams.get('limit'), '5000');
  });

  it('excludes an Astemir-related identity mismatch and reports it for review', async () => {
    respond(payload({ rows: [document({ manager_ref: 'other', manager_name: 'Другой', author_manager_match: false })] }));
    const result = await getPayrollPurchaseAttribution('2026-08-01', '2026-08-31');
    assert.equal(result.ok, true);
    assert.equal(result.data?.documentCount, 0);
    assert.equal(result.data?.reviewDocumentCount, 1);
    assert.deepEqual(result.data?.settlements, []);
  });

  for (const [name, body] of Object.entries({
    partial: payload({ complete: false }),
    payrollAffecting: payload({ affects_payroll: true }),
    writeCapable: payload({ write_operations: true }),
    wrongContract: payload({ contract_version: 'different' }),
    missingRows: payload({ rows: null }),
  })) {
    it(`rejects unsafe ${name} response without partial totals`, async () => {
      respond(body);
      const result = await getPayrollPurchaseAttribution('2026-08-01', '2026-08-31');
      assert.equal(result.ok, false);
      assert.equal(result.data, null);
    });
  }

  it('rejects a duplicate document and identity-name drift', async () => {
    const first = document();
    for (const rows of [
      [first, { ...first }],
      [document({ author_name: 'Неизвестный сотрудник' })],
    ]) {
      respond(payload({ rows }));
      const result = await getPayrollPurchaseAttribution('2026-08-01', '2026-08-31');
      assert.equal(result.ok, false);
      assert.equal(result.data, null);
    }
  });
});
