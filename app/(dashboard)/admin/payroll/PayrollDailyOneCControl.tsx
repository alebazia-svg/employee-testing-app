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

type DailyControlResponse = {
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

export function PayrollDailyOneCControl({ month, year }: { month: string; year: string }) {
  const periodKey = `${year}-${String(Number(month) + 1).padStart(2, '0')}`;
  const [data, setData] = useState<DailyControlResponse | null>(null);
  const [error, setError] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSupplier, setActionSupplier] = useState('');
  const requestVersion = useRef(0);

  const load = useCallback(async (force = false) => {
    const version = requestVersion.current + 1;
    requestVersion.current = version;
    setIsLoading(true);
    try {
      const query = `year=${encodeURIComponent(year)}&month=${encodeURIComponent(month)}`;
      const storedResponse = await fetch(`/api/admin/payroll/daily-control?${query}`, { cache: 'no-store' });
      if (storedResponse.ok) {
        const storedBody = await storedResponse.json() as DailyControlResponse;
        if (requestVersion.current !== version) return;
        setData(storedBody);
        setError('');
        setIsStale(false);
      }
      const response = await fetch(`/api/admin/payroll/daily-control?${query}${force ? '&force=1' : ''}`, {
        method: 'POST', cache: 'no-store',
      });
      const body = await response.json() as DailyControlResponse | FailedControlResponse;
      if (!response.ok || !body.ok) {
        const failure = body as FailedControlResponse;
        throw new Error([failure.error, ...(failure.blockingIssues ?? [])].filter(Boolean).join(' '));
      }
      if (requestVersion.current !== version) return;
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
      const cached = readCached(periodKey);
      setData((current) => current ?? cached);
      setIsStale(true);
      setError(loadError instanceof Error ? loadError.message : 'Не удалось обновить данные 1С.');
    } finally {
      if (requestVersion.current === version) setIsLoading(false);
    }
  }, [month, periodKey, year]);

  useEffect(() => {
    const cached = readCached(periodKey);
    setData(cached);
    setIsStale(Boolean(cached));
    setError('');
    void load(false);
  }, [load, periodKey]);

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

  return (
    <Card className={`overflow-hidden border ${data?.readyForControl && !isStale ? 'border-emerald-200' : error ? 'border-amber-200' : 'border-slate-200'}`}>
      <div className={`flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${data?.readyForControl && !isStale ? 'border-emerald-100 bg-emerald-50/70' : 'border-slate-100 bg-slate-50'}`}>
        <div className='flex min-w-0 items-start gap-3'>
          <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${data?.readyForControl && !isStale ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {data?.readyForControl && !isStale ? <CheckCircle2 className='h-5 w-5' /> : <Database className='h-5 w-5' />}
          </span>
          <div className='min-w-0'>
            <div className='flex flex-wrap items-center gap-2'>
              <h2 className='text-lg font-extrabold text-slate-950'>Автоматические данные 1С</h2>
              {data && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${data.readyForControl && !isStale ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>
                  {isStale ? 'Предыдущие проверенные данные' : data.readyForControl ? `1С закрыта по ${formatDate(data.period.verifiedThrough)}` : 'Нужно проверить'}
                </span>
              )}
            </div>
            <p className='mt-1 text-sm text-slate-600'>Обновляется при открытии страницы только после успешного вечернего расчёта себестоимости. Текущий Excel-расчёт и сохранённые зарплаты не меняются.</p>
          </div>
        </div>
        <button type='button' onClick={() => void load(true)} disabled={isLoading} className='inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 disabled:opacity-60'>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Проверяю 1С' : 'Перепроверить полностью'}
        </button>
      </div>

      <div className='p-4'>
        {error && (
          <div role='alert' className='mb-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950'>
            <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0' />
            <p><strong>{isStale ? 'Новые данные не приняты.' : 'Расчёт пока не готов.'}</strong> {error}{isStale ? ' Ниже оставлены последние проверенные значения.' : ''}</p>
          </div>
        )}

        {isLoading && !data && <p className='py-5 text-sm font-medium text-slate-500'>Проверяю закрытие себестоимости и читаю данные 1С…</p>}

        {data && (
          <div className='grid gap-4'>
            {data.period.usingPreviousClose && !isStale && (
              <p className='rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900'>Сегодняшнее закрытие ещё не завершено. Показаны проверенные данные по {formatDate(data.period.verifiedThrough)}; сегодняшний незакрытый день не включён.</p>
            )}

            <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
              {[
                ['Выручка продаж', formatMoney(data.sales.summary.revenue)],
                ['Валовая прибыль', formatMoney(data.sales.summary.grossProfit)],
                ['База закупок Астемира', formatMoney(data.purchases.approvedBase)],
                ['1,75% от закупок', formatMoney(data.purchases.approvedBase * 0.0175)],
              ].map(([label, value]) => (
                <div key={label} className='rounded-xl border border-slate-200 bg-white p-3'>
                  <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>{label}</p>
                  <p className='mt-1 text-xl font-extrabold text-slate-950'>{value}</p>
                </div>
              ))}
            </div>

            <div className='grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4'>
              <p><span className='text-slate-500'>Закрытие 1С:</span> <strong>{data.close.finishedAt ?? 'подтверждено'}</strong></p>
              <p><span className='text-slate-500'>Менеджеров:</span> <strong>{data.sales.summary.managerCount}</strong></p>
              <p><span className='text-slate-500'>Строк продаж:</span> <strong>{data.sales.summary.sourceRows}</strong></p>
              <p><span className='text-slate-500'>Поставщиков в базе:</span> <strong>{data.purchases.approvedSupplierCount}</strong></p>
            </div>

            <div className='rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950'>
              <p className='font-bold'>{data.snapshot.finalReconciled ? 'Месяц полностью сверен и сохранён' : `Серверный снимок сохранён по ${formatDate(data.snapshot.storedThrough)}`}</p>
              <p className='mt-0.5'>Последнее сохранение: {formatDateTime(data.snapshot.storedAt)}. {data.snapshot.finalReconciled ? 'Повторное чтение всего месяца выполняется только по вашей команде.' : `При ежедневном обновлении портал читает новый день и перепроверяет последние ${data.snapshot.rollingDays} дня.`}</p>
            </div>

            <div className={`rounded-xl border px-3 py-2 text-sm ${data.purchases.attribution.reviewDocumentCount ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-emerald-200 bg-emerald-50 text-emerald-950'}`}>
              <p className='font-bold'>{data.purchases.attribution.reviewDocumentCount ? 'Есть документы для проверки' : 'Автор закупок подтверждён'}</p>
              <p className='mt-0.5'>В базу вошли только документы, где автор и менеджер — {data.purchases.attribution.employeeName}: {data.purchases.attribution.documentCount}. Другие документы организации: {data.purchases.attribution.ignoredOtherDocumentCount} — не учитываются.</p>
            </div>

            {(data.blockingIssues.length > 0 || data.sales.summary.costCalculationPendingRows > 0) && (
              <div className='rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950'>
                <p className='font-bold'>Что требует внимания</p>
                <ul className='mt-1 list-disc space-y-1 pl-5'>
                  {data.blockingIssues.map((issue) => <li key={issue}>{issue}</li>)}
                  {data.sales.summary.costCalculationPendingRows > 0 && <li>В источнике есть технические отметки ожидания себестоимости: {data.sales.summary.costCalculationPendingRows}. Перед подключением к формуле проверим только те, от которых зависит зарплата.</li>}
                </ul>
              </div>
            )}

            <details className='rounded-xl border border-slate-200 bg-white' open={data.purchases.newSupplierCount > 0}>
              <summary className='cursor-pointer list-none px-4 py-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div>
                    <p className='font-bold text-slate-900'>Поставщики Астемира</p>
                    <p className='text-sm text-slate-500'>Утверждённые входят в базу; новые ждут вашего решения и сами не добавляются.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${data.purchases.newSupplierCount ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                    {data.purchases.newSupplierCount ? `Новых: ${data.purchases.newSupplierCount}` : 'Список проверен'}
                  </span>
                </div>
              </summary>
              <div className='border-t border-slate-100 px-4 py-3'>
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

            <p className='text-xs text-slate-500'>Это контрольный read-only этап. Он не сохраняет расчёт зарплаты, не проводит документы и не меняет утверждённые месяцы.</p>
          </div>
        )}
      </div>
    </Card>
  );
}
