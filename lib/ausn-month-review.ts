import type { PortalMonthDetail, PortalReport } from './ausn-portal-view';
import type { TaxPeriodPlan } from './tax-document-plan';

// Presentation layer over runner values. It compares figures the runner already
// printed for the same month; it never recalculates a tax base or a tax amount.
export type CheckState = 'ok' | 'diff' | 'missing' | 'not_due' | 'unknown';
export type MonthCheck = { key: 'fns' | 'ens' | 'payment' | 'documents'; label: string; state: CheckState; value?: string; note?: string };
export type MonthState = 'ok' | 'attention' | 'waiting' | 'open';
export type MonthReview = { periodKey: string; detail?: PortalMonthDetail; partial: boolean; state: MonthState; checks: MonthCheck[] };
export type ReviewIssue = { periodKey: string; severity: 'high' | 'medium' | 'low'; kind: MonthCheck['key'] | 'refunds' | 'missing_data'; title: string; text: string; action?: string; amount?: number; uploadHint?: boolean };

const tolerance = 1;
const rub = (value?: number) => value === undefined ? '—' : `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : ''}${rub(Math.abs(value))}`;
export const reviewMonthTitle = (key: string) => { const text = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)).replace(/ г\.$/, ''); return text.charAt(0).toUpperCase() + text.slice(1); };
const monthWord = (key: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`));
const nextMonthDay = (key: string, day: number) => { const [year, month] = key.split('-').map(Number); return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10); };

export function reviewMonths(input: { report?: PortalReport; plan: TaxPeriodPlan[]; today: string }): MonthReview[] {
  const { report, plan, today } = input;
  if (!report?.available) return [];
  const details = new Map(report.monthDetails.map((detail) => [detail.periodKey, detail]));
  const keys = [...new Set([...report.monthlyIncome.map((month) => month.periodKey), ...report.monthDetails.map((detail) => detail.periodKey)])].sort();
  return keys.map((periodKey) => {
    const detail = details.get(periodKey);
    const partial = Boolean(report.monthlyIncome.find((month) => month.periodKey === periodKey)?.partial) || periodKey === report.dataCutoff?.slice(0, 7);
    const ensDue = today >= nextMonthDay(periodKey, 16);
    const paymentDue = today > nextMonthDay(periodKey, 25);
    const checks: MonthCheck[] = [];
    // ЛК ФНС: the runner prints accepted base and the difference for covered months.
    if (detail?.fnsAccepted !== undefined) {
      const difference = detail.fnsDifference;
      checks.push({ key: 'fns', label: 'Налоговая учла доход', state: partial ? 'not_due' : difference === undefined ? 'unknown' : Math.abs(difference) <= tolerance ? 'ok' : 'diff', value: rub(detail.fnsAccepted), note: partial ? 'месяц не закончился' : difference !== undefined && Math.abs(difference) > tolerance ? `разница ${signed(difference)}` : undefined });
    } else checks.push({ key: 'fns', label: 'Налоговая учла доход', state: partial || !ensDue ? 'not_due' : 'missing' });
    if (detail?.fnsAssessedState === 'loaded' && detail.fnsAssessed !== undefined) {
      const difference = detail.tax !== undefined ? Math.round((detail.tax - detail.fnsAssessed) * 100) / 100 : undefined;
      checks.push({ key: 'ens', label: 'Налоговая начислила', state: difference === undefined ? 'unknown' : Math.abs(difference) <= tolerance ? 'ok' : 'diff', value: rub(detail.fnsAssessed), note: difference !== undefined && Math.abs(difference) > tolerance ? `по нашему расчёту ${rub(detail.tax)}` : undefined });
    } else checks.push({ key: 'ens', label: 'Налоговая начислила', state: partial || !ensDue ? 'not_due' : detail?.fnsAssessedState === 'not_loaded' || !detail?.fnsAccepted ? 'missing' : 'unknown' });
    if (detail?.enpPaymentState === 'found' && detail.enpPayment !== undefined) {
      const difference = detail.tax !== undefined ? Math.round((detail.enpPayment - detail.tax) * 100) / 100 : undefined;
      checks.push({ key: 'payment', label: 'Оплачено', state: difference === undefined ? 'unknown' : Math.abs(difference) <= tolerance ? 'ok' : 'diff', value: rub(detail.enpPayment), note: difference !== undefined && Math.abs(difference) > tolerance ? `${difference < 0 ? 'недоплата' : 'переплата'} ${rub(Math.abs(difference))}` : undefined });
    } else checks.push({ key: 'payment', label: 'Оплачено', state: !paymentDue ? 'not_due' : 'unknown', note: !paymentDue ? `срок до ${nextMonthDay(periodKey, 25).split('-').reverse().slice(0, 2).join('.')}` : 'в годовом расчёте не сверяется' });
    const documents = plan.find((period) => period.periodKey === periodKey);
    checks.push({ key: 'documents', label: 'Документы', state: !documents ? 'not_due' : documents.status === 'complete' ? 'ok' : 'missing', value: documents ? `${documents.present.length} из ${documents.present.length + documents.missing.length}` : undefined, note: documents?.missing.length ? `не хватает ${documents.missing.length}` : undefined });
    const state: MonthState = partial ? 'open' : checks.some((check) => check.state === 'diff') ? 'attention' : checks.some((check) => check.state === 'missing') ? 'waiting' : checks.every((check) => check.state === 'ok' || check.state === 'not_due' || check.state === 'unknown') ? 'ok' : 'waiting';
    return { periodKey, detail, partial, state, checks };
  });
}

export function reviewIssues(input: { report?: PortalReport; months: MonthReview[] }): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  for (const month of input.months) {
    const title = reviewMonthTitle(month.periodKey);
    const detail = month.detail;
    for (const check of month.checks) {
      if (check.key === 'fns' && check.state === 'diff' && detail?.fnsDifference !== undefined) issues.push({ periodKey: month.periodKey, severity: 'high', kind: 'fns', amount: Math.abs(detail.fnsDifference), title: `${title}: налоговая учла на ${rub(Math.abs(detail.fnsDifference))} ${detail.fnsDifference > 0 ? 'меньше' : 'больше'}`, text: `По нашему учёту (1С, банк, касса) ${rub(detail.base)}, налоговая учла ${rub(detail.fnsAccepted)}.`, action: detail.fnsDifference > 0 ? 'Сначала загрузите свежую выгрузку «Доходы АУСН» из налоговой: часть операций налоговая учитывает с опозданием. Если разница останется — скорее всего, какой-то чек кассы не дошёл до налоговой или попал в другой месяц. Скачайте в личном кабинете налоговой детализацию по кассе (ККТ) за этот месяц и загрузите — по ней будет видно, какого чека не хватает.' : 'Налоговая учла больше, чем у нас: проверьте возвраты и исправления за месяц и загрузите подтверждающие документы в «Корректировки и возвраты».' });
      if (check.key === 'ens' && check.state === 'diff' && detail?.fnsAssessed !== undefined && detail.tax !== undefined) issues.push({ periodKey: month.periodKey, severity: 'high', kind: 'ens', amount: Math.abs(detail.tax - detail.fnsAssessed), title: `${title}: налоговая начислила на ${rub(Math.abs(detail.tax - detail.fnsAssessed))} ${detail.tax > detail.fnsAssessed ? 'меньше' : 'больше'}`, text: `Налоговая начислила ${rub(detail.fnsAssessed)}, по нашему расчёту ${rub(detail.tax)}. Налоговая считает 8% от того дохода, который она учла.`, action: 'Сначала разберитесь с разницей по доходу за этот месяц — после неё обычно сходится и налог.' });
      if (check.key === 'payment' && check.state === 'diff' && detail?.enpPayment !== undefined && detail.tax !== undefined) { const difference = detail.enpPayment - detail.tax; issues.push({ periodKey: month.periodKey, severity: difference < 0 ? 'high' : 'medium', kind: 'payment', amount: Math.abs(difference), title: `${title}: ${difference < 0 ? 'недоплачено' : 'переплачено'} ${rub(Math.abs(difference))}`, text: `Оплачено из банка ${rub(detail.enpPayment)}, налог по нашему расчёту ${rub(detail.tax)}.`, action: difference < 0 ? 'Проверьте в личном кабинете налоговой раздел «Единый налоговый счёт»: если долг есть, доплатите, чтобы не начислили пени.' : 'Переплата останется на едином налоговом счёте и зачтётся в следующем месяце — делать ничего не нужно.' }); }
    }
  }
  const missingFns = input.months.filter((month) => month.checks.some((check) => check.key === 'fns' && check.state === 'missing')).map((month) => month.periodKey);
  if (missingFns.length) issues.push({ periodKey: missingFns.at(-1)!, severity: 'medium', kind: 'fns', title: `Нет доходов из налоговой за ${missingFns.map(monthWord).join(', ')}`, text: 'Без них нельзя проверить, совпадает ли наш доход с тем, что учла налоговая.', action: 'Личный кабинет налоговой → АУСН → Доходы: скачайте Excel за весь год и загрузите — один файл закрывает все месяцы.', uploadHint: true });
  const missingEns = input.months.filter((month) => month.checks.some((check) => check.key === 'ens' && check.state === 'missing')).map((month) => month.periodKey);
  if (missingEns.length) issues.push({ periodKey: missingEns.at(-1)!, severity: 'medium', kind: 'ens', title: `Нет начислений налога за ${missingEns.map(monthWord).join(', ')}`, text: 'Сервер видит только последнюю загруженную выгрузку ЕНС, поэтому нужна одна выгрузка за весь год.', action: 'Личный кабинет налоговой → Единый налоговый счёт → Операции: выгрузка с 1 января по сегодня, ZIP.', uploadHint: true });
  const refunds = input.report?.attention.find((item) => /^Возвраты OFD/.test(item));
  if (refunds) issues.push({ periodKey: '', severity: 'low', kind: 'refunds', title: refunds.replace(/^Возвраты OFD/, 'Возвраты по кассе').replace(/\. Автоматически.*$/, ''), text: 'Возвраты покупателям сами по себе доход не уменьшают.', action: 'Если возврат настоящий, загрузите подтверждение в «Корректировки и возвраты».' });
  const order = { high: 0, medium: 1, low: 2 } as const;
  return issues.sort((a, b) => order[a.severity] - order[b.severity] || (b.amount ?? 0) - (a.amount ?? 0) || a.periodKey.localeCompare(b.periodKey));
}

// What changed between two canonical runs of the same scope (shown after an upload).
export function reportChanges(before: PortalReport | undefined, after: PortalReport | undefined): string[] {
  if (!after?.available) return [];
  if (!before?.available) return ['Получен первый полный расчёт АУСН.'];
  const changes: string[] = [];
  const old = new Map(before.monthDetails.map((detail) => [detail.periodKey, detail]));
  for (const detail of after.monthDetails) {
    const prior = old.get(detail.periodKey);
    const title = reviewMonthTitle(detail.periodKey);
    if (prior?.fnsAccepted === undefined && detail.fnsAccepted !== undefined) changes.push(`${title}: налоговая учла доход ${rub(detail.fnsAccepted)}${detail.fnsDifference !== undefined && Math.abs(detail.fnsDifference) > tolerance ? `, разница ${signed(detail.fnsDifference)}` : ', совпадает с расчётом'}.`);
    else if (prior?.fnsDifference !== undefined && detail.fnsDifference !== undefined && Math.abs(prior.fnsDifference - detail.fnsDifference) > 0.009) changes.push(`${title}: разница с налоговой ${signed(prior.fnsDifference)} → ${signed(detail.fnsDifference)}.`);
    if (prior?.fnsAssessedState !== 'loaded' && detail.fnsAssessedState === 'loaded') changes.push(`${title}: налоговая начислила ${rub(detail.fnsAssessed)}.`);
    if (prior?.enpPaymentState !== 'found' && detail.enpPaymentState === 'found') changes.push(`${title}: найдена оплата налога — ${rub(detail.enpPayment)}.`);
    if (prior?.base !== undefined && detail.base !== undefined && Math.abs(prior.base - detail.base) > 0.009) changes.push(`${title}: доход ${rub(prior.base)} → ${rub(detail.base)}.`);
  }
  if (before.fnsCoverage?.to !== after.fnsCoverage?.to && after.fnsCoverage) changes.push(`Данные налоговой о доходе теперь есть по ${after.fnsCoverage.to.split('-').reverse().join('.')}.`);
  if (!changes.length) changes.push('Цифры не изменились: документ сохранён и подтверждает уже учтённые данные.');
  return changes;
}
