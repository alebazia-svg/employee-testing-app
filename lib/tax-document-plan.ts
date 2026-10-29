import type { AusnReportView } from './ausn-report-cache';
import { taxDocumentTypes } from './tax-document-types';

export const requiredMonthlyTaxDocuments = ['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION'] as const;
export type RequiredMonthlyTaxDocument = typeof requiredMonthlyTaxDocuments[number];

export const taxDocumentHelp: Record<keyof typeof taxDocumentTypes, { required: boolean; source: string; instruction: string }> = {
  USN_DECLARATION: { required: true, source: 'личный кабинет налоговой или бухгалтер', instruction: 'Нужна декларация УСН за январь–март 2026, до перехода на АУСН. Загружается один раз.' },
  USN_DECLARATION_RECEIPT: { required: false, source: 'личный кабинет налоговой → Сообщения', instruction: 'Квитанция подтверждает, что налоговая приняла декларацию. Хранится рядом с ней.' },
  AUSN_TRANSITION_NOTICE: { required: true, source: 'личный кабинет налоговой → АУСН или уведомления', instruction: 'Подтверждает дату перехода на АУСН. Загружается один раз.' },
  AUSN_INCOME: { required: true, source: 'личный кабинет налоговой → АУСН → Доходы', instruction: 'Скачайте Excel со всеми доходами за год — один файл закрывает сразу все месяцы.' },
  AUSN_KKT: { required: false, source: 'личный кабинет налоговой → АУСН → Доходы → ККТ', instruction: 'Нужна, только если налоговая учла доход иначе, чем у нас: по ней видно, какого чека кассы не хватает.' },
  ENS_OPERATIONS: { required: true, source: 'личный кабинет налоговой → Единый налоговый счёт → Операции', instruction: 'Сформируйте выгрузку с 1 января по сегодня и скачайте ZIP. Начисление за месяц появляется после 15 числа следующего месяца — раньше скачивать бесполезно.' },
  AUSN_CALCULATION: { required: true, source: 'личный кабинет налоговой → АУСН → Прочее → Справки → «Справка о полученных доходах»', instruction: 'Закажите справку за текущий год и загрузите PDF — одна справка закрывает все месяцы, которые в ней есть.' },
  CORRECTION_EVIDENCE: { required: false, source: 'личный кабинет налоговой, касса или бухгалтер', instruction: 'Загружайте, когда есть возврат покупателю, исправление или пояснение к расхождению.' },
};

export type TaxDocumentEvidence = { documentType: string; periodKey: string; coverageFrom?: string | null; coverageTo?: string | null; originalName: string; status?: string; source: 'portal' };
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

export function buildTaxDocumentPlan(input: { now: Date; reports: AusnReportView[]; documents: TaxDocumentEvidence[]; startMonth?: string }) {
  return dueAusnPeriods(input.now, input.startMonth).map<TaxPeriodPlan>((periodKey) => {
    const present = requiredMonthlyTaxDocuments.filter((type) => input.documents.some((document) => {
      if (document.documentType !== type) return false;
      if (document.status === 'PROCESSING_FAILED') return false;
      const from = document.coverageFrom || document.periodKey;
      const to = document.coverageTo || document.periodKey;
      return from <= periodKey && periodKey <= to;
    }));
    const missing = requiredMonthlyTaxDocuments.filter((type) => !present.includes(type));
    return { periodKey, present: [...present], missing: [...missing], status: missing.length ? 'missing' : 'complete' };
  });
}
