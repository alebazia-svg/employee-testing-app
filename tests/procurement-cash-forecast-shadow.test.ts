import assert from 'node:assert/strict';
import test from 'node:test';
import { buildOwnerCashForecastShadow } from '../lib/procurement-cash-forecast-shadow';
import type { OwnerMoneySource } from '../lib/procurement-cash-forecast-source';

const money: OwnerMoneySource = {
  positions: [{ bucketId: 'onec:safe', currency: 'RUB', balanceMinor: 120_000_00,
    observedOn: '2026-09-12', verified: true }],
  complete: true, warnings: [], accountNames: ['Сейф Депозитный'], currencyAssumedRubles: true,
};

test('no Astemir plans means no fabricated payments or invented cash gap', () => {
  const result = buildOwnerCashForecastShadow({ asOf: '2026-09-12', money, plans: [] });
  assert.equal(result.activePlanCount, 0);
  assert.equal(result.forecast.unplacedEvents.length, 0);
  assert.ok(result.forecast.buckets[0].days.every((day) => day.confirmedOutMinor === 0));
  assert.equal(result.forecast.forecastReady, false);
});

test('future plans remain visible but do not debit a guessed card or safe', () => {
  const result = buildOwnerCashForecastShadow({
    asOf: '2026-09-12', money,
    plans: [
      { id: 'new-1', status: 'SUBMITTED', plannedDate: '2026-09-14', plannedAmountRub: '700000.00' },
      { id: 'cancelled-1', status: 'CANCELLED', plannedDate: '2026-09-15', plannedAmountRub: '500.00' },
    ],
  });
  assert.equal(result.activePlanCount, 1);
  assert.deepEqual(result.forecast.unplacedEvents, [
    { id: 'supplier-plan:new-1', reason: 'funding_bucket_unknown' },
  ]);
  assert.ok(result.forecast.buckets[0].days.every((day) => day.confirmedClosingMinor === 120_000_00));
  assert.equal(result.forecast.scenarioInputComplete, false);
});

test('unknown statuses and invalid monetary strings fail closed', () => {
  assert.throws(() => buildOwnerCashForecastShadow({ asOf: '2026-09-12', money,
    plans: [{ id: 'bad', status: 'PAID', plannedDate: '2026-09-14', plannedAmountRub: '100.00' }],
  }), /FORECAST_UNKNOWN_PLAN_STATUS/);
  assert.throws(() => buildOwnerCashForecastShadow({ asOf: '2026-09-12', money,
    plans: [{ id: 'bad', status: 'APPROVED', plannedDate: '2026-09-14', plannedAmountRub: '100.001' }],
  }), /FORECAST_INVALID_PLAN_AMOUNT/);
});
