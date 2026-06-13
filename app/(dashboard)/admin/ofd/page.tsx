import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowRight, FileSearch, ShieldAlert } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { runSabyOfdProbe } from '@/lib/saby-ofd';
import { DEFAULT_SALES_REALIZATIONS_PARAMS, getSalesRealizations, type OneCSalesRealizationDocument } from '@/lib/one-c';

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
  operationType?: number;
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
  errors?: string[];
};

const DEFAULT_INN = '071306665560';
const DEFAULT_DATE_FROM = '2026-04-13';
const DEFAULT_DATE_TO = '2026-06-13';
const DEFAULT_LIMIT = 50;

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

function reasonLabel(reason: string) {
  const labels: Record<string, string> = {
    same_fn: 'совпал ФН',
    same_total_sum: 'совпала сумма',
    same_items: 'совпали товары',
    return_after_sale: 'возврат позже прихода',
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

function matchOneCRealizations(ofdCandidate: Candidate | undefined, documents: OneCSalesRealizationDocument[]) {
  if (!ofdCandidate) return { best: null as OneCCandidate | null, rejected: [] as OneCCandidate[] };

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

  const best = scored.find((candidate) => candidate.confidence !== 'rejected') ?? null;
  const rejected = scored.filter((candidate) => candidate !== best).slice(0, 5);
  return { best, rejected };
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
        {rejected ? candidate.rejectedReasons.map((reason) => <Badge key={reason} className='bg-red-100 text-red-700'>{reason}</Badge>) : null}
      </div>

      <div className='mt-4'>
        <p className='mb-2 text-sm font-extrabold text-slate-950'>Товары реализации 1С</p>
        <OneCItemsList document={document} />
      </div>
    </div>
  );
}

function OneCMatchBlock({ ofdCandidate, documents }: { ofdCandidate?: Candidate; documents: OneCSalesRealizationDocument[] }) {
  const match = matchOneCRealizations(ofdCandidate, documents);

  return (
    <div className='grid gap-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='text-sm font-extrabold text-slate-950'>Связка OFD ↔ 1С</p>
        <Badge className='bg-amber-100 text-amber-800'>needs_review</Badge>
      </div>
      {match.best ? (
        <OneCCandidateCard candidate={match.best} />
      ) : (
        <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
          Возможная реализация 1С не найдена в полученном read-only списке.
        </div>
      )}
      {match.rejected.length ? (
        <div className='grid gap-3'>
          <p className='text-sm font-extrabold text-slate-950'>Отклонённые похожие 1С-кандидаты</p>
          {match.rejected.map((candidate) => (
            <OneCCandidateCard key={candidate.document.ref || `${candidate.document.number}-${candidate.score}`} candidate={candidate} rejected />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ReturnCard({ sample, oneCDocuments }: { sample: ReturnSample; oneCDocuments: OneCSalesRealizationDocument[] }) {
  const bestCandidate = sample.possibleOriginalCandidates?.[0];

  return (
    <Card className='p-0'>
      <div className='border-b border-slate-200/80 px-5 py-4'>
        <div className='flex flex-wrap items-center gap-2'>
          <ShieldAlert className='h-5 w-5 text-amber-600' />
          <h2 className='text-xl font-extrabold text-slate-950'>Возврат прихода ФД {sample.fiscalDocumentNumber || 'нет данных'}</h2>
          <Badge className='bg-amber-100 text-amber-800'>needs_review</Badge>
          <Badge className='bg-slate-100 text-slate-700'>{sample.matchingStatus || 'not_found'}</Badge>
        </div>
        <p className='mt-1 text-sm font-semibold text-slate-500'>Только диагностика. Никакого автоматического закрытия ошибок.</p>
      </div>

      <div className='grid gap-3 px-5 py-4 text-sm font-semibold text-slate-700 md:grid-cols-5'>
        <div>
          <p className='text-slate-500'>Дата/время возврата</p>
          <p className='mt-1 text-slate-950'>{formatDate(sample.date)}</p>
        </div>
        <div>
          <p className='text-slate-500'>Сумма</p>
          <p className='mt-1 text-slate-950'>{formatOfdMoney(sample.totalSum)}</p>
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
      </div>

      <div className='grid gap-5 px-5 py-4'>
        <div>
          <p className='mb-2 text-sm font-extrabold text-slate-950'>Товары возврата</p>
          <ItemsList items={sample.itemsPreview} />
        </div>

        {bestCandidate ? (
          <div>
            <div className='mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-950'>
              <ArrowRight className='h-4 w-4 text-green-700' />
              Лучший кандидат исходного прихода
            </div>
            <CandidateCard candidate={bestCandidate} />
            <div className='mt-4'>
              <OneCMatchBlock ofdCandidate={bestCandidate} documents={oneCDocuments} />
            </div>
          </div>
        ) : (
          <div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900'>
            Кандидат исходного прихода не найден. Статус остаётся needs_review.
          </div>
        )}

        {sample.rejectedCandidates?.length ? (
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
  const dateFrom = searchParams?.dateFrom?.trim() || DEFAULT_DATE_FROM;
  const dateTo = searchParams?.dateTo?.trim() || DEFAULT_DATE_TO;
  const parsedLimit = Number(searchParams?.limit ?? DEFAULT_LIMIT);
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.trunc(parsedLimit), 100) : DEFAULT_LIMIT;
  const [probe, salesRealizations] = await Promise.all([
    runSabyOfdProbe({ organizationInn, dateFrom, dateTo, limit }) as Promise<OfdProbeResult>,
    getSalesRealizations({
      ...DEFAULT_SALES_REALIZATIONS_PARAMS,
      dateFrom,
      dateTo,
      limit: 100,
      offset: 0,
      includeLines: true,
    }),
  ]);
  const diagnostics = probe.returnDiagnostics;
  const samples = diagnostics?.samples ?? [];
  const oneCDocuments = salesRealizations.ok ? salesRealizations.documents : [];

  return (
    <AdminShell>
      <AdminBreadcrumbs current='SABY OFD probe' />

      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>SABY OFD probe</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Read-only диагностика возвратов прихода и кандидатов исходного чека.</p>
        </div>
        <Badge className={probe.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
          {probe.ok ? 'OK' : 'диагностика'}
        </Badge>
      </div>

      <section className='mb-5 grid gap-4 md:grid-cols-5'>
        <Card>
          <p className='text-sm font-bold text-slate-500'>Период</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{dateFrom} — {dateTo}</p>
        </Card>
        <Card>
          <p className='text-sm font-bold text-slate-500'>ИНН</p>
          <p className='mt-1 break-all text-lg font-extrabold text-slate-950'>{organizationInn}</p>
        </Card>
        <Card>
          <p className='text-sm font-bold text-slate-500'>Возвратов проверено</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{diagnostics?.returnDocumentsChecked ?? 0}</p>
        </Card>
        <Card>
          <p className='text-sm font-bold text-slate-500'>Прямых ссылок</p>
          <p className='mt-1 text-lg font-extrabold text-slate-950'>{diagnostics?.foundDirectLinks ?? 0}</p>
        </Card>
      </section>

      <Card className='mb-5'>
        <div className='grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-4'>
          <div>
            <p className='text-slate-500'>1C endpoint</p>
            <p className='mt-1 text-slate-950'>/sales-realizations</p>
          </div>
          <div>
            <p className='text-slate-500'>1C documents loaded</p>
            <p className='mt-1 text-slate-950'>{oneCDocuments.length}</p>
          </div>
          <div>
            <p className='text-slate-500'>1C status</p>
            <p className='mt-1 text-slate-950'>{salesRealizations.ok ? 'OK' : 'diagnostics'}</p>
          </div>
          <div>
            <p className='text-slate-500'>1C matching mode</p>
            <p className='mt-1 text-slate-950'>amount + date + products</p>
          </div>
        </div>
      </Card>

      <Card className='mb-5 border-amber-200 bg-amber-50'>
        <div className='flex gap-3'>
          <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
          <div>
            <h2 className='font-extrabold text-amber-950'>Ручная проверка обязательна</h2>
            <p className='mt-1 text-sm font-semibold text-amber-900'>
              Эта страница только показывает diagnostics из probe. Ошибки приходов не закрываются автоматически, БД не меняется.
            </p>
            {diagnostics?.conclusion ? <p className='mt-2 text-sm font-semibold text-amber-900'>{diagnostics.conclusion}</p> : null}
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
          <h2 className='font-extrabold text-amber-950'>1C sales-realizations unavailable</h2>
          <p className='mt-2 text-sm font-semibold text-amber-900'>{salesRealizations.error ?? '1C diagnostics returned a non-standard response.'}</p>
          {salesRealizations.diagnostics.length ? (
            <ul className='mt-2 grid gap-1 text-sm font-semibold text-amber-900'>
              {salesRealizations.diagnostics.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <section className='grid gap-5'>
        {samples.length ? (
          samples.map((sample) => <ReturnCard key={`${sample.fiscalDocumentNumber}-${sample.fiscalSign}`} sample={sample} oneCDocuments={oneCDocuments} />)
        ) : (
          <Card className='flex min-h-48 flex-col items-center justify-center text-center'>
            <FileSearch className='mb-3 h-9 w-9 text-slate-400' />
            <p className='font-extrabold text-slate-950'>Возвраты прихода не найдены</p>
            <p className='mt-1 text-sm font-semibold text-slate-500'>В выбранном sample probe нет документов возврата для ручной диагностики.</p>
          </Card>
        )}
      </section>
    </AdminShell>
  );
}
