/**
 * Pure, read-only 30-day cash scenario. All amounts are integer minor units.
 * This deliberately does not infer future receipts from historical turnover,
 * net different currencies, or move money between bank/cash buckets.
 */

export type ForecastCertainty = "confirmed" | "proposed";
export type ForecastDirection = "in" | "out";

export type ForecastPosition = {
  bucketId: string;
  currency: string;
  balanceMinor: number;
  observedOn: string;
  verified: boolean;
};

export type ForecastEvent = {
  id: string;
  source: string;
  dueOn: string | null;
  bucketId: string | null;
  currency: string;
  amountMinor: number;
  direction: ForecastDirection;
  certainty: ForecastCertainty;
};

export type ForecastDay = {
  date: string;
  openingMinor: number;
  confirmedInMinor: number;
  confirmedOutMinor: number;
  proposedInMinor: number;
  proposedOutMinor: number;
  confirmedClosingMinor: number;
  withoutProposedIncomeMinor: number;
  confirmedShortfallMinor: number;
  proposedShortfallMinor: number;
};

export type ForecastBucket = {
  bucketId: string;
  currency: string;
  observedOn: string;
  verified: boolean;
  days: ForecastDay[];
};

export type CashForecast = {
  asOf: string;
  startsOn: string;
  through: string;
  buckets: ForecastBucket[];
  unplacedEvents: { id: string; reason: string }[];
  scenarioInputComplete: boolean;
  forecastReady: false;
  limitations: string[];
};

function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("FORECAST_INVALID_DATE");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("FORECAST_INVALID_DATE");
  }
  return date;
}

function plusDays(value: string, days: number): string {
  const date = calendarDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function minor(value: number, signed = false): number {
  if (!Number.isSafeInteger(value) || (!signed && value < 0)) throw new Error("FORECAST_INVALID_AMOUNT");
  return value;
}

function safeAdd(left: number, right: number): number {
  const value = left + right;
  if (!Number.isSafeInteger(value)) throw new Error("FORECAST_AMOUNT_OVERFLOW");
  return value;
}

function identity(bucketId: string, currency: string): string {
  return `${bucketId}\u0000${currency}`;
}

export function buildProcurementCashForecast(input: {
  asOf: string;
  positions: ForecastPosition[];
  events: ForecastEvent[];
  sourcesComplete: boolean;
  horizonDays?: number;
}): CashForecast {
  calendarDate(input.asOf);
  const horizon = input.horizonDays ?? 30;
  if (!Number.isInteger(horizon) || horizon < 1 || horizon > 30) {
    throw new Error("FORECAST_INVALID_HORIZON");
  }
  // Positions are 1C closing balances at the end of asOf. Beginning on asOf
  // would count same-day movements a second time.
  const startsOn = plusDays(input.asOf, 1);
  const through = plusDays(input.asOf, horizon);
  const positions = new Map<string, ForecastPosition>();
  for (const position of input.positions) {
    if (!position.bucketId || !position.currency) throw new Error("FORECAST_INVALID_BUCKET");
    minor(position.balanceMinor, true);
    calendarDate(position.observedOn);
    const key = identity(position.bucketId, position.currency);
    if (positions.has(key)) throw new Error("FORECAST_DUPLICATE_BUCKET");
    positions.set(key, position);
  }

  const events = new Map<string, ForecastEvent[]>();
  const unplacedEvents: CashForecast["unplacedEvents"] = [];
  const seenIds = new Set<string>();
  for (const event of input.events) {
    if (!event.id || seenIds.has(event.id)) throw new Error("FORECAST_DUPLICATE_EVENT");
    seenIds.add(event.id);
    minor(event.amountMinor);
    if (!event.amountMinor || !event.currency || !event.source ||
      !["confirmed", "proposed"].includes(event.certainty) ||
      !["in", "out"].includes(event.direction)) {
      throw new Error("FORECAST_INVALID_EVENT");
    }
    if (!event.dueOn) {
      unplacedEvents.push({ id: event.id, reason: "date_unknown" });
      continue;
    }
    calendarDate(event.dueOn);
    if (event.dueOn < startsOn) {
      unplacedEvents.push({ id: event.id, reason: "overdue" });
      continue;
    }
    if (event.dueOn > through) {
      unplacedEvents.push({ id: event.id, reason: "outside_horizon" });
      continue;
    }
    if (!event.bucketId || !positions.has(identity(event.bucketId, event.currency))) {
      unplacedEvents.push({ id: event.id, reason: "funding_bucket_unknown" });
      continue;
    }
    const key = `${identity(event.bucketId, event.currency)}\u0000${event.dueOn}`;
    events.set(key, [...(events.get(key) || []), event]);
  }

  const buckets = [...positions.values()].map((position) => {
    let confirmed = position.balanceMinor;
    let withoutProposedIncome = position.balanceMinor;
    const days: ForecastDay[] = [];
    for (let offset = 0; offset < horizon; offset += 1) {
      const date = plusDays(startsOn, offset);
      const todays = events.get(`${identity(position.bucketId, position.currency)}\u0000${date}`) || [];
      const sum = (direction: ForecastDirection, certainty: ForecastCertainty) =>
        todays.filter((event) => event.direction === direction && event.certainty === certainty)
          .reduce((total, event) => safeAdd(total, event.amountMinor), 0);
      const confirmedInMinor = sum("in", "confirmed");
      const confirmedOutMinor = sum("out", "confirmed");
      const proposedInMinor = sum("in", "proposed");
      const proposedOutMinor = sum("out", "proposed");
      const openingMinor = confirmed;
      confirmed = safeAdd(safeAdd(confirmed, confirmedInMinor), -confirmedOutMinor);
      // Proposed income is never used to declare that a payment is funded.
      withoutProposedIncome = safeAdd(
        safeAdd(safeAdd(withoutProposedIncome, confirmedInMinor), -confirmedOutMinor),
        -proposedOutMinor,
      );
      days.push({
        date, openingMinor, confirmedInMinor, confirmedOutMinor,
        proposedInMinor, proposedOutMinor,
        confirmedClosingMinor: confirmed,
        withoutProposedIncomeMinor: withoutProposedIncome,
        confirmedShortfallMinor: Math.max(0, -confirmed),
        proposedShortfallMinor: Math.max(0, -withoutProposedIncome),
      });
    }
    return { bucketId: position.bucketId, currency: position.currency,
      observedOn: position.observedOn, verified: position.verified, days };
  });

  const limitations: string[] = [];
  if (!input.sourcesComplete) limitations.push("source_incomplete");
  if (!buckets.length) limitations.push("no_money_positions");
  if (buckets.some((bucket) => !bucket.verified || bucket.observedOn !== input.asOf)) {
    limitations.push("money_position_not_verified_today");
  }
  if (unplacedEvents.length) limitations.push("events_not_placed");
  limitations.push("future_unconfirmed_income_excluded");
  return { asOf: input.asOf, startsOn, through, buckets, unplacedEvents,
    scenarioInputComplete: !limitations.some((value) => value !== "future_unconfirmed_income_excluded"),
    forecastReady: false,
    limitations };
}
