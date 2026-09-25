import { validatePaymentPlan } from './procurement-payment-control';
import { paymentBasisChanged } from './procurement-debt-request';
import { manualPaymentLinks } from './procurement-manual-payment-links';

export type RevisionData = ReturnType<typeof validatePaymentPlan>['data'];
export type PaymentRevision = { id: string; reason: string; submittedAt: string; data: RevisionData; changes: { label: string; before: string; after: string }[] };
export function paymentMatchCreatedAt(plan: {createdAt: Date|string;oneCCashEvidence?:unknown}) {
  const raw=plan.oneCCashEvidence as {paymentMatchFrom?:unknown}|null;
  return typeof raw?.paymentMatchFrom === 'string' && Number.isFinite(Date.parse(raw.paymentMatchFrom)) ? raw.paymentMatchFrom : new Date(plan.createdAt).toISOString();
}
export function readPaymentRevision(value: unknown): PaymentRevision | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const revision = (value as Record<string, unknown>).pendingRevision as PaymentRevision | undefined;
  return revision?.id && revision.data && Array.isArray(revision.changes) ? revision : null;
}
const fields: [keyof RevisionData, string][] = [
  ['supplierPartner', 'Поставщик'], ['supplierCounterparty', 'Контрагент'], ['orderRefs', 'Заказы'],
  ['plannedDate', 'Дата оплаты'], ['plannedAmount', 'Сумма, ₽'], ['foreignAmount', 'Сумма, USDT'],
  ['paymentMethod', 'Способ оплаты'], ['currency', 'Валюта'], ['exchangeRate', 'Курс'],
  ['commissionAmount', 'Комиссия'], ['exchangerName', 'Валютчик'], ['supplierConfirmation', 'Договорённость'], ['condition', 'Комментарий'],
];
const numeric = new Set(['plannedAmount', 'foreignAmount', 'exchangeRate', 'commissionAmount']);
const methods: Record<string, string> = { CASH: 'Наличные', BANK: 'Перевод поставщику', USDT: 'Оплата в USDT', ACCOUNTABLE_QR: 'Оплата по QR' };
function normal(key: string, value: unknown): string {
  if (key === 'plannedDate') return value instanceof Date ? value.toISOString().slice(0, 10) : String(value || '').slice(0, 10);
  if (key === 'orderRefs') return JSON.stringify(Array.isArray(value) ? [...value].sort() : []);
  if (numeric.has(key)) return Number(value || 0).toString();
  return String(value || '').trim();
}
function display(key: string, value: unknown) {
  const normalized=normal(key,value);
  if(key==='plannedDate' && /^\d{4}-\d{2}-\d{2}$/.test(normalized))return new Date(`${normalized}T12:00:00Z`).toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
  if(numeric.has(key))return value == null || value === '' ? '—' : Number(value).toLocaleString('ru-RU',{maximumFractionDigits:4});
  return normalized;
}
function orderDescription(value: {orderRefs?: unknown; orderNumbers?: unknown}) {
  if (!Array.isArray(value.orderRefs) || !value.orderRefs.length) return 'В счёт долга поставщику';
  return Array.isArray(value.orderNumbers) && value.orderNumbers.filter(Boolean).join(', ') || 'По заказу';
}
export function revisionChanges(before: Record<string, any>, after: RevisionData) {
  return fields.filter(([key]) => normal(key, before[key]) !== normal(key, after[key])).map(([key, label]) => ({
    key, label: key === 'orderRefs' && paymentBasisChanged(before as {orderRefs: unknown}, after) ? 'Основание оплаты' : label,
    before: key === 'orderRefs' ? orderDescription(before) : key === 'paymentMethod' ? methods[before[key]] || String(before[key]) : display(key, before[key]),
    after: key === 'orderRefs' ? orderDescription(after) : key === 'paymentMethod' ? methods[after[key]] || String(after[key]) : display(key, after[key]),
  }));
}
export function assertRevisionPaymentSafety(before: Record<string, any>, data: RevisionData, evidence: {state: string; issuedAmount: number; paidAmount: number; paidForeignAmount: number}) {
  if (paymentBasisChanged(before as {orderRefs: unknown}, data)) {
    if (before.supplierPartner !== data.supplierPartner) throw new Error('При смене основания оставьте того же поставщика.');
    if (manualPaymentLinks(before.oneCCashEvidence).length) throw new Error('У заявки есть связь с расходником. Основание менять нельзя.');
  }
  if (['ISSUED_BY_ONE_C', 'PAID_BY_ONE_C'].includes(evidence.state)) throw new Error('Оплаченная заявка не редактируется.');
  if (['NEEDS_REVIEW', 'MISMATCH'].includes(evidence.state)) throw new Error('Сначала нужно проверить оплату этой заявки.');
  const paid = evidence.issuedAmount + evidence.paidAmount;
  if (paid <= 0 && evidence.paidForeignAmount <= 0) return;
  const changed = revisionChanges(before, data);
  if (changed.some(c => ['supplierPartner', 'supplierCounterparty', 'orderRefs', 'paymentMethod', 'currency'].includes(c.key))) throw new Error('После частичной оплаты нельзя менять поставщика, заказы и способ оплаты. Меняйте только оставшуюся потребность.');
  if (Math.round(Number(data.plannedAmount) * 100) < Math.round(paid * 100) || (data.foreignAmount != null && data.foreignAmount < evidence.paidForeignAmount)) throw new Error('Новая общая сумма не может быть меньше уже оплаченной.');
  if (evidence.paidForeignAmount > 0 && data.foreignAmount == null && evidence.paidAmount <= 0) throw new Error('Укажите общую сумму USDT, чтобы сохранить уже оплаченную часть.');
}
