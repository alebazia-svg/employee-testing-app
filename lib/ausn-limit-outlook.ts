import type { PortalReport } from './ausn-portal-view';
import { portalForecast } from './ausn-portal-view';
import { limitScenario } from './ausn-limit-scenario';

// Two paces instead of one: the usual one (average of the last three full months)
// and a cautious one (the strongest full month this year), because a linear
// average underestimates the November–December peak. The decision date is when
// the cautious pace reaches the 45-day "plan needed" threshold.
export type LimitOutlook = {
  state: 'exceeded' | 'decide_now' | 'decide_by' | 'enough';
  remaining: number;
  cutoff: string;
  year: string;
  usual: { monthly: number; date?: string; withinYear: boolean; months: string[] };
  cautious: { monthly: number; date?: string; withinYear: boolean; month: string };
  decisionDate?: string;
  safeMonthly?: number;
};

const planDays = 45;
const addDays = (date: string, days: number) => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

export function limitOutlook(report: PortalReport | undefined, today: string): LimitOutlook | undefined {
  const forecast = portalForecast(report);
  if (!report?.available || report.remaining === undefined || !report.dataCutoff || !report.year) return undefined;
  const { remaining, dataCutoff: cutoff, year } = report;
  if (remaining <= 0) return { state: 'exceeded', remaining, cutoff, year, usual: { monthly: 0, withinYear: true, months: [] }, cautious: { monthly: 0, withinYear: true, month: '' } };
  if (!forecast) return undefined;
  const full = report.monthlyIncome.filter((month) => !month.partial && month.periodKey.startsWith(`${year}-`));
  const best = full.reduce((top, month) => month.amount > top.amount ? month : top, full[0]);
  const cautiousMonthly = Math.max(best?.amount ?? 0, forecast.average);
  const usual = limitScenario({ remaining, cutoff, year, monthly: forecast.average });
  const cautious = limitScenario({ remaining, cutoff, year, monthly: cautiousMonthly });
  const decisionDate = cautious.withinYear && cautious.date ? addDays(cautious.date, -planDays) : undefined;
  const state = !cautious.withinYear ? 'enough' : decisionDate && decisionDate <= today ? 'decide_now' : 'decide_by';
  return {
    state, remaining, cutoff, year, decisionDate, safeMonthly: usual.safeMonthly,
    usual: { monthly: forecast.average, date: usual.date, withinYear: usual.withinYear, months: forecast.months },
    cautious: { monthly: cautiousMonthly, date: cautious.date, withinYear: cautious.withinYear, month: best?.amount && best.amount >= forecast.average ? best.periodKey : '' },
  };
}
