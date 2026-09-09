import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { getPayrollOneCCloseState } from '../lib/payroll-one-c-control-source';

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

const requiredOperations = [
  'Формирование движений по расчетам с партнерами и переоценка расчетов',
  'Переоценка денежных средств и финансовых инструментов',
  'Распределение затрат и расчет себестоимости',
  'Оформление документов распределения расходов',
  'Распределение расходов по направлениям деятельности',
  'Распределение доходов по направлениям деятельности',
  'Формирование движений по НДС',
];

function operation(name: string, date = '08.09.2026', overrides: Record<string, unknown> = {}) {
  return {
    operation: name,
    running: false,
    had_errors: false,
    start_time: `${date} 21:30:00`,
    end_time: `${date} 21:35:00`,
    ...overrides,
  };
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    execution_register: requiredOperations.map((name) => operation(name)),
    cost_calculation_documents: [{
      number: 'OF-00000009',
      posted: true,
      deletion_mark: false,
      preliminary: false,
    }],
    ...overrides,
  };
}

function respond(body: unknown) {
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(init?.method, 'GET');
    assert.equal(new URL(String(input)).pathname, '/month-close-execution-state');
    return Response.json(body);
  }) as typeof fetch;
}

describe('1C payroll close readiness', () => {
  it('accepts an older completed auxiliary stage when cost calculation is current', async () => {
    respond(payload({
      execution_register: requiredOperations.map((name) => operation(
        name,
        name === 'Оформление документов распределения расходов' ? '04.09.2026' : '08.09.2026',
      )),
    }));

    const result = await getPayrollOneCCloseState('2026-09-08');

    assert.equal(result.ok, true);
    assert.equal(result.data?.ready, true);
    assert.equal(result.data?.executionDate, '08.09.2026');
    assert.deepEqual(result.data?.blockingIssues, []);
  });

  it('reports the latest cost-calculation date so the route can fall back to that closed day', async () => {
    respond(payload({
      execution_register: requiredOperations.map((name) => operation(
        name,
        name === 'Оформление документов распределения расходов' ? '04.09.2026' : '08.09.2026',
      )),
    }));

    const result = await getPayrollOneCCloseState('2026-09-09');

    assert.equal(result.data?.ready, false);
    assert.equal(result.data?.executionDate, '08.09.2026');
    assert.deepEqual(result.data?.blockingIssues, ['Последнее закрытие выполнено не за выбранную дату.']);
  });

  it('does not treat a newer auxiliary stage as a newer cost calculation', async () => {
    respond(payload({
      execution_register: requiredOperations.map((name) => operation(
        name,
        name === 'Распределение затрат и расчет себестоимости' ? '07.09.2026' : '08.09.2026',
      )),
    }));

    const result = await getPayrollOneCCloseState('2026-09-08');

    assert.equal(result.data?.ready, false);
    assert.equal(result.data?.executionDate, '07.09.2026');
  });

  it('still fails closed for an operation error or missing final cost document', async () => {
    respond(payload({
      execution_register: requiredOperations.map((name) => operation(
        name,
        '08.09.2026',
        name === 'Распределение расходов по направлениям деятельности' ? { had_errors: true } : {},
      )),
      cost_calculation_documents: [],
    }));

    const result = await getPayrollOneCCloseState('2026-09-08');

    assert.equal(result.data?.ready, false);
    assert.ok(result.data?.blockingIssues.some((issue) => issue.includes('ошибкой')));
    assert.ok(result.data?.blockingIssues.some((issue) => issue.includes('Нет проведённого итогового документа')));
  });
});
