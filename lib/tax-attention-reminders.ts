import type { PortalReport } from './ausn-portal-view';
import { limitOutlook } from './ausn-limit-outlook';
import { plainReportReason } from './tax-health';

// Pure builders for the two reminders that make the taxes section self-reporting:
// stale or unavailable figures, and the limit decision date. One event per state,
// so Telegram gets one message per situation, not one per day.
export type TaxReminder = { eventKey: string; type: string; sourceType: string; title: string; body: string };

const staleHours = 26; // daily refresh at 07:40 plus two hours of slack
const ruDate = (value?: string) => value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—';
const mln = (value?: number) => value === undefined ? '—' : `${(value / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} млн ₽`;
const moscowDay = (now: Date) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now);

export function taxFreshnessReminder(reports: PortalReport[], now: Date): TaxReminder | undefined {
  const usable = reports.filter((report) => report.available).sort((a, b) => Date.parse(b.runTimeUtc!) - Date.parse(a.runTimeUtc!));
  const latest = usable[0];
  if (!latest) {
    const newest = reports[0];
    return { eventKey: `tax_figures_unavailable:${newest?.sourceFile || moscowDay(now)}`, type: 'tax.figures_stale', sourceType: 'tax_freshness', title: 'Расчёт по налогам недоступен', body: `${plainReportReason(newest?.reason)} Откройте раздел «Налоги» и нажмите «Обновить цифры сейчас». Если не поможет — сообщите разработчику.` };
  }
  if (now.getTime() - Date.parse(latest.runTimeUtc!) <= staleHours * 3_600_000) return undefined;
  return { eventKey: `tax_figures_stale:${latest.sourceFile}`, type: 'tax.figures_stale', sourceType: 'tax_freshness', title: 'Цифры по налогам не обновились', body: `Последние данные — по ${ruDate(latest.dataCutoff)}. Утренний пересчёт не сработал, лимит может быть ближе, чем показано. Откройте «Налоги» и нажмите «Обновить цифры сейчас»; если не поможет — сообщите разработчику.` };
}

export function taxDecisionReminder(full: PortalReport | undefined, now: Date, leadDays = 14): TaxReminder | undefined {
  const today = moscowDay(now);
  const outlook = limitOutlook(full, today);
  if (!outlook || outlook.state === 'enough' || !full?.year) return undefined;
  const base = { type: 'tax.limit_decision', sourceType: 'tax_limit_decision' };
  if (outlook.state === 'exceeded') return { ...base, eventKey: `tax_limit_decision:${full.year}:exceeded`, title: 'Лимит АУСН превышен', body: 'Срочно к бухгалтеру: до 15 числа следующего месяца нужно уведомить налоговую и выбрать режим.' };
  const tail = `Лимит может закончиться около ${ruDate(outlook.cautious.date)}.${outlook.safeMonthly !== undefined ? ` Чтобы дотянуть до 31 декабря — не больше ${mln(outlook.safeMonthly)} дохода в месяц.` : ''}`;
  if (outlook.state === 'decide_now') return { ...base, eventKey: `tax_limit_decision:${full.year}:now`, title: 'Решение по лимиту АУСН нужно сейчас', body: tail };
  const daysLeft = Math.round((Date.parse(`${outlook.decisionDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (daysLeft > leadDays) return undefined;
  return { ...base, eventKey: `tax_limit_decision:${full.year}:by`, title: `Решение по лимиту АУСН нужно до ${ruDate(outlook.decisionDate)}`, body: tail };
}
