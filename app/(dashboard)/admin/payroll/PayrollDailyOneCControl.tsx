'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';

type PurchaseRow = {
  supplierName: string;
  organizationName: string;
  currency: string;
  debtIncrease: number;
  sourceRows: number;
  ruleId: number | null;
  status: 'APPROVED' | 'EXCLUDED' | 'NEW';
  includedInPayrollBase: boolean;
};

export type DailyControlResponse = {
  ok: true;
  mode: 'control';
  affectsPayroll: false;
  readyForControl: boolean;
  period: {
    periodKey: string;
    dateFrom: string;
    verifiedThrough: string;
    candidateDate: string;
    usingPreviousClose: boolean;
  };
  close: {
    ready: boolean;
    finishedAt: string | null;
    costDocument: string | null;
  };
  source: {
    checkedAt: string;
    extractedAt: string;
    pages: number;
  };
  sales: {
    rows?: Array<{
      manager: string;
      managerRef: string;
      client: string;
      clientRef: string;
      category: string;
      categoryRef: string;
      item: string;
      productRef: string;
      article: string;
      quantity: number;
      revenue: number;
      cost: number;
      grossProfit: number;
      sourceRows: number;
      costReviewRows: number;
      costCalculationPendingRows: number;
    }>;
    summary: {
      sourceRows: number;
      normalizedRows: number;
      managerCount: number;
      revenue: number;
      cost: number;
      grossProfit: number;
      costReviewRows: number;
      costCalculationPendingRows: number;
    };
  };
  purchases: {
    rows: PurchaseRow[];
    approvedBase: number;
    approvedSupplierCount: number;
    excludedSupplierCount: number;
    newSupplierCount: number;
    ready: boolean;
    attribution: {
      contractVersion: 'payroll-purchase-attribution-v1';
      employeeName: string;
      documentCount: number;
      reviewDocumentCount: number;
      ignoredOtherDocumentCount: number;
    };
  };
  snapshot: {
    storage: 'server';
    servedFrom: 'stored' | 'refreshed';
    kind: 'DAILY' | 'FINAL';
    rollingDays: number;
    storedThrough: string;
    storedAt: string;
    refreshedDates: string[];
    finalReconciled: boolean;
  };
  blockingIssues: string[];
};

type FailedControlResponse = {
  ok: false;
  error?: string;
  blockingIssues?: string[];
  checkedAt?: string;
};

const FULL_RESPONSE_MEMORY_TTL_MS = 30 * 60 * 1000;
const FULL_RESPONSE_MEMORY_LIMIT = 3;
const fullResponseMemory = new Map<string, { response: DailyControlResponse; savedAt: number }>();

function readFullResponseFromMemory(periodKey: string) {
  const cached = fullResponseMemory.get(periodKey);
  if (!cached) return null;
  if (Date.now() - cached.savedAt > FULL_RESPONSE_MEMORY_TTL_MS) {
    fullResponseMemory.delete(periodKey);
    return null;
  }
  return cached.response;
}

function rememberFullResponse(periodKey: string, response: DailyControlResponse) {
  if (!Array.isArray(response.sales.rows)) return;
  fullResponseMemory.delete(periodKey);
  fullResponseMemory.set(periodKey, { response, savedAt: Date.now() });
  while (fullResponseMemory.size > FULL_RESPONSE_MEMORY_LIMIT) {
    const oldestKey = fullResponseMemory.keys().next().value as string | undefined;
    if (!oldestKey) break;
    fullResponseMemory.delete(oldestKey);
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');
  return `${day}.${month}.${year}`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value));
}

function readCached(periodKey: string) {
  try {
    const value = window.localStorage.getItem(`payroll-one-c-last-good-v3-${periodKey}`);
    if (!value) return null;
    const parsed = JSON.parse(value) as DailyControlResponse;
    return parsed?.ok === true
      && parsed.purchases?.attribution?.contractVersion === 'payroll-purchase-attribution-v1'
      && parsed.snapshot?.storage === 'server'
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function readControlResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as DailyControlResponse | FailedControlResponse;
  } catch {
    return null;
  }
}

function getFriendlyLoadError(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : '';
  if (!message || /unexpected|failed to fetch|json|network/i.test(message)) {
    return 'Не удалось получить ответ от 1С. Попробуйте повторить проверку позже.';
  }
  return message;
}

