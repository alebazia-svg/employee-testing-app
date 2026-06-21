import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AlertTriangle, ArrowRight, FileSearch, ShieldAlert } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { runSabyOfdProbe } from '@/lib/saby-ofd';
import {
  DEFAULT_SALES_REALIZATIONS_PARAMS,
  getSalesRealizationLinks,
  getSalesRealizations,
  type OneCLinkedDocument,
  type OneCLinkedDocumentGroup,
  type OneCSalesRealizationDocument,
  type OneCSalesRealizationLinksResult,
  type OneCSalesRealizationsResult,
} from '@/lib/one-c';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type ItemPreview = {
  index?: number;
  name?: string;
  quantity?: number;
  sum?: number;
  price?: number;
  paymentType?: unknown;
  normalizedPaymentType?: unknown;
};

type Candidate = {
  fiscalDocumentNumber?: string;
  fiscalDriveNumber?: string;
  fiscalSign?: string;
  date?: string;
  totalSum?: number;
  itemsPreview?: ItemPreview[];
  matchScore?: number;
  timeDeltaSeconds?: number;
  confidence?: string;
  reasons?: string[];
};

type OneCCandidate = {
  document: OneCSalesRealizationDocument;
  score: number;
  confidence: 'probable' | 'weak' | 'rejected';
  reasons: string[];
  rejectedReasons: string[];
  amountDiff: number | null;
  dayDiff: number | null;
  matchedProducts: number;
};

type ReturnSample = {
  fiscalDocumentNumber?: string;
  fiscalDriveNumber?: string;
  fiscalSign?: string;
  date?: string;
  totalSum?: number;
  cashTotalSum?: number;
  ecashTotalSum?: number;
  creditSum?: number;
  operationType?: number;
  receiptCode?: number;
  rawPaymentTypes?: unknown[];
  normalizedPaymentTypes?: unknown[];
  issues?: Array<{ code?: string; severity?: string; message?: string; rule?: string }>;
  itemsPreview?: ItemPreview[];
  directLinks?: Array<{ path: string; value: unknown }>;
  possibleOriginalCandidates?: Candidate[];
  rejectedCandidates?: Candidate[];
  matchingStatus?: string;
};

type OfdProbeResult = {
  ok?: boolean;
  checkedAt?: string;
  returnDiagnostics?: {
    returnDocumentsChecked?: number;
    foundDirectLinks?: number;
    matchingStatuses?: Record<string, number>;
    samples?: ReturnSample[];
    conclusion?: string;
  };
  receiptDiagnostics?: {
    documentsChecked?: number;
    salesShown?: number;
    returnsShown?: number;
    samples?: ReturnSample[];
  };
  errors?: string[];
};

const DEFAULT_INN = '071306665560';
const DEFAULT_LIMIT = 50;

type PeriodPreset = {
  id: string;
  label: string;
  dateFrom: string;
  dateTo: string;
};

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getPeriodPresets(now = new Date()): PeriodPreset[] {
  const today = formatDateParam(now);
  const yesterday = formatDateParam(addDays(now, -1));
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  return [
    { id: 'today', label: 'Сегодня', dateFrom: today, dateTo: today },
    { id: 'yesterday', label: 'Вчера', dateFrom: yesterday, dateTo: yesterday },
    { id: 'last-7-days', label: 'Последние 7 дней', dateFrom: formatDateParam(addDays(now, -6)), dateTo: today },
    { id: 'last-30-days', label: 'Последние 30 дней', dateFrom: formatDateParam(addDays(now, -29)), dateTo: today },
    { id: 'this-month', label: 'Этот месяц', dateFrom: formatDateParam(monthStart), dateTo: today },
    { id: 'previous-month', label: 'Прошлый месяц', dateFrom: formatDateParam(previousMonthStart), dateTo: formatDateParam(previousMonthEnd) },
  ];
}

function isDateParam(value?: string) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function humanErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.name === 'AbortError' || error.message.toLowerCase().includes('aborted')) {
      return 'Запрос был прерван по таймауту. Данные сейчас не получены.';
    }
    if (error.message.toLowerCase().includes('fetch failed')) {
      return 'Сервис сейчас не ответил. Данные сейчас не получены.';
    }
    return error.message || 'Не удалось получить данные.';
  }
  return 'Не удалось получить данные.';
}

async function safeRunSabyOfdProbe(params: { organizationInn: string; dateFrom: string; dateTo: string; limit: number }): Promise<OfdProbeResult> {
  try {
    return await runSabyOfdProbe(params) as OfdProbeResult;
  } catch (error) {
    return {
      ok: false,
      errors: [humanErrorMessage(error)],
    };
  }
}

async function safeGetSalesRealizations(
  params: NonNullable<Parameters<typeof getSalesRealizations>[0]> = DEFAULT_SALES_REALIZATIONS_PARAMS,
): Promise<OneCSalesRealizationsResult> {
  try {
    return await getSalesRealizations(params);
  } catch (error) {
    return {
      ok: false,
      path: '/sales-realizations',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      params,
      documents: [],
      totalDocuments: null,
      totalAmount: null,
      hasMore: false,
      responseDocumentCount: 0,
      error: humanErrorMessage(error),
      diagnostics: [error instanceof Error ? `${error.name}: ${error.message}` : String(error)],
    };
  }
}

async function safeGetSalesRealizationLinks(realizationRef: string): Promise<OneCSalesRealizationLinksResult> {
  try {
    return await getSalesRealizationLinks(realizationRef);
  } catch (error) {
    return {
      ok: false,
      path: '/sales-realization-links',
      durationMs: 0,
      checkedAt: new Date().toISOString(),
      realizationRef,
      links: null,
      diagnostics: [error instanceof Error ? `${error.name}: ${error.message}` : String(error)],
      error: humanErrorMessage(error),
    };
  }
}

function formatDate(value?: string) {
  if (!value) return 'нет данных';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'medium' }).format(date);
}

function formatMoney(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'нет данных';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RUB';
}

