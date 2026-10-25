import type { AusnReportView } from './ausn-report-cache';
import { taxDocumentTypes } from './tax-document-types';

export const requiredMonthlyTaxDocuments = ['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION'] as const;
export type RequiredMonthlyTaxDocument = typeof requiredMonthlyTaxDocuments[number];

export const taxDocumentHelp: Record<keyof typeof taxDocumentTypes, { required: boolean; source: string; instruction: string }> = {
  USN_DECLARATION: { required: true, source: 'ЛК ИП ФНС или бухгалтер', instruction: 'Нужна только декларация УСН за период до перехода на АУСН. Если оригинал уже сохранён в постоянном архиве портала, повторно загружать его не нужно.' },
  AUSN_TRANSITION_NOTICE: { required: true, source: 'ЛК ИП ФНС → АУСН или уведомления ФНС', instruction: 'Одноразовый документ, подтверждающий дату перехода на АУСН. Загрузите один раз и храните в постоянном архиве.' },
  AUSN_INCOME: { required: true, source: 'ЛК ФНС → АУСН → Доходы', instruction: 'Скачайте итог или реестр доходов за выбранный месяц после формирования данных ФНС.' },
  AUSN_KKT: { required: false, source: 'ЛК ФНС → АУСН → Доходы → ККТ', instruction: 'Детализация нужна только при расхождении с OFD или для проверки конкретных чеков.' },
  ENS_OPERATIONS: { required: true, source: 'ЛК ИП ФНС → ЕНС → Операции', instruction: 'Сформируйте выгрузку, включающую начисление АУСН за нужный месяц. До появления начисления файл считается преждевременным.' },
  AUSN_CALCULATION: { required: true, source: 'ЛК ФНС → АУСН → Расчёт налога', instruction: 'Скачайте расчёт ФНС после его появления, обычно после завершения месяца.' },
  CORRECTION_EVIDENCE: { required: false, source: 'ЛК ФНС, OFD или бухгалтер', instruction: 'Загружайте только когда есть возврат, корректировка или пояснение к расхождению.' },
};

export type TaxDocumentEvidence = { documentType: string; periodKey: string; originalName: string; source: 'portal' };
export type TaxPeriodPlan = { periodKey: string; status: 'complete' | 'missing'; missing: RequiredMonthlyTaxDocument[]; present: RequiredMonthlyTaxDocument[] };

function monthIndex(key: string) { const [year, month] = key.split('-').map(Number); return year * 12 + month - 1; }
function monthKey(index: number) { return `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`; }

export function dueAusnPeriods(now: Date, startMonth = '2026-04') {
  const moscow = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
  const current = moscow.getFullYear() * 12 + moscow.getMonth();
  const lastDue = current - (moscow.getDate() >= 16 ? 1 : 2);
  const result: string[] = [];
  for (let index = monthIndex(startMonth); index <= lastDue; index += 1) result.push(monthKey(index));
  return result;
}

function runnerEvidence(reports: AusnReportView[], periodKey: string, type: RequiredMonthlyTaxDocument) {
  const report = reports.find((item) => item.periodKey === periodKey);
  if (!report) return false;
  if (type === 'ENS_OPERATIONS') return Object.entries(report.sourceCompleteness).some(([key, value]) => key === 'ЕНС' && /загружен|доступ/i.test(value));
  return Object.entries(report.sourceCompleteness).some(([key, value]) => key === 'ЛК ФНС' && /загружен|выполнен/i.test(value));
}

export function buildTaxDocumentPlan(input: { now: Date; reports: AusnReportView[]; documents: TaxDocumentEvidence[]; startMonth?: string }) {
  return dueAusnPeriods(input.now, input.startMonth).map<TaxPeriodPlan>((periodKey) => {
    const present = requiredMonthlyTaxDocuments.filter((type) => input.documents.some((document) => document.periodKey === periodKey && document.documentType === type) || runnerEvidence(input.reports, periodKey, type));
    const missing = requiredMonthlyTaxDocuments.filter((type) => !present.includes(type));
    return { periodKey, present: [...present], missing: [...missing], status: missing.length ? 'missing' : 'complete' };
  });
}
