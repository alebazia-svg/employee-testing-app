import type { PortalReport } from './ausn-portal-view';
import { managementTotals, type TaxManagementReview } from './tax-management-review';

const rub = (cents: number) => `${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} руб.`;
export function taxManagerBrief(review: TaxManagementReview) {
  const totals = managementTotals(review);
  const lines = [
    `Налоги: сведения проверены ${review.reviewedAt}, доходы по ${review.cutoff}.`,
    `Доход по выгрузкам ФНС с апреля и книгам УСН/ПСН за январь–март: ${rub(totals.fns)}.`,
    `УСН за январь–март: ${rub(review.q1UsnCents)}. ПСН: ${rub(review.q1PsnCents)}. Включены один раз.`,
    `Дата превышения по этой сверке: ${review.fnsCrossing}. Полнота фактических оплат отдельно не подтверждена.`,
  ];
  if (review.regimeStatus) lines.push(`Окончание АУСН с ${review.regimeStatus.ausnEndedOn} подтверждено справкой ФНС №${review.regimeStatus.certificateNumber}. Принятие УСН «Доходы» отдельно не подтверждено. Просьба получить подтверждение регистрации; повторно заявление без проверки не подавать.`);
  else lines.push('Статус уведомлений не подтверждён. Просьба проверить отправку и принятие.');
  lines.push('', 'Незакрытые вопросы:');
  for (const f of review.findings.filter(f => f.status !== 'verified')) lines.push(`— ${f.title}: ${f.action}`);
  lines.push('', 'Разница источников не является установленной недоимкой. Сведения в ФНС автоматически не отправляются.');
  return lines.join('\n');
}

export function taxPaymentHistory(report?: PortalReport) {
  // Only original official accruals; never replace them with the 8% model.
  if (!report?.available) return [];
  return report.monthDetails.map(row => ({
    periodKey: row.periodKey,
    assessed: row.fnsAssessedState === 'loaded' ? row.fnsAssessed : undefined,
    bankPayment: row.enpPaymentState === 'found' ? row.enpPayment : undefined,
  })).sort((a,b) => b.periodKey.localeCompare(a.periodKey));
}