export function PayrollDailyOneCControl({
  month,
  year,
  compactWhenUnavailable = false,
  onDataChange,
}: {
  month: string;
  year: string;
  compactWhenUnavailable?: boolean;
  onDataChange?: (data: DailyControlResponse | null, state: { isStale: boolean }) => void;
}) {
  const periodKey = `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
  const initialMemoryResponse = readFullResponseFromMemory(periodKey);
  const [data, setData] = useState<DailyControlResponse | null>(initialMemoryResponse);
  const [error, setError] = useState('');
  const [isStale, setIsStale] = useState(Boolean(initialMemoryResponse));
  const [isLoading, setIsLoading] = useState(true);
  const [actionSupplier, setActionSupplier] = useState('');
  const requestVersion = useRef(0);
  const belongsToSelectedPeriod = useCallback(
    (response: DailyControlResponse | null | undefined) => Boolean(response?.period.verifiedThrough.startsWith(`${periodKey}-`)),
    [periodKey],
  );

  const load = useCallback(async (force = false) => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setIsLoading(true);
    try {
      const query = `year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
      let restoredStoredResponse = false;
      const storedResponse = await fetch(`/api/admin/payroll/daily-control?${query}`, { cache: 'no-store' });
      if (storedResponse.ok) {
        const storedBody = await readControlResponse(storedResponse);
        if (storedBody?.ok && belongsToSelectedPeriod(storedBody)) {
          if (requestVersion.current !== version) return;
          rememberFullResponse(periodKey, storedBody);
          setData(storedBody);
          setError('');
          setIsStale(false);
          restoredStoredResponse = true;
        }
      }
      if (restoredStoredResponse && !force) {
        // Let React render the saved server snapshot before the slower 1C refresh starts.
        // The refresh remains read-only and replaces the snapshot only after a valid response.
        setIsLoading(false);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
        if (requestVersion.current !== version) return;
      }
      const response = await fetch(`/api/admin/payroll/daily-control?${query}${force ? '&force=1' : ''}`, {
        method: 'POST', cache: 'no-store',
      });
      const body = await readControlResponse(response);
      if (!body) throw new Error('Не удалось получить ответ от 1С. Попробуйте повторить проверку позже.');
      if (!response.ok || !body.ok) {
        const failure = body as FailedControlResponse;
        throw new Error([failure.error, ...(failure.blockingIssues ?? [])].filter(Boolean).join(' ') || 'Данные 1С пока не готовы к расчёту.');
      }
      if (!belongsToSelectedPeriod(body)) {
        throw new Error('За выбранный месяц ещё нет закрытых данных 1С. Данные прошлого месяца в расчёт не включены.');
      }
      if (requestVersion.current !== version) return;
      rememberFullResponse(periodKey, body);
      setData(body);
      setError('');
      setIsStale(false);
      if (body.readyForControl) {
        const compactCache: DailyControlResponse = {
          ...body,
          sales: { summary: body.sales.summary },
        };
        try {
          window.localStorage.setItem(`payroll-one-c-last-good-v3-${periodKey}`, JSON.stringify(compactCache));
        } catch {
          // A full browser storage must not hide a successful read-only 1C result.
        }
      }
    } catch (loadError) {
      if (requestVersion.current !== version) return;
      const cachedCandidate = readFullResponseFromMemory(periodKey) ?? readCached(periodKey);
      const cached = belongsToSelectedPeriod(cachedCandidate) ? cachedCandidate : null;
      setData((current) => current ?? cached);
      setIsStale(true);
      setError(getFriendlyLoadError(loadError));
    } finally {
      if (requestVersion.current === version) setIsLoading(false);
    }
  }, [belongsToSelectedPeriod, month, periodKey, year]);

  useEffect(() => {
    const cachedCandidate = readFullResponseFromMemory(periodKey) ?? readCached(periodKey);
    const cached = belongsToSelectedPeriod(cachedCandidate) ? cachedCandidate : null;
    setData(cached);
    setIsStale(Boolean(cached));
    setError('');
    void load(false);
  }, [belongsToSelectedPeriod, load, periodKey]);

  useEffect(() => {
    onDataChange?.(data && Array.isArray(data.sales.rows) ? data : null, { isStale });
  }, [data, isStale, onDataChange]);

  const activePurchaseRows = useMemo(() => data?.purchases.rows.filter((row) => row.status !== 'EXCLUDED') ?? [], [data]);
  const excludedPurchaseRows = useMemo(() => data?.purchases.rows.filter((row) => row.status === 'EXCLUDED') ?? [], [data]);

  async function decideSupplier(row: PurchaseRow, isActive: boolean) {
    setActionSupplier(row.supplierName);
    try {
      const response = await fetch('/api/admin/payroll/purchase-suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplierName: row.supplierName, isActive }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(body?.error ?? 'Решение по поставщику не сохранено.');
      await load(false);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Решение по поставщику не сохранено.');
    } finally {
      setActionSupplier('');
    }
  }

  if (compactWhenUnavailable && error && !data && !isLoading) {
    return (
      <Card className='border border-amber-200 bg-amber-50/70 p-0'>
        <div className='flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-start gap-3'>
            <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700'>
              <Database className='h-4 w-4' />
            </span>
            <div className='min-w-0'>
              <p className='font-bold text-amber-950'>1С временно недоступна</p>
              <p className='text-sm text-amber-900'>Расчёт продолжает работать с загруженным резервным файлом. Перепроверьте источник позже.</p>
            </div>
          </div>
          <button type='button' onClick={() => void load(true)} className='inline-flex w-fit shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-950 shadow-sm transition hover:border-amber-300'>
            <RefreshCw className='h-4 w-4' />
            Перепроверить 1С
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`min-w-0 overflow-hidden border p-0 ${error ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className='flex flex-col gap-3 border-b border-slate-100 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 items-center gap-3'>
          <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600'>
            <Database className='h-4 w-4' />
          </span>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='font-bold text-slate-950'>Источник 1С</h3>
              {data && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${data.readyForControl && !isStale ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                  {isStale ? 'Предыдущие данные' : data.readyForControl ? `По ${formatDate(data.period.verifiedThrough)}` : 'Нужна проверка'}
                </span>
              )}
            </div>
            <p className='text-sm text-slate-500'>Продажи, себестоимость и закупки для расчёта.</p>
          </div>
        </div>
        <button type='button' onClick={() => void load(true)} disabled={isLoading} className='inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:opacity-60'>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Проверяю' : 'Перепроверить'}
        </button>
      </div>

      <div className='p-4'>
        {error && (
          <div role='alert' className='mb-4 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            <p><strong>{data && isStale ? 'Новые данные не приняты.' : 'Данные пока недоступны.'}</strong> {error}{data && isStale ? ' Ниже показаны последние проверенные значения.' : ''}</p>
          </div>
        )}

        {isLoading && !data && <p className='py-4 text-sm font-medium text-slate-500'>Проверяю данные 1С…</p>}

        {data && (
          <div className='grid gap-3'>
            {data.period.usingPreviousClose && !isStale && (
              <p className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950'>Сегодняшнее закрытие ещё не завершено. Показаны проверенные данные по {formatDate(data.period.verifiedThrough)}.</p>
            )}

            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4'>
              {[
                ['Продажи', formatMoney(data.sales.summary.revenue)],
                ['Валовая прибыль', formatMoney(data.sales.summary.grossProfit)],
                ['База закупок', formatMoney(data.purchases.approvedBase)],
                ['Бонус закупок 1,75%', formatMoney(data.purchases.approvedBase * 0.0175)],
              ].map(([label, value]) => (
                <div key={label} className='min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5'>
                  <p className='text-xs font-semibold text-slate-500'>{label}</p>
                  <p className='mt-0.5 text-base font-extrabold text-slate-950 sm:text-lg'>{value}</p>
                </div>
              ))}
            </div>

            {data.blockingIssues.length > 0 || data.purchases.attribution.reviewDocumentCount > 0 || data.purchases.newSupplierCount > 0 ? (
              <div className='rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950'>
                <p className='font-bold'>Требуется действие</p>
                {data.blockingIssues.map((issue) => <p key={issue} className='mt-1'>{issue}</p>)}
                {data.purchases.attribution.reviewDocumentCount > 0 && <p className='mt-1'>Документы закупок для проверки: {data.purchases.attribution.reviewDocumentCount}.</p>}
                {data.purchases.newSupplierCount > 0 && <p className='mt-1'>Новые поставщики: {data.purchases.newSupplierCount}.</p>}
              </div>
            ) : (
              <div className='flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-950'>
                <CheckCircle2 className='mt-0.5 h-4 w-4 shrink-0' />
                <p><strong>Источник готов.</strong> Ошибок, требующих решения, нет.</p>
              </div>
            )}

            <details className='rounded-lg border border-slate-200 bg-white' open={data.purchases.newSupplierCount > 0}>
              <summary className='cursor-pointer list-none px-3 py-2.5'>
                <div className='flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='min-w-0'>
                    <p className='font-bold text-slate-900'>Поставщики закупок</p>
                    <p className='text-sm text-slate-500'>Состав базы закупок Астемира</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${data.purchases.newSupplierCount ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
                    {data.purchases.newSupplierCount ? `Новых: ${data.purchases.newSupplierCount}` : 'Новых нет'}
                  </span>
                </div>
              </summary>
              <div className='border-t border-slate-100 px-3 py-3'>
                <div className='grid gap-2'>
                  {activePurchaseRows.map((row) => (
                    <div key={`${row.supplierName}-${row.organizationName}-${row.currency}`} className={`flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between ${row.status === 'NEW' ? 'border-amber-200 bg-amber-50/70' : 'border-slate-200'}`}>
                      <div className='min-w-0'>
                        <p className='font-semibold text-slate-900'>{row.supplierName}</p>
                        <p className='text-xs text-slate-500'>{formatMoney(row.debtIncrease)} · {row.sourceRows} документов 1С{row.currency ? ` · ${row.currency}` : ''}</p>
                      </div>
                      <div className='flex shrink-0 gap-2'>
                        {row.status === 'NEW' && <button type='button' disabled={Boolean(actionSupplier)} onClick={() => void decideSupplier(row, true)} className='rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50'>Учитывать</button>}
                        <button type='button' disabled={Boolean(actionSupplier)} onClick={() => void decideSupplier(row, false)} className='rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 disabled:opacity-50'>{row.status === 'NEW' ? 'Не учитывать' : 'Исключить'}</button>
                      </div>
                    </div>
                  ))}
                </div>
                {excludedPurchaseRows.length > 0 && (
                  <details className='mt-3 rounded-lg bg-slate-50 px-3 py-2'>
                    <summary className='cursor-pointer text-sm font-semibold text-slate-700'>Не учитываются: {excludedPurchaseRows.length}</summary>
                    <div className='mt-2 grid gap-2'>
                      {excludedPurchaseRows.map((row) => (
                        <div key={`${row.supplierName}-${row.organizationName}-${row.currency}-excluded`} className='flex items-center justify-between gap-2 text-sm'>
                          <span>{row.supplierName} · {formatMoney(row.debtIncrease)}</span>
                          <button type='button' disabled={Boolean(actionSupplier)} onClick={() => void decideSupplier(row, true)} className='rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 disabled:opacity-50'>Вернуть</button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </details>

            <details className='rounded-lg border border-slate-200 bg-white'>
              <summary className='cursor-pointer px-3 py-2.5 text-sm font-bold text-slate-800'>Технические сведения</summary>
              <div className='grid gap-2 border-t border-slate-100 px-3 py-3 text-sm sm:grid-cols-2'>
                <p><span className='text-slate-500'>Закрытие 1С:</span> <strong>{data.close.finishedAt ?? 'подтверждено'}</strong></p>
                <p><span className='text-slate-500'>Последнее обновление:</span> <strong>{formatDateTime(data.snapshot.storedAt)}</strong></p>
                <p><span className='text-slate-500'>Менеджеров:</span> <strong>{data.sales.summary.managerCount}</strong></p>
                <p><span className='text-slate-500'>Строк продаж:</span> <strong>{data.sales.summary.sourceRows}</strong></p>
                <p><span className='text-slate-500'>Поставщиков в базе:</span> <strong>{data.purchases.approvedSupplierCount}</strong></p>
                <p><span className='text-slate-500'>Технических отметок себестоимости:</span> <strong>{data.sales.summary.costCalculationPendingRows}</strong></p>
                <p className='sm:col-span-2'>Документы закупок учитываются только при совпадении автора и менеджера: <strong>{data.purchases.attribution.employeeName}</strong>. Учтено: {data.purchases.attribution.documentCount}; другие документы организации: {data.purchases.attribution.ignoredOtherDocumentCount}.</p>
                <p className='sm:col-span-2 text-slate-600'>{data.snapshot.finalReconciled ? 'Месяц полностью проверен и сохранён. Повторная проверка запускается только по команде.' : `Портал ежедневно добавляет новый день и повторно проверяет последние ${data.snapshot.rollingDays} дня.`}</p>
              </div>
            </details>

            <p className='text-xs font-medium text-slate-500'>Перепроверка обновляет только исходные показатели. Сохранённые расчёты и документы 1С не изменяются.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
