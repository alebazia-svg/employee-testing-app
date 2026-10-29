// Portal-only "what if" projection of the annual AUSN limit. It reuses the same
// pace convention as portalForecast (monthly amount / 30 per day, counted from
// the report data cutoff) and never produces or changes a tax total.
export type LimitScenarioMonth = { periodKey: string; days: number; income: number; leftAfter: number; crosses: boolean; partial: boolean };
export type LimitScenario = { monthly: number; days?: number; date?: string; withinYear: boolean; months: LimitScenarioMonth[]; safeMonthly?: number };

const dayMs = 86_400_000;
const utc = (value: string) => Date.parse(`${value}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

export function limitScenario(input: { remaining: number; cutoff: string; year: string; monthly: number }): LimitScenario {
  const { remaining, cutoff, year } = input;
  const monthly = Math.max(0, input.monthly);
  const cutoffTime = utc(cutoff);
  const yearEnd = utc(`${year}-12-31`);
  if (!Number.isFinite(cutoffTime) || !Number.isFinite(remaining) || remaining <= 0 || cutoffTime >= yearEnd) return { monthly, withinYear: false, months: [] };
  const daily = monthly / 30;
  const days = daily > 0 ? Math.ceil(remaining / daily) : undefined;
  const date = days !== undefined ? iso(cutoffTime + days * dayMs) : undefined;
  const months: LimitScenarioMonth[] = [];
  let left = remaining;
  let crossed = false;
  // Walk the rest of the year month by month starting the day after the cutoff.
  for (let start = cutoffTime + dayMs; start <= yearEnd;) {
    const d = new Date(start);
    const monthEnd = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0);
    const count = Math.round((monthEnd - start) / dayMs) + 1;
    const income = daily * count;
    const leftAfter = left - income;
    const crosses = !crossed && leftAfter < 0;
    if (crosses) crossed = true;
    months.push({ periodKey: iso(start).slice(0, 7), days: count, income, leftAfter, crosses, partial: d.getUTCDate() !== 1 });
    left = leftAfter;
    start = monthEnd + dayMs;
  }
  const daysToYearEnd = Math.round((yearEnd - cutoffTime) / dayMs);
  return { monthly, days, date, withinYear: Boolean(date && date.slice(0, 4) === year), months, safeMonthly: daysToYearEnd > 0 ? (remaining / daysToYearEnd) * 30 : undefined };
}