function formatOfdMoney(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'нет данных';
  return (value / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' RUB';
}

function formatSeconds(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'нет данных';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value} сек.`;
}

function primaryItemName(items?: ItemPreview[]) {
  return items?.find((item) => item.name)?.name ?? 'Товар не найден';
}

function humanCheckType(sample: ReturnSample) {
  return sample.operationType === 2 ? 'Возврат найден' : 'Продажа найдена';
}

function humanMatchPhrases(candidate?: OneCCandidate | null) {
  if (!candidate) return ['Требуется ручная проверка', 'Возможная реализация 1С не найдена'];

  const phrases = ['Найдена возможная реализация 1С', 'Автоматически не закрывается'];
  if (candidate.reasons.includes('amount_close')) phrases.push('Сумма совпала');
  if (candidate.reasons.includes('products_overlap')) phrases.push('Товар похож/совпал');
  if (candidate.reasons.includes('same_day') || candidate.reasons.includes('nearby_date')) phrases.push('Дата близко к чеку');
  if (candidate.rejectedReasons.includes('date_warning')) phrases.push('Дата отличается — возможно, тестовая 1С база неактуальна');
  if (candidate.document.managerName || candidate.document.additionalManagerName || candidate.document.responsibleName) phrases.push('Менеджер определён по 1С');
  if (candidate.rejectedReasons.includes('amount_differs')) phrases.push('Сумма не совпала');
  if (candidate.rejectedReasons.includes('no_product_overlap')) phrases.push('Товар не совпал');
  return phrases;
}

function simpleMatchPhrases(candidate?: OneCCandidate | null) {
  if (!candidate) return ['Не найдена похожая реализация 1С'];

  const phrases: string[] = [];
  if (candidate.reasons.includes('amount_close')) phrases.push('Сумма совпала');
  if (candidate.reasons.includes('products_overlap')) phrases.push('Товар похож/совпал');
  if (candidate.reasons.includes('same_day') || candidate.reasons.includes('nearby_date')) phrases.push('Дата близко к чеку');
  if (candidate.rejectedReasons.includes('date_warning')) phrases.push('Дата сильно отличается');
  if (candidate.document.managerName || candidate.document.additionalManagerName || candidate.document.responsibleName) {
    phrases.push('Менеджер определён по 1С');
  }
  if ((candidate.document.counterpartyName || candidate.document.partnerName || '').toLowerCase().includes('кредит')) {
    phrases.push('Контрагент: Кредит/рассрочка');
  }
  if (candidate.rejectedReasons.includes('amount_differs')) phrases.push('Сумма не совпала');
  if (candidate.rejectedReasons.includes('no_product_overlap')) phrases.push('Товар не совпал');
  return phrases;
}

function reasonLabel(reason: string) {
  const labels: Record<string, string> = {
    same_fn: 'совпал ФН',
    same_total_sum: 'совпала сумма',
    same_items: 'совпали товары',
    return_after_sale: 'возврат позже прихода',
    amount_close: 'amount matched',
    amount_differs: 'amount differs',
    same_day: 'date matched',
    nearby_date: 'date nearby',
    date_warning: 'date_warning',
    date_far: 'date far',
    products_overlap: 'products matched',
    no_product_overlap: 'products differ',
  };
  return labels[reason] ?? reason;
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, ' ').trim();
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(/\s+/).filter((token) => token.length >= 3));
}

function hasProductOverlap(left: string, right: string) {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return false;
  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return true;
  const leftTokens = tokenSet(left);
  const rightTokens = tokenSet(right);
  for (const token of leftTokens) {
    if (rightTokens.has(token)) return true;
  }
  return false;
}

function dateDay(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function dayDiff(left?: string, right?: string) {
  const leftDay = dateDay(left);
  const rightDay = dateDay(right);
  if (leftDay === null || rightDay === null) return null;
  return Math.round(Math.abs(leftDay - rightDay) / (24 * 60 * 60 * 1000));
}

function matchOneCRealizations(ofdCandidate: Candidate | ReturnSample | undefined, documents: OneCSalesRealizationDocument[]) {
  if (!ofdCandidate) return { best: null as OneCCandidate | null, candidates: [] as OneCCandidate[] };

  const ofdAmount = typeof ofdCandidate.totalSum === 'number' ? ofdCandidate.totalSum / 100 : null;
  const ofdItems = ofdCandidate.itemsPreview ?? [];
  const scored = documents.map((document) => {
    const amountDiff = typeof document.amount === 'number' && ofdAmount !== null ? Math.abs(document.amount - ofdAmount) : null;
    const diffDays = dayDiff(ofdCandidate.date, document.date);
    const matchedProducts = ofdItems.filter((ofdItem) =>
      document.lines.some((line) => hasProductOverlap(ofdItem.name ?? '', line.productName || line.productArticle || line.productCode))
    ).length;
    const reasons: string[] = [];
    const rejectedReasons: string[] = [];
    let score = 0;

    if (amountDiff !== null && amountDiff <= 1) {
      score += 45;
      reasons.push('amount_close');
    } else {
      rejectedReasons.push('amount_differs');
    }

    if (diffDays === 0) {
      score += 25;
      reasons.push('same_day');
    } else if (diffDays !== null && diffDays <= 7) {
      score += 10;
      reasons.push('nearby_date');
    } else if (diffDays !== null) {
      rejectedReasons.push('date_warning');
    } else {
      rejectedReasons.push('date_far');
    }

    if (matchedProducts > 0) {
      score += Math.min(30, matchedProducts * 15);
      reasons.push('products_overlap');
    } else {
      rejectedReasons.push('no_product_overlap');
    }

    return {
      document,
      score,
      confidence: score >= 70 ? 'probable' as const : score >= 45 ? 'weak' as const : 'rejected' as const,
      reasons,
      rejectedReasons,
      amountDiff,
      dayDiff: diffDays,
      matchedProducts,
    };
  }).sort((a, b) => b.score - a.score);

  const candidates = scored.slice(0, 5);
  const best = candidates.find((candidate) => candidate.confidence !== 'rejected') ?? null;
  return { best, candidates };
}

function matchingTargetForSample(sample: ReturnSample) {
  const bestCandidate = sample.possibleOriginalCandidates?.[0];
  return sample.operationType === 2 ? bestCandidate ?? sample : sample;
}

function countLinkWarnings(result?: OneCSalesRealizationLinksResult) {
  if (!result?.links) return result?.ok === false ? 1 : 0;
  return result.links.warnings.length + result.links.checkedSources.filter((source) => source.ok === false).length;
}

function findingStatus(hasDirect: boolean, hasCandidates: boolean, checked = true) {
  if (!checked) return { text: 'не проверено', className: 'bg-slate-100 text-slate-700' };
  if (hasDirect) return { text: 'найдено', className: 'bg-green-100 text-green-800' };
  if (hasCandidates) return { text: 'есть варианты', className: 'bg-amber-100 text-amber-800' };
  return { text: 'не найдено', className: 'bg-slate-100 text-slate-700' };
}

function mainCheckStatus(match: { best: OneCCandidate | null }, oneCAvailable: boolean) {
  if (!oneCAvailable) return { text: '1С недоступна', className: 'bg-red-100 text-red-700' };
  if (!match.best) return { text: 'Не найдено в 1С', className: 'bg-amber-100 text-amber-800' };
  if (match.best.confidence === 'probable') return { text: 'Совпало с 1С', className: 'bg-green-100 text-green-800' };
  return { text: 'Есть кандидат в 1С', className: 'bg-blue-100 text-blue-800' };
}

function operationLabel(sample: ReturnSample) {
  if (sample.operationType === 2) return 'Возврат прихода';
  if (sample.operationType === 1) return 'Приход';
  return sample.operationType ? `Операция ${sample.operationType}` : 'Тип операции не определён';
}

function ItemsList({ items }: { items?: ItemPreview[] }) {
  if (!items?.length) return <p className='text-sm font-semibold text-slate-500'>Товары не найдены в diagnostic sample.</p>;

  return (
    <div className='overflow-x-auto rounded-lg border border-slate-200'>
      <table className='min-w-full text-left text-sm'>
        <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
          <tr>
            <th className='px-3 py-2'>#</th>
            <th className='px-3 py-2'>Товар</th>
            <th className='px-3 py-2 text-right'>Кол-во</th>
            <th className='px-3 py-2 text-right'>Сумма</th>
            <th className='px-3 py-2'>paymentType</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.index}-${item.name}-${item.sum}`} className='border-t border-slate-200'>
              <td className='px-3 py-2 font-bold text-slate-500'>{item.index}</td>
              <td className='max-w-xl px-3 py-2 font-semibold text-slate-950'>{item.name || 'нет данных'}</td>
              <td className='px-3 py-2 text-right font-semibold text-slate-700'>{item.quantity ?? 'нет данных'}</td>
              <td className='px-3 py-2 text-right font-bold text-slate-950'>{formatOfdMoney(item.sum)}</td>
              <td className='px-3 py-2 font-semibold text-slate-700'>
                {String(item.paymentType ?? 'нет данных')}
                {item.normalizedPaymentType ? <span className='ml-2 text-slate-500'>({String(item.normalizedPaymentType)})</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateCard({ candidate, rejected = false }: { candidate: Candidate; rejected?: boolean }) {
  return (
    <div className={rejected ? 'rounded-lg border border-amber-200 bg-amber-50 p-4' : 'rounded-lg border border-green-200 bg-green-50 p-4'}>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge className={rejected ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
          {rejected ? 'отклонённый похожий' : 'лучший кандидат'}
        </Badge>
        <Badge className='bg-white text-slate-700'>ФД {candidate.fiscalDocumentNumber || 'нет данных'}</Badge>
        <Badge className='bg-white text-slate-700'>Δ {formatSeconds(candidate.timeDeltaSeconds)}</Badge>
      </div>

      <div className='mt-3 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-4'>
        <div>
          <p className='text-slate-500'>Дата/время</p>
          <p className='mt-1 text-slate-950'>{formatDate(candidate.date)}</p>
        </div>
        <div>
          <p className='text-slate-500'>Сумма</p>
          <p className='mt-1 text-slate-950'>{formatOfdMoney(candidate.totalSum)}</p>
        </div>
        <div>
          <p className='text-slate-500'>ФН</p>
          <p className='mt-1 break-all text-slate-950'>{candidate.fiscalDriveNumber || 'нет данных'}</p>
        </div>
        <div>
          <p className='text-slate-500'>ФПД / фискальный признак</p>
          <p className='mt-1 break-all text-slate-950'>{candidate.fiscalSign || 'нет данных'}</p>
        </div>
      </div>

      <div className='mt-3'>
        <p className='text-sm font-extrabold text-slate-950'>{rejected ? 'Причина отклонения' : 'Почему выбран'}</p>
        <div className='mt-2 flex flex-wrap gap-2'>
          {(candidate.reasons ?? []).map((reason) => (
            <Badge key={reason} className='bg-white text-slate-700'>{reasonLabel(reason)}</Badge>
          ))}
          {rejected && !candidate.reasons?.includes('return_after_sale') ? (
            <Badge className='bg-red-100 text-red-700'>чек позже возврата или время не подтверждено</Badge>
          ) : null}
        </div>
      </div>

      <div className='mt-4'>
        <p className='mb-2 text-sm font-extrabold text-slate-950'>Товары кандидата</p>
        <ItemsList items={candidate.itemsPreview} />
      </div>
    </div>
  );
}

function OneCItemsList({ document }: { document: OneCSalesRealizationDocument }) {
  if (!document.lines.length) return <p className='text-sm font-semibold text-slate-500'>Строки товаров в 1С не найдены.</p>;

  return (
    <div className='overflow-x-auto rounded-lg border border-slate-200'>
      <table className='min-w-full text-left text-sm'>
        <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
          <tr>
            <th className='px-3 py-2'>#</th>
            <th className='px-3 py-2'>Товар 1С</th>
            <th className='px-3 py-2 text-right'>Кол-во</th>
            <th className='px-3 py-2 text-right'>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {document.lines.map((line) => (
            <tr key={`${document.ref}-${line.lineNumber}-${line.productName}-${line.amount}`} className='border-t border-slate-200'>
              <td className='px-3 py-2 font-bold text-slate-500'>{line.lineNumber}</td>
              <td className='max-w-xl px-3 py-2 font-semibold text-slate-950'>{line.productName || line.productArticle || line.productCode || 'нет данных'}</td>
              <td className='px-3 py-2 text-right font-semibold text-slate-700'>{line.quantity ?? 'нет данных'}</td>
              <td className='px-3 py-2 text-right font-bold text-slate-950'>{formatMoney(line.amount ?? undefined)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OneCCandidateCard({ candidate, rejected = false }: { candidate: OneCCandidate; rejected?: boolean }) {
  const document = candidate.document;
  const manager = document.managerName || document.additionalManagerName || document.responsibleName || 'нет данных';
  const counterparty = document.counterpartyName || document.partnerName || 'нет данных';

  return (
    <div className={rejected ? 'rounded-lg border border-slate-200 bg-slate-50 p-4' : 'rounded-lg border border-blue-200 bg-blue-50 p-4'}>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge className={rejected ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-800'}>
          {rejected ? 'похожая реализация' : 'возможная реализация 1С'}
        </Badge>
        <Badge className='bg-white text-slate-700'>needs_review</Badge>
        <Badge className='bg-white text-slate-700'>score {candidate.score}</Badge>
        <Badge className='bg-white text-slate-700'>{candidate.confidence}</Badge>
      </div>

      <div className='mt-3 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-4'>
        <div>
          <p className='text-slate-500'>Номер реализации</p>
          <p className='mt-1 text-slate-950'>{document.number || document.ref || 'нет данных'}</p>
        </div>
        <div>
          <p className='text-slate-500'>Дата/время</p>
          <p className='mt-1 text-slate-950'>{formatDate(document.date)}</p>
        </div>
        <div>
          <p className='text-slate-500'>Сумма</p>
          <p className='mt-1 text-slate-950'>{formatMoney(document.amount ?? undefined)}</p>
        </div>
        <div>
          <p className='text-slate-500'>Разница суммы</p>
          <p className='mt-1 text-slate-950'>{candidate.amountDiff === null ? 'нет данных' : formatMoney(candidate.amountDiff)}</p>
        </div>
        <div>
          <p className='text-slate-500'>Менеджер из 1С</p>
          <p className='mt-1 text-slate-950'>{manager}</p>
        </div>
        <div>
          <p className='text-slate-500'>Контрагент / партнёр</p>
          <p className='mt-1 text-slate-950'>{counterparty}</p>
        </div>
        <div>
          <p className='text-slate-500'>Разница дней</p>
          <p className='mt-1 text-slate-950'>{candidate.dayDiff ?? 'нет данных'}</p>
        </div>
        <div>
          <p className='text-slate-500'>Совпавших товаров</p>
          <p className='mt-1 text-slate-950'>{candidate.matchedProducts}</p>
        </div>
      </div>

      <div className='mt-3 flex flex-wrap gap-2'>
        {candidate.reasons.map((reason) => <Badge key={reason} className='bg-white text-slate-700'>{reasonLabel(reason)}</Badge>)}
        {candidate.rejectedReasons.map((reason) => (
          <Badge key={reason} className={reason === 'date_warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}>
            {reasonLabel(reason)}
          </Badge>
        ))}
      </div>

      <div className='mt-4'>
        <p className='mb-2 text-sm font-extrabold text-slate-950'>Товары реализации 1С</p>
        <OneCItemsList document={document} />
      </div>
    </div>
  );
}

function OneCRealizationMini({ candidate }: { candidate: OneCCandidate }) {
  const document = candidate.document;
  const manager = document.managerName || document.additionalManagerName || document.responsibleName || 'нет данных';
  const counterparty = document.counterpartyName || document.partnerName || 'нет данных';

  return (
    <div className='rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='font-extrabold text-slate-950'>{document.number || document.ref || 'реализация без номера'}</p>
        <p className='font-extrabold text-slate-950'>{formatMoney(document.amount ?? undefined)}</p>
      </div>
      <p className='mt-1 font-semibold text-slate-700'>{formatDate(document.date)}</p>
      <p className='mt-1 font-semibold text-slate-700'>Менеджер: {manager}</p>
      <p className='mt-1 font-semibold text-slate-700'>Контрагент: {counterparty}</p>
      <div className='mt-2 flex flex-wrap gap-2'>
        {simpleMatchPhrases(candidate).map((phrase) => (
          <Badge key={phrase} className={phrase.includes('не совпал') || phrase.includes('сильно') ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-700'}>
            {phrase}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function FindingCard({
  title,
  status,
  children,
}: {
  title: string;
  status: { text: string; className: string };
  children?: ReactNode;
}) {
  return (
    <div className='rounded-lg border border-slate-200 bg-white p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-extrabold text-slate-950'>{title}</p>
        <Badge className={status.className}>{status.text}</Badge>
      </div>
      {children ? <div className='mt-3'>{children}</div> : null}
    </div>
  );
}

function ActionPlanBlock({ hasMatch }: { hasMatch: boolean }) {
  return (
    <div className='rounded-lg border border-slate-200 bg-white p-4'>
      <h3 className='font-extrabold text-slate-950'>Что делать</h3>
      <p className='mt-1 text-sm font-semibold text-slate-500'>
        Сейчас это только диагностика. Действия ниже показывают будущий рабочий сценарий, но пока не меняют данные.
      </p>
      <div className='mt-3 flex flex-wrap gap-2'>
        <button disabled className='rounded-lg bg-green-100 px-3 py-2 text-sm font-extrabold text-green-800 opacity-70'>
          Подтвердить совпадение скоро
        </button>
        <button disabled className='rounded-lg bg-slate-100 px-3 py-2 text-sm font-extrabold text-slate-700 opacity-70'>
          Отклонить кандидата скоро
        </button>
        <button disabled className='rounded-lg bg-amber-100 px-3 py-2 text-sm font-extrabold text-amber-800 opacity-70'>
          Оставить на ручной проверке
        </button>
      </div>
      <p className='mt-3 text-sm font-semibold text-slate-600'>
        {hasMatch
          ? 'Проверьте реализацию, оплату и товары. Если всё совпадает, позже этот кейс можно будет подтвердить прямо здесь.'
          : 'Сначала нужно найти подходящую реализацию или проверить, почему 1С не дала совпадение.'}
      </p>
    </div>
  );
}

function OfdItemsSummary({ items }: { items?: ItemPreview[] }) {
  if (!items?.length) return <p className='text-sm font-semibold text-slate-500'>Товары в чеке не найдены.</p>;

  return (
    <div className='overflow-x-auto rounded-lg border border-slate-200'>
      <table className='min-w-full text-left text-sm'>
        <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
          <tr>
            <th className='px-3 py-2'>#</th>
            <th className='px-3 py-2'>Товар</th>
            <th className='px-3 py-2 text-right'>Кол-во</th>
            <th className='px-3 py-2 text-right'>Сумма</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={`${item.index}-${item.name}-${item.sum}`} className='border-t border-slate-200'>
              <td className='px-3 py-2 font-bold text-slate-500'>{item.index}</td>
              <td className='max-w-xl px-3 py-2 font-semibold text-slate-950'>{item.name || 'нет данных'}</td>
              <td className='px-3 py-2 text-right font-semibold text-slate-700'>{item.quantity ?? 'нет данных'}</td>
              <td className='px-3 py-2 text-right font-bold text-slate-950'>{formatOfdMoney(item.sum)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function linkReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    basis_is_realization: 'Основание = реализация',
    ОснованиеРеализация: 'Основание = реализация',
    amount_close: 'сумма похожа',
    same_amount: 'сумма совпала',
    same_partner: 'контрагент похож',
    same_counterparty: 'контрагент похож',
    nearby_date: 'дата рядом',
    same_day: 'дата совпала',
  };
  return labels[reason] ?? reason;
}

function linkedDocumentTitle(document: OneCLinkedDocument) {
  return document.number || document.name || document.ref || 'документ без номера';
}

function linkedDocumentStatus(group: OneCLinkedDocumentGroup) {
  if (group.direct.length) return { text: 'Найдено', className: 'bg-green-100 text-green-800' };
  if (group.candidates.length) return { text: 'Есть кандидаты', className: 'bg-amber-100 text-amber-800' };
  return { text: 'Не найдено', className: 'bg-slate-100 text-slate-700' };
}

function linkedDocumentSummary(group: OneCLinkedDocumentGroup) {
  if (group.direct.length) return `Прямых связей: ${group.direct.length}`;
  if (group.candidates.length) return `Похожих документов: ${group.candidates.length}`;
  return 'Связи не найдены';
}

function linkedDocumentsHasSignals(links: OneCSalesRealizationLinksResult['links'] | undefined) {
  if (!links) return false;
  return [
    links.cashReceipts,
    links.acquiring,
    links.bankReceipts,
    links.paymentDocuments,
    links.returns,
    links.corrections,
  ].some((group) => group.direct.length || group.candidates.length);
}

function LinkedDocumentRows({ documents, cautious = false }: { documents: OneCLinkedDocument[]; cautious?: boolean }) {
  if (!documents.length) return null;

  return (
    <div className='overflow-x-auto rounded-lg border border-slate-200 bg-white'>
      <table className='min-w-full text-left text-sm'>
        <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
          <tr>
            <th className='px-3 py-2'>Документ</th>
            <th className='px-3 py-2'>Дата</th>
            <th className='px-3 py-2 text-right'>Сумма</th>
            <th className='px-3 py-2'>Почему найден</th>
          </tr>
        </thead>
        <tbody>
          {documents.map((document, index) => (
            <tr key={`${document.ref}-${document.number}-${document.date}-${index}`} className='border-t border-slate-200'>
              <td className='px-3 py-2'>
                <p className='font-extrabold text-slate-950'>{linkedDocumentTitle(document)}</p>
                {cautious ? <p className='mt-1 text-xs font-bold text-amber-700'>похоже, требует проверки</p> : null}
              </td>
              <td className='px-3 py-2 font-semibold text-slate-700'>{formatDate(document.date)}</td>
              <td className='px-3 py-2 text-right font-extrabold text-slate-950'>{formatMoney(document.amount ?? undefined)}</td>
              <td className='px-3 py-2'>
                <div className='flex flex-wrap gap-2'>
                  {(document.matchReasons.length ? document.matchReasons : ['Основание = реализация']).map((reason) => (
                    <Badge key={reason} className={cautious ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                      {linkReasonLabel(reason)}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinkedDocumentGroup({
  title,
  group,
  emptyText,
}: {
  title: string;
  group: OneCLinkedDocumentGroup;
  emptyText: string;
}) {
  const status = linkedDocumentStatus(group);
  const previewDocuments = group.direct.length ? group.direct.slice(0, 2) : group.candidates.slice(0, 2);

  return (
    <div className='rounded-lg border border-slate-200 bg-white p-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <p className='text-sm font-extrabold text-slate-950'>{title}</p>
          <p className='mt-1 text-xs font-bold text-slate-500'>{linkedDocumentSummary(group)}</p>
        </div>
        <Badge className={status.className}>{status.text}</Badge>
      </div>

      {previewDocuments.length ? (
        <div className='mt-3 grid gap-2'>
          {previewDocuments.map((document, index) => (
            <div key={`${title}-${document.ref}-${document.number}-${index}`} className='rounded-md bg-slate-50 px-3 py-2 text-sm'>
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <p className='font-extrabold text-slate-950'>{linkedDocumentTitle(document)}</p>
                <p className='font-bold text-slate-950'>{formatMoney(document.amount ?? undefined)}</p>
              </div>
              <p className='mt-1 font-semibold text-slate-600'>{formatDate(document.date)}</p>
              <div className='mt-2 flex flex-wrap gap-2'>
                {(document.matchReasons.length ? document.matchReasons : ['Основание = реализация']).slice(0, 3).map((reason) => (
                  <Badge key={reason} className={group.direct.includes(document) ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                    {linkReasonLabel(reason)}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className='mt-3 text-sm font-semibold text-slate-500'>{emptyText}</p>
      )}

      {group.direct.length + group.candidates.length > previewDocuments.length || group.candidates.length ? (
        <details className='mt-3 text-sm'>
          <summary className='cursor-pointer font-bold text-slate-700'>Показать все документы и причины</summary>
          <div className='mt-3 grid gap-3'>
            {group.direct.length ? <LinkedDocumentRows documents={group.direct} /> : null}
            {group.candidates.length ? (
              <div className='grid gap-2'>
                <p className='text-sm font-bold text-amber-800'>Похожие документы, требуют проверки</p>
                <LinkedDocumentRows documents={group.candidates} cautious />
              </div>
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function OneCLinkedDocumentsBlock({ result }: { result?: OneCSalesRealizationLinksResult }) {
  const links = result?.links;
  const directCashReceipts = links?.cashReceipts.direct ?? [];
  const hasLinkedSignals = linkedDocumentsHasSignals(links);

  return (
    <div className='rounded-lg border border-indigo-200 bg-indigo-50 p-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <FileSearch className='h-4 w-4 text-indigo-700' />
        <h3 className='font-extrabold text-slate-950'>Связанные документы 1С</h3>
        <Badge className='bg-amber-100 text-amber-800'>needs_review</Badge>
      </div>

      {!result ? (
        <p className='mt-3 text-sm font-semibold text-slate-600'>Связи не запрашивались: подходящая реализация 1С не найдена.</p>
      ) : !result.ok || !links ? (
        <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
          Не удалось получить связанные документы 1С. {result.error ?? 'Ответ 1С требует проверки.'}
        </div>
      ) : (
        <div className='mt-3 grid gap-4'>
          {directCashReceipts.length ? (
            <div className='rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900'>
              <p className='font-extrabold text-green-950'>Найден первоначальный взнос в 1С</p>
              <p className='mt-1'>Есть прямой ПКО по реализации. Это хороший признак, но карточка всё равно остаётся read-only диагностикой.</p>
            </div>
          ) : (
            <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
              Прямой ПКО не найден. Если ниже есть кандидаты, их можно использовать только как подсказки для ручной проверки.
            </div>
          )}

          {!hasLinkedSignals ? (
            <div className='rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600'>
              Связанные документы не найдены. Проверьте чек вручную: в 1С пока нет прямого подтверждения оплаты, возврата или корректировки.
            </div>
          ) : null}

          <div className='grid gap-3 lg:grid-cols-2'>
            <LinkedDocumentGroup title='ПКО' group={links.cashReceipts} emptyText='Прямые ПКО не найдены.' />
            <LinkedDocumentGroup title='Эквайринг' group={links.acquiring} emptyText='Эквайринг не найден.' />
            <LinkedDocumentGroup title='Поступления' group={links.bankReceipts} emptyText='Поступления не найдены.' />
            <LinkedDocumentGroup title='Возвраты' group={links.returns} emptyText='Возвраты не найдены.' />
            <LinkedDocumentGroup title='Корректировки' group={links.corrections} emptyText='Корректировки не найдены.' />
          </div>

          <details className='rounded-lg border border-slate-200 bg-white p-4 text-sm'>
            <summary className='cursor-pointer font-extrabold text-slate-950'>Показать технические детали связанных документов</summary>
            <div className='mt-3 grid gap-3'>
              {links.checkedSources.length ? (
                <div className='overflow-x-auto rounded-lg border border-slate-200'>
                  <table className='min-w-full text-left text-sm'>
                    <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
                      <tr>
                        <th className='px-3 py-2'>Источник</th>
                        <th className='px-3 py-2'>Режим</th>
                        <th className='px-3 py-2'>Статус</th>
                        <th className='px-3 py-2'>Найдено</th>
                        <th className='px-3 py-2'>Ошибка</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.checkedSources.map((source) => (
                        <tr key={`${source.name}-${source.matchMode}`} className='border-t border-slate-200'>
                          <td className='px-3 py-2 font-semibold text-slate-950'>{source.name || 'нет данных'}</td>
                          <td className='px-3 py-2 font-semibold text-slate-700'>{source.matchMode || 'нет данных'}</td>
                          <td className='px-3 py-2 font-semibold text-slate-700'>{source.ok === null ? 'нет данных' : source.ok ? 'ok' : 'error'}</td>
                          <td className='px-3 py-2 font-semibold text-slate-700'>{source.count ?? 'нет данных'}</td>
                          <td className='px-3 py-2 font-semibold text-slate-700'>{source.errorText || 'нет'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className='font-semibold text-slate-500'>checked_sources не пришли в ответе 1С.</p>
              )}
              {links.warnings.length ? (
                <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 font-semibold text-amber-900'>
                  {links.warnings.map((warning) => <p key={warning}>{warning}</p>)}
                </div>
              ) : null}
              {result.diagnostics.length ? (
                <div className='rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700'>
                  {result.diagnostics.map((diagnostic) => <p key={diagnostic}>{diagnostic}</p>)}
                </div>
              ) : null}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function OneCFindingsOverview({
  match,
  linkedDocuments,
  oneCAvailable,
}: {
  match: ReturnType<typeof matchOneCRealizations>;
  linkedDocuments?: OneCSalesRealizationLinksResult;
  oneCAvailable: boolean;
}) {
  const links = linkedDocuments?.links;
  const realizationStatus = findingStatus(Boolean(match.best), Boolean(match.candidates.length), oneCAvailable);
  const unchecked = !oneCAvailable || !links;

  return (
    <div className='rounded-lg border border-slate-200 bg-slate-50 p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h3 className='font-extrabold text-slate-950'>Что найдено в 1С</h3>
          <p className='mt-1 text-sm font-semibold text-slate-500'>Главные документы для проверки этого чека.</p>
        </div>
        {!oneCAvailable ? <Badge className='bg-red-100 text-red-700'>1С недоступна</Badge> : null}
      </div>

      {!oneCAvailable ? (
        <div className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
          Сейчас 1С не подключена, поэтому реализация, ПКО, эквайринг и поступления не проверены.
        </div>
      ) : null}

      <div className='mt-3 grid gap-3 lg:grid-cols-2'>
        <FindingCard title='Реализация 1С' status={realizationStatus}>
          {match.best ? (
            <OneCRealizationMini candidate={match.best} />
          ) : match.candidates.length ? (
            <div className='grid gap-2'>
              {match.candidates.slice(0, 2).map((candidate) => (
                <OneCRealizationMini key={candidate.document.ref || `${candidate.document.number}-${candidate.score}`} candidate={candidate} />
              ))}
            </div>
          ) : (
            <p className='text-sm font-semibold text-slate-500'>Подходящая реализация не найдена.</p>
          )}
        </FindingCard>

        <FindingCard
          title='ПКО / первоначальный взнос'
          status={findingStatus(Boolean(links?.cashReceipts.direct.length), Boolean(links?.cashReceipts.candidates.length), !unchecked)}
        >
          {links ? <LinkedDocumentGroup title='ПКО' group={links.cashReceipts} emptyText='ПКО не найден.' /> : null}
        </FindingCard>

        <FindingCard
          title='Эквайринг'
          status={findingStatus(Boolean(links?.acquiring.direct.length), Boolean(links?.acquiring.candidates.length), !unchecked)}
        >
          {links ? <LinkedDocumentGroup title='Эквайринг' group={links.acquiring} emptyText='Эквайринг не найден.' /> : null}
        </FindingCard>

        <FindingCard
          title='Поступление на счёт'
          status={findingStatus(Boolean(links?.bankReceipts.direct.length), Boolean(links?.bankReceipts.candidates.length), !unchecked)}
        >
          {links ? <LinkedDocumentGroup title='Поступления' group={links.bankReceipts} emptyText='Поступления не найдены.' /> : null}
        </FindingCard>

        <FindingCard
          title='Возврат'
          status={findingStatus(Boolean(links?.returns.direct.length), Boolean(links?.returns.candidates.length), !unchecked)}
        >
          {links ? <LinkedDocumentGroup title='Возвраты' group={links.returns} emptyText='Возвраты не найдены.' /> : null}
        </FindingCard>

        <FindingCard
          title='Корректировка'
          status={findingStatus(Boolean(links?.corrections.direct.length), Boolean(links?.corrections.candidates.length), !unchecked)}
        >
          {links ? <LinkedDocumentGroup title='Корректировки' group={links.corrections} emptyText='Корректировки не найдены.' /> : null}
        </FindingCard>
      </div>
    </div>
  );
}

function OneCMatchBlock({
  ofdCandidate,
  documents,
  realizationLinksByRef,
}: {
  ofdCandidate?: Candidate | ReturnSample;
  documents: OneCSalesRealizationDocument[];
  realizationLinksByRef: Map<string, OneCSalesRealizationLinksResult>;
}) {
  const match = matchOneCRealizations(ofdCandidate, documents);
  const alternatives = match.candidates.filter((candidate) => candidate !== match.best);
  const document = match.best?.document;
  const manager = document ? document.managerName || document.additionalManagerName || document.responsibleName || 'нет данных' : 'нет данных';
  const counterparty = document ? document.counterpartyName || document.partnerName || 'нет данных' : 'нет данных';
  const phrases = humanMatchPhrases(match.best);
  const linkedDocuments = document?.ref ? realizationLinksByRef.get(document.ref) : undefined;

  return (
    <div className='grid gap-3'>
      {match.best ? (
        <div className='rounded-lg border border-blue-200 bg-blue-50 p-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge className='bg-blue-100 text-blue-800'>Найдена возможная реализация 1С</Badge>
            <Badge className='bg-amber-100 text-amber-800'>Требуется ручная проверка</Badge>
          </div>

          <div className='mt-3 grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-4'>
            <div>
              <p className='text-slate-500'>Номер реализации 1С</p>
              <p className='mt-1 text-lg font-extrabold text-slate-950'>{document?.number || document?.ref || 'нет данных'}</p>
            </div>
            <div>
              <p className='text-slate-500'>Дата реализации</p>
              <p className='mt-1 text-slate-950'>{formatDate(document?.date)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Сумма реализации</p>
              <p className='mt-1 text-slate-950'>{formatMoney(document?.amount ?? undefined)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Менеджер из 1С</p>
              <p className='mt-1 text-slate-950'>{manager}</p>
            </div>
            <div>
              <p className='text-slate-500'>Контрагент / партнёр</p>
              <p className='mt-1 text-slate-950'>{counterparty}</p>
            </div>
            <div>
              <p className='text-slate-500'>Разница суммы</p>
              <p className='mt-1 text-slate-950'>{match.best.amountDiff === null ? 'нет данных' : formatMoney(match.best.amountDiff)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Разница дат</p>
              <p className='mt-1 text-slate-950'>{match.best.dayDiff ?? 'нет данных'} дн.</p>
            </div>
            <div>
              <p className='text-slate-500'>Совпавших товаров</p>
              <p className='mt-1 text-slate-950'>{match.best.matchedProducts}</p>
            </div>
          </div>

          <div className='mt-3 flex flex-wrap gap-2'>
            {phrases.map((phrase) => (
              <Badge key={phrase} className={phrase.includes('не совпал') || phrase.includes('не совпала') ? 'bg-red-100 text-red-700' : phrase.includes('Дата отличается') ? 'bg-amber-100 text-amber-800' : 'bg-white text-slate-700'}>
                {phrase}
              </Badge>
            ))}
          </div>

          <div className='mt-4'>
            <p className='mb-2 text-sm font-extrabold text-slate-950'>Товары реализации 1С</p>
            <OneCItemsList document={match.best.document} />
          </div>
        </div>
      ) : (
        <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
          Возможная реализация 1С не найдена в полученном read-only списке. Требуется ручная проверка.
        </div>
      )}
      <OneCLinkedDocumentsBlock result={linkedDocuments} />
      <details className='rounded-lg border border-slate-200 bg-white p-4 text-sm'>
        <summary className='cursor-pointer font-extrabold text-slate-950'>Показать технические детали 1С-сопоставления</summary>
        <div className='mt-3 grid gap-3'>
          {match.best ? <OneCCandidateCard candidate={match.best} /> : null}
          {alternatives.length ? (
            <div className='grid gap-3'>
              <p className='text-sm font-extrabold text-slate-950'>Другие похожие 1С-кандидаты</p>
              {alternatives.map((candidate) => (
                <OneCCandidateCard key={candidate.document.ref || `${candidate.document.number}-${candidate.score}`} candidate={candidate} rejected />
              ))}
            </div>
          ) : null}
        </div>
      </details>
    </div>
  );
}

function ReturnCard({
  sample,
  oneCDocuments,
  realizationLinksByRef,
  oneCAvailable,
}: {
  sample: ReturnSample;
  oneCDocuments: OneCSalesRealizationDocument[];
  realizationLinksByRef: Map<string, OneCSalesRealizationLinksResult>;
  oneCAvailable: boolean;
}) {
  const bestCandidate = sample.possibleOriginalCandidates?.[0];
  const isReturn = sample.operationType === 2;
  const matchingTarget = isReturn ? bestCandidate ?? sample : sample;
  const oneCMatch = matchOneCRealizations(matchingTarget, oneCDocuments);
  const oneCDocument = oneCMatch.best?.document;
  const manager = oneCDocument ? oneCDocument.managerName || oneCDocument.additionalManagerName || oneCDocument.responsibleName || 'нет данных' : 'нет данных';
  const counterparty = oneCDocument ? oneCDocument.counterpartyName || oneCDocument.partnerName || 'нет данных' : 'нет данных';
  const linkedDocuments = oneCDocument?.ref ? realizationLinksByRef.get(oneCDocument.ref) : undefined;
  const links = linkedDocuments?.links;
  const hasCashReceipt = Boolean(links?.cashReceipts.direct.length);
  const hasCashCandidates = Boolean(links?.cashReceipts.candidates.length);
  const hasAcquiring = Boolean(links?.acquiring.direct.length);
  const hasAcquiringCandidates = Boolean(links?.acquiring.candidates.length);
  const hasBankReceipts = Boolean(links?.bankReceipts.direct.length);
  const hasBankReceiptCandidates = Boolean(links?.bankReceipts.candidates.length);
  const status = mainCheckStatus(oneCMatch, oneCAvailable);
  const explanation = !oneCAvailable
    ? 'Сейчас 1С не подключена, поэтому документы по этому чеку не проверены.'
    : oneCMatch.best
      ? 'Портал нашёл подходящую реализацию 1С и подтянул менеджера, контрагента и товары. Проверьте связанные документы ниже.'
      : 'Портал не нашёл подходящую реализацию 1С в загруженном списке. Оставьте чек на ручной проверке.';

  return (
    <Card className='p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <ShieldAlert className='h-5 w-5 text-amber-600' />
          <h2 className='text-xl font-extrabold text-slate-950'>{humanCheckType(sample)}</h2>
          <Badge className={status.className}>{status.text}</Badge>
          <Badge className='bg-amber-100 text-amber-800'>ручная проверка</Badge>
        </div>
        <p className='mt-1 text-sm font-semibold text-slate-500'>{explanation}</p>
      </div>

      <div className='grid gap-4 border-b border-slate-200/80 bg-slate-50 px-5 py-4 lg:grid-cols-2'>
        <div className='rounded-lg border border-slate-200 bg-white p-4'>
          <p className='text-sm font-extrabold text-slate-950'>Чек OFD</p>
          <div className='mt-3 grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2'>
            <div>
              <p className='text-slate-500'>Дата</p>
              <p className='mt-1 text-slate-950'>{formatDate(sample.date)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Сумма</p>
              <p className='mt-1 text-slate-950'>{formatOfdMoney(sample.totalSum)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Тип операции</p>
              <p className='mt-1 text-slate-950'>{operationLabel(sample)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Товар</p>
              <p className='mt-1 text-slate-950'>{primaryItemName(sample.itemsPreview)}</p>
            </div>
          </div>
        </div>

        <div className={oneCMatch.best ? 'rounded-lg border border-green-200 bg-white p-4' : 'rounded-lg border border-amber-200 bg-white p-4'}>
          <p className='text-sm font-extrabold text-slate-950'>Реализация 1С</p>
          <div className='mt-3 grid gap-3 text-sm font-semibold text-slate-700 sm:grid-cols-2'>
            <div>
              <p className='text-slate-500'>Номер</p>
              <p className='mt-1 text-slate-950'>{oneCDocument?.number || oneCDocument?.ref || 'не найдена'}</p>
            </div>
            <div>
              <p className='text-slate-500'>Дата</p>
              <p className='mt-1 text-slate-950'>{formatDate(oneCDocument?.date)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Сумма</p>
              <p className='mt-1 text-slate-950'>{formatMoney(oneCDocument?.amount ?? undefined)}</p>
            </div>
            <div>
              <p className='text-slate-500'>Менеджер</p>
              <p className='mt-1 text-slate-950'>{manager}</p>
            </div>
            <div className='sm:col-span-2'>
              <p className='text-slate-500'>Контрагент</p>
              <p className='mt-1 text-slate-950'>{counterparty}</p>
            </div>
          </div>
          <div className='mt-2 flex flex-wrap gap-2'>
            {simpleMatchPhrases(oneCMatch.best).map((phrase) => (
              <Badge key={phrase} className={phrase.includes('не совпал') || phrase.includes('не найдена') || phrase.includes('сильно') ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                {phrase}
              </Badge>
            ))}
            <Badge className={hasCashReceipt ? 'bg-green-100 text-green-800' : hasCashCandidates ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
              {hasCashReceipt ? 'ПКО найден' : hasCashCandidates ? 'Есть кандидаты ПКО' : 'ПКО не найден'}
            </Badge>
            <Badge className={hasAcquiring ? 'bg-green-100 text-green-800' : hasAcquiringCandidates ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
              {hasAcquiring ? 'Эквайринг найден' : hasAcquiringCandidates ? 'Есть кандидаты эквайринга' : 'Эквайринг не найден'}
            </Badge>
            <Badge className={hasBankReceipts ? 'bg-green-100 text-green-800' : hasBankReceiptCandidates ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}>
              {hasBankReceipts ? 'Поступление найдено' : hasBankReceiptCandidates ? 'Есть кандидаты поступлений' : 'Поступления не найдены'}
            </Badge>
          </div>
        </div>
      </div>

      <div className='grid gap-4 px-5 py-4 md:grid-cols-4'>
        <div>
          <p className='text-sm font-bold text-slate-500'>Товар</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{primaryItemName(sample.itemsPreview)}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Сумма чека</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{formatOfdMoney(sample.totalSum)}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Дата продажи/возврата</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{formatDate(sample.date)}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Разница прихода и возврата</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{isReturn && bestCandidate ? formatSeconds(bestCandidate.timeDeltaSeconds) : 'не применимо'}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Реализация 1С</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{oneCDocument?.number || oneCDocument?.ref || 'не найдена'}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Менеджер из 1С</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{manager}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Контрагент / партнёр</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{counterparty}</p>
        </div>
        <div>
          <p className='text-sm font-bold text-slate-500'>Итог</p>
          <p className='mt-1 text-lg font-extrabold text-amber-700'>Автоматически не закрывается</p>
        </div>
      </div>

      <div className='grid gap-5 px-5 py-4'>
        <div>
          <p className='mb-2 text-sm font-extrabold text-slate-950'>Товары OFD</p>
          <OfdItemsSummary items={sample.itemsPreview} />
        </div>

        {isReturn && bestCandidate ? (
          <div className='rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-900'>
            <div className='flex items-center gap-2 font-extrabold text-green-950'>
              <ArrowRight className='h-4 w-4 text-green-700' />
              Возврат похож на найденную продажу
            </div>
            <p className='mt-1'>Сумма и товар похожи, возврат позже продажи на {formatSeconds(bestCandidate.timeDeltaSeconds)}. Автоматически не закрывается.</p>
          </div>
        ) : isReturn ? (
          <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
            Кандидат исходного прихода не найден. Статус остаётся needs_review.
          </div>
        ) : null}

        <OneCFindingsOverview match={oneCMatch} linkedDocuments={linkedDocuments} oneCAvailable={oneCAvailable} />
        <ActionPlanBlock hasMatch={Boolean(oneCMatch.best)} />

        <details className='rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm'>
          <summary className='cursor-pointer font-extrabold text-slate-950'>Технические детали</summary>
          <div className='mt-4 grid gap-4'>
            <OneCMatchBlock ofdCandidate={matchingTarget} documents={oneCDocuments} realizationLinksByRef={realizationLinksByRef} />
            <div className='grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-5'>
              <div>
                <p className='text-slate-500'>ФД</p>
                <p className='mt-1 text-slate-950'>{sample.fiscalDocumentNumber || 'нет данных'}</p>
              </div>
              <div>
                <p className='text-slate-500'>ФН</p>
                <p className='mt-1 break-all text-slate-950'>{sample.fiscalDriveNumber || 'нет данных'}</p>
              </div>
              <div>
                <p className='text-slate-500'>ФПД / фискальный признак</p>
                <p className='mt-1 break-all text-slate-950'>{sample.fiscalSign || 'нет данных'}</p>
              </div>
              <div>
                <p className='text-slate-500'>operationType</p>
                <p className='mt-1 text-slate-950'>{sample.operationType ?? 'нет данных'}</p>
              </div>
              <div>
                <p className='text-slate-500'>raw status</p>
                <p className='mt-1 text-slate-950'>{sample.matchingStatus || 'not_found'}</p>
              </div>
            </div>

            <div className='grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 md:grid-cols-5'>
              <div>
                <p className='text-slate-500'>cashTotalSum</p>
                <p className='mt-1 text-slate-950'>{formatOfdMoney(sample.cashTotalSum)}</p>
              </div>
              <div>
                <p className='text-slate-500'>ecashTotalSum</p>
                <p className='mt-1 text-slate-950'>{formatOfdMoney(sample.ecashTotalSum)}</p>
              </div>
              <div>
                <p className='text-slate-500'>creditSum</p>
                <p className='mt-1 text-slate-950'>{formatOfdMoney(sample.creditSum)}</p>
              </div>
              <div>
                <p className='text-slate-500'>paymentType raw</p>
                <p className='mt-1 break-all text-slate-950'>{sample.rawPaymentTypes?.map((item) => String(item)).join(', ') || 'нет данных'}</p>
              </div>
              <div>
                <p className='text-slate-500'>paymentType normalized</p>
                <p className='mt-1 break-all text-slate-950'>{sample.normalizedPaymentTypes?.map((item) => String(item)).join(', ') || 'нет данных'}</p>
              </div>
            </div>

            {sample.issues?.length ? (
              <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
                <p className='font-extrabold text-amber-950'>OFD issues / diagnostics</p>
                <div className='mt-2 flex flex-wrap gap-2'>
                  {sample.issues.map((issue, index) => (
                    <Badge key={`${issue.code}-${index}`} className='bg-white text-amber-900'>
                      {issue.code || issue.severity || 'needs_review'}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {isReturn && bestCandidate ? (
              <div>
                <p className='mb-2 text-sm font-extrabold text-slate-950'>Технический кандидат исходного прихода</p>
                <CandidateCard candidate={bestCandidate} />
              </div>
            ) : null}

            {isReturn && sample.rejectedCandidates?.length ? (
              <div>
                <p className='mb-2 text-sm font-extrabold text-slate-950'>Отклонённые похожие кандидаты</p>
                <div className='grid gap-3'>
                  {sample.rejectedCandidates.map((candidate) => (
                    <CandidateCard key={`${candidate.fiscalDocumentNumber}-${candidate.fiscalSign}`} candidate={candidate} rejected />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </details>
      </div>
    </Card>
  );
}

export default async function AdminOfdPage({
  searchParams,
}: {
  searchParams?: { organizationInn?: string; dateFrom?: string; dateTo?: string; limit?: string };
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const organizationInn = searchParams?.organizationInn?.trim() || DEFAULT_INN;
  const periodPresets = getPeriodPresets();
  const defaultPeriod = periodPresets.find((preset) => preset.id === 'last-30-days')!;
  const requestedDateFrom = searchParams?.dateFrom?.trim();
  const requestedDateTo = searchParams?.dateTo?.trim();
  const hasCustomDates = isDateParam(requestedDateFrom) && isDateParam(requestedDateTo);
  const dateFrom = hasCustomDates ? requestedDateFrom! : defaultPeriod.dateFrom;
  const dateTo = hasCustomDates ? requestedDateTo! : defaultPeriod.dateTo;
  const selectedPreset = periodPresets.find((preset) => preset.dateFrom === dateFrom && preset.dateTo === dateTo);
  const selectedPeriodLabel = selectedPreset?.label ?? 'Произвольный период';
  const parsedLimit = Number(searchParams?.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.trunc(parsedLimit), 100) : DEFAULT_LIMIT;
  const createPeriodHref = (period: Pick<PeriodPreset, 'dateFrom' | 'dateTo'>) => {
    const params = new URLSearchParams({
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      organizationInn,
      limit: String(limit),
    });
    return `/admin/ofd?${params.toString()}`;
  };
  const [probe, salesRealizations] = await Promise.all([
    safeRunSabyOfdProbe({ organizationInn, dateFrom, dateTo, limit }),
    safeGetSalesRealizations({
      ...DEFAULT_SALES_REALIZATIONS_PARAMS,
      dateFrom,
      dateTo,
      limit: 100,
      offset: 0,
      includeLines: true,
    }),
  ]);
  const diagnostics = probe.returnDiagnostics;
  const receiptDiagnostics = probe.receiptDiagnostics;
  const samples = receiptDiagnostics?.samples ?? diagnostics?.samples ?? [];
  const oneCAvailable = salesRealizations.ok;
  const oneCDocuments = salesRealizations.ok ? salesRealizations.documents : [];
  const matchedRealizationRefs = Array.from(new Set(samples
    .map((sample) => {
      return matchOneCRealizations(matchingTargetForSample(sample), oneCDocuments).best?.document.ref;
    })
    .filter((ref): ref is string => Boolean(ref))));
  const realizationLinksResults = await Promise.all(matchedRealizationRefs.map((ref) => safeGetSalesRealizationLinks(ref)));
  const realizationLinksByRef = new Map(realizationLinksResults.map((result) => [result.realizationRef, result]));
  const sampleMatches = samples.map((sample) => matchOneCRealizations(matchingTargetForSample(sample), oneCDocuments));
  const oneCMatchesCount = sampleMatches.filter((match) => Boolean(match.best)).length;
  const manualReviewCount = samples.length;
  const notFoundCount = samples.length - oneCMatchesCount;
  const issueOrWarningCount =
    (probe.errors?.length ?? 0) +
    samples.reduce((total, sample) => total + (sample.issues?.length ?? 0), 0) +
    realizationLinksResults.reduce((total, result) => total + countLinkWarnings(result), 0);

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Проверка OFD и 1С' />

      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>Проверка чеков SABY/OFD и реализаций 1С</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Это только диагностика. Ошибки не закрываются автоматически, документы и база не меняются.</p>
        </div>
        <Badge className={probe.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
          {probe.ok ? 'Диагностика работает' : 'Нужна проверка'}
        </Badge>
      </div>

      <Card className='mb-5'>
        <div className='flex flex-col gap-4'>
          <div className='flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between'>
            <div>
              <h2 className='font-extrabold text-slate-950'>Период проверки</h2>
              <p className='mt-1 text-sm font-semibold text-slate-600'>
                Выбрано: <span className='text-slate-950'>{selectedPeriodLabel}</span> · {dateFrom} — {dateTo}
              </p>
            </div>
            <Badge className='w-fit bg-slate-100 text-slate-700'>{dateFrom} — {dateTo}</Badge>
          </div>

          <nav aria-label='Быстрый выбор периода' className='flex flex-wrap gap-2'>
            {periodPresets.map((preset) => {
              const isSelected = preset.id === selectedPreset?.id;
              return (
                <Link
                  key={preset.id}
                  href={createPeriodHref(preset)}
                  className={isSelected
                    ? 'rounded-md bg-slate-950 px-3 py-2 text-sm font-bold text-white'
                    : 'rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-slate-400 hover:bg-slate-50'}
                >
                  {preset.label}
                </Link>
              );
            })}
          </nav>

          <form action='/admin/ofd' method='get' className='grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end'>
            <input type='hidden' name='organizationInn' value={organizationInn} />
            <input type='hidden' name='limit' value={limit} />
            <label className='grid gap-1 text-sm font-bold text-slate-700'>
              Дата с
              <input
                type='date'
                name='dateFrom'
                defaultValue={dateFrom}
                max={dateTo}
                className='h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950'
              />
            </label>
            <label className='grid gap-1 text-sm font-bold text-slate-700'>
              Дата по
              <input
                type='date'
                name='dateTo'
                defaultValue={dateTo}
                min={dateFrom}
                className='h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-950'
              />
            </label>
            <button type='submit' className='h-10 rounded-md bg-green-700 px-4 text-sm font-extrabold text-white transition-colors hover:bg-green-800'>
              Применить период
            </button>
          </form>
        </div>
      </Card>

      <section className='mb-5 grid gap-4 md:grid-cols-4'>
        <Card>
          <p className='text-sm font-bold text-slate-500'>Чеков проверено</p>
          <p className='mt-1 text-3xl font-extrabold text-slate-950'>{samples.length}</p>
          <p className='mt-1 text-xs font-bold text-slate-500'>период {dateFrom} — {dateTo}</p>
        </Card>
        <Card>
          <p className='text-sm font-bold text-slate-500'>Совпадений с 1С</p>
          <p className='mt-1 text-3xl font-extrabold text-green-700'>{oneCMatchesCount}</p>
          <p className='mt-1 text-xs font-bold text-slate-500'>из {oneCDocuments.length} реализаций 1С</p>
        </Card>
        <Card>
          <p className='text-sm font-bold text-slate-500'>Ручная проверка</p>
          <p className='mt-1 text-3xl font-extrabold text-amber-700'>{manualReviewCount}</p>
          <p className='mt-1 text-xs font-bold text-slate-500'>автозакрытия нет</p>
        </Card>
        <Card>
          <p className='text-sm font-bold text-slate-500'>{oneCAvailable ? 'Ошибки / предупреждения' : '1С недоступна'}</p>
          <p className={oneCAvailable ? 'mt-1 text-3xl font-extrabold text-red-700' : 'mt-1 text-3xl font-extrabold text-amber-700'}>
            {oneCAvailable ? issueOrWarningCount : 'нет связи'}
          </p>
          <p className='mt-1 text-xs font-bold text-slate-500'>{oneCAvailable ? `не найдено в 1С: ${notFoundCount}` : 'документы не проверены'}</p>
        </Card>
      </section>

      <Card className='mb-5'>
        <div className='grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-4'>
          <div>
            <p className='text-slate-500'>Организация</p>
            <p className='mt-1 break-all text-slate-950'>{organizationInn}</p>
          </div>
          <div>
            <p className='text-slate-500'>Реализаций из 1С загружено</p>
            <p className='mt-1 text-slate-950'>{oneCDocuments.length}</p>
          </div>
          <div>
            <p className='text-slate-500'>Статус 1С</p>
            <p className='mt-1 text-slate-950'>{salesRealizations.ok ? '1С отвечает' : '1С недоступна'}</p>
          </div>
          <div>
            <p className='text-slate-500'>Как ищем совпадение</p>
            <p className='mt-1 text-slate-950'>по сумме, товару и дате</p>
          </div>
        </div>
      </Card>

      <Card className='mb-5 border-amber-200 bg-amber-50'>
        <div className='flex gap-3'>
          <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
          <div>
            <h2 className='font-extrabold text-amber-950'>Ручная проверка обязательна</h2>
            <p className='mt-1 text-sm font-semibold text-amber-900'>
              Страница помогает понять, какой чек OFD похож на какую реализацию 1С. Даже при хорошем совпадении статус остаётся “требуется ручная проверка”.
            </p>
          </div>
        </div>
      </Card>

      {probe.errors?.length ? (
        <Card className='mb-5 border-red-200 bg-red-50'>
          <h2 className='font-extrabold text-red-950'>Ошибки probe</h2>
          <ul className='mt-2 grid gap-1 text-sm font-semibold text-red-800'>
            {probe.errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        </Card>
      ) : null}

      {!salesRealizations.ok ? (
        <Card className='mb-5 border-amber-200 bg-amber-50'>
          <h2 className='font-extrabold text-amber-950'>1С сейчас не подключена</h2>
          <p className='mt-2 text-sm font-semibold text-amber-900'>
            Реализация, ПКО, эквайринг и поступления не проверены. Можно смотреть только OFD-часть диагностики.
          </p>
          {salesRealizations.diagnostics.length ? (
            <details className='mt-3 rounded-lg border border-amber-200 bg-white p-3 text-sm'>
              <summary className='cursor-pointer font-extrabold text-amber-950'>Технические детали</summary>
              <ul className='mt-2 grid gap-1 font-semibold text-amber-900'>
                {salesRealizations.error ? <li>{salesRealizations.error}</li> : null}
                {salesRealizations.diagnostics.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </details>
          ) : null}
        </Card>
      ) : null}

      <section className='grid gap-5'>
        {samples.length ? (
          samples.map((sample) => (
            <ReturnCard
              key={`${sample.fiscalDocumentNumber}-${sample.fiscalSign}`}
              sample={sample}
              oneCDocuments={oneCDocuments}
              realizationLinksByRef={realizationLinksByRef}
              oneCAvailable={oneCAvailable}
            />
          ))
        ) : (
          <Card className='flex min-h-48 flex-col items-center justify-center text-center'>
            <FileSearch className='mb-3 h-9 w-9 text-slate-400' />
            <p className='font-extrabold text-slate-950'>За выбранный период чеки не найдены.</p>
            <p className='mt-1 text-sm font-semibold text-slate-500'>Выберите другой период или проверьте настройки OFD в технических деталях.</p>
          </Card>
        )}
      </section>
    </AdminShell>
  );
}
