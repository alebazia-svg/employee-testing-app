import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProcurementCashForecast, type ForecastEvent } from '../lib/procurement-cash-forecast';

const position = (bucketId: string, balanceMinor: number, currency = 'RUB') => ({
  bucketId, currency, balanceMinor, observedOn: '2026-09-12', verified: true,
});
const event = (partial: Partial<ForecastEvent> = {}): ForecastEvent => ({
  id: 'plan-1', source: 'supplier_payment_plan', dueOn: '2026-09-13',
  bucketId: 'safe', currency: 'RUB', amountMinor: 70_000_00,
  direction: 'out', certainty: 'proposed', ...partial,
});

test('separates agreed payments from proposals and never funds them with speculative receipts', () => {
  const result = buildProcurementCashForecast({
    asOf: '2026-09-12', positions: [position('safe', 50_000_00)], sourcesComplete: true,
    events: [
      event({ id: 'agreed', amountMinor: 20_000_00, certainty: 'confirmed' }),
      event({ id: 'proposed', amountMinor: 70_000_00 }),
      event({ id: 'possible-income', direction: 'in', certainty: 'proposed', amountMinor: 100_000_00 }),
    ],
  });
  const day = result.buckets[0].days[0];
  assert.equal(day.confirmedClosingMinor, 30_000_00);
  assert.equal(day.confirmedShortfallMinor, 0);
  assert.equal(day.proposedShortfallMinor, 40_000_00);
  assert.equal(day.proposedInMinor, 100_000_00);
  assert.equal(result.buckets[0].days.length, 30);
  assert.equal(result.startsOn, '2026-09-13');
  assert.equal(result.through, '2026-10-12');
  assert.equal(result.forecastReady, false);
});

test('does not pool safe money with bank, accountable funds or USDT', () => {
  const result = buildProcurementCashForecast({
    asOf: '2026-09-12', sourcesComplete: true,
    positions: [position('safe', 0), position('bank', 100_000_00), position('wallet', 9_000_00, 'USDT')],
    events: [event({ amountMinor: 70_000_00 })],
  });
  assert.equal(result.buckets.find((bucket) => bucket.bucketId === 'safe')!.days[0].proposedShortfallMinor, 70_000_00);
  assert.equal(result.buckets.find((bucket) => bucket.bucketId === 'bank')!.days[0].confirmedClosingMinor, 100_000_00);
  assert.equal(result.buckets.find((bucket) => bucket.bucketId === 'wallet')!.days[0].confirmedClosingMinor, 9_000_00);
});

test('an unused employee portal produces an honest empty calendar, not invented payments', () => {
  const result = buildProcurementCashForecast({
    asOf: '2026-09-12', positions: [position('safe', 250_000_00)],
    events: [], sourcesComplete: false,
  });
  assert.equal(result.unplacedEvents.length, 0);
  assert.equal(result.buckets[0].days.length, 30);
  assert.ok(result.buckets[0].days.every((day) => day.confirmedOutMinor === 0 && day.proposedOutMinor === 0));
  assert.ok(result.buckets[0].days.every((day) => day.confirmedClosingMinor === 250_000_00));
  assert.equal(result.scenarioInputComplete, false);
  assert.equal(result.forecastReady, false);
});

test('undated debts and unknown funding method stay visible but outside the day arithmetic', () => {
  const result = buildProcurementCashForecast({
    asOf: '2026-09-12', positions: [position('safe', 50_000_00)], sourcesComplete: false,
    events: [
      event({ id: 'supplier-debt', source: 'supplier_settlement', dueOn: null }),
      event({ id: 'unknown-method', bucketId: null }),
      event({ id: 'already-today', dueOn: '2026-09-12' }),
    ],
  });
  assert.deepEqual(result.unplacedEvents, [
    { id: 'supplier-debt', reason: 'date_unknown' },
    { id: 'unknown-method', reason: 'funding_bucket_unknown' },
    { id: 'already-today', reason: 'overdue' },
  ]);
  assert.equal(result.buckets[0].days[0].confirmedClosingMinor, 50_000_00);
  assert.equal(result.scenarioInputComplete, false);
});

test('rejects duplicate movements, invalid amounts and stale cash positions', () => {
  const input = { asOf: '2026-09-12', positions: [position('safe', 0)],
    events: [event()], sourcesComplete: true };
  assert.throws(() => buildProcurementCashForecast({ ...input, events: [event(), event()] }), /FORECAST_DUPLICATE_EVENT/);
  assert.throws(() => buildProcurementCashForecast({ ...input, events: [event({ amountMinor: 1.2 })] }), /FORECAST_INVALID_AMOUNT/);
  assert.throws(() => buildProcurementCashForecast({ ...input, positions: [position('safe', 0), position('safe', 0)] }), /FORECAST_DUPLICATE_BUCKET/);
  const stale = buildProcurementCashForecast({ ...input, positions: [{ ...position('safe', 0), observedOn: '2026-09-11' }] });
  assert.equal(stale.scenarioInputComplete, false);
  assert.ok(stale.limitations.includes('money_position_not_verified_today'));
});
