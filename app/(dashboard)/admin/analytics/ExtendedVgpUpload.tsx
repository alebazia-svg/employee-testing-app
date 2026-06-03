'use client';

import { useEffect, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type ExtendedVgpDocumentTypeSummary = {
  documentType: string;
  rowsCount: number;
  revenue: number;
  grossProfit: number;
  negativeCount: number;
};

type ExtendedVgpExampleRow = {
  id: number;
  documentDate: string | null;
  documentType: string;
  documentName: string | null;
  employeeName: string;
  client: string | null;
  nomenclatureType: string | null;
  itemName: string;
  article: string | null;
  quantity: number | null;
  revenue: number;
  cost: number;
  grossProfit: number;
};

type ExtendedVgpDiagnostics = {
  revenue: number;
  grossProfit: number;
  realReturnCount: number;
  negativeCount: number;
  documentNameCount: number;
  documentNameMissingCount: number;
  documentTypes: ExtendedVgpDocumentTypeSummary[];
  examples: ExtendedVgpExampleRow[];
};

type ExtendedVgpReport = {
  id: number;
  period: string;
  sourceReportType: string;
  fileName: string;
  uploadedAt: string;
  rowsCount: number;
  diagnostics: ExtendedVgpDiagnostics;
};

const emptyDiagnostics: ExtendedVgpDiagnostics = {
  revenue: 0,
  grossProfit: 0,
  realReturnCount: 0,
  negativeCount: 0,
  documentNameCount: 0,
  documentNameMissingCount: 0,
  documentTypes: [],
  examples: [],
};

function asNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizeDiagnostics(value: unknown): ExtendedVgpDiagnostics {
  const source = value && typeof value === 'object' ? value as Partial<ExtendedVgpDiagnostics> : {};
  return {
    revenue: asNumber(source.revenue),
    grossProfit: asNumber(source.grossProfit),
    realReturnCount: asNumber(source.realReturnCount),
    negativeCount: asNumber(source.negativeCount),
    documentNameCount: asNumber(source.documentNameCount),
    documentNameMissingCount: asNumber(source.documentNameMissingCount),
    documentTypes: Array.isArray(source.documentTypes) ? source.documentTypes : [],
    examples: Array.isArray(source.examples) ? source.examples : [],
  };
}

function normalizeReport(value: ExtendedVgpReport | null): ExtendedVgpReport | null {
  if (!value) return null;
  return {
    ...value,
    rowsCount: asNumber(value.rowsCount),
    diagnostics: normalizeDiagnostics(value.diagnostics),
  };
}

function formatMoney(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'нет данных';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

function formatNumber(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 'нет данных';
  return value.toLocaleString('ru-RU');
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'нет данных';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function getDefaultPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function ExtendedVgpUpload({ initialPeriod }: { initialPeriod?: string }) {
  const [period, setPeriod] = useState(initialPeriod || getDefaultPeriod);
  const [file, setFile] = useState<File | null>(null);
  const [latestReport, setLatestReport] = useState<ExtendedVgpReport | null>(null);
  const [isLoadingLatest, setIsLoadingLatest] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const diagnostics = latestReport?.diagnostics ?? emptyDiagnostics;
  const hasLatest = Boolean(latestReport);
  const helperText = useMemo(
    () => file ? `${file.name} · ${formatNumber(file.size)} байт` : 'Выберите расширенный ВВП с количеством и документами.',
    [file],
  );
  const documentNameMissingShare = diagnostics && latestReport?.rowsCount
    ? diagnostics.documentNameMissingCount / latestReport.rowsCount
    : 0;

  async function loadLatest() {
    setIsLoadingLatest(true);
    try {
      const response = await fetch('/api/admin/analytics/extended-vgp/latest', { cache: 'no-store' });
      if (!response.ok) throw new Error('Не удалось загрузить последний расширенный ВВП.');
      const data = await response.json() as ExtendedVgpReport | null;
      setLatestReport(normalizeReport(data));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить последний расширенный ВВП.');
    } finally {
      setIsLoadingLatest(false);
    }
  }

  useEffect(() => {
    void loadLatest();
  }, []);

  useEffect(() => {
    if (initialPeriod) setPeriod(initialPeriod);
  }, [initialPeriod]);

  async function handleUpload() {
    if (!file) {
      setError('Выберите файл расширенного ВВП.');
      return;
    }

    setIsUploading(true);
    setStatus('');
    setError('');

    try {
      const formData = new FormData();
      formData.set('period', period);
      formData.set('file', file);

      const response = await fetch('/api/admin/analytics/extended-vgp/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Не удалось загрузить расширенный ВВП.';
        throw new Error(message);
      }

      await loadLatest();
      setStatus('Расширенный ВВП сохранён для аналитики продаж.');
      setFile(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось загрузить расширенный ВВП.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Card>
      <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
        <div>
          <p className='text-xs font-bold uppercase tracking-wide text-primary'>Независимый источник</p>
          <h2 className='mt-1 text-xl font-extrabold text-slate-950'>Расширенный ВВП для аналитики</h2>
          <p className='mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-600'>
            Расширенный ВВП — отдельный источник аналитики продаж: документы, возвраты, количество и себестоимость. На зарплату не влияет.
          </p>
        </div>
        <div className='rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800'>
          Payroll не меняется
        </div>
      </div>

      <div className='mt-5 grid gap-3 lg:grid-cols-[160px_minmax(260px,1fr)_auto] lg:items-end'>
        <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
          Период
          <Input type='month' value={period} onChange={(event) => setPeriod(event.target.value)} />
        </label>
        <label className='grid gap-1.5 text-sm font-semibold text-slate-700'>
          Файл
          <span className='relative flex items-center'>
            <Upload className='pointer-events-none absolute left-3 h-4 w-4 text-slate-400' />
            <Input
              type='file'
              accept='.xlsx,.csv'
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className='pl-10 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700'
            />
          </span>
          <span className='text-xs font-medium text-slate-500'>{helperText}</span>
        </label>
        <button
          type='button'
          onClick={() => void handleUpload()}
          disabled={isUploading || !file}
          className='rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {isUploading ? 'Загрузка...' : 'Загрузить'}
        </button>
      </div>

      {status && <p className='mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800'>{status}</p>}
      {error && <p className='mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700'>{error}</p>}

      <div className='mt-5 rounded-lg border border-border bg-slate-50 px-4 py-4'>
        <div className='flex flex-col gap-2 md:flex-row md:items-start md:justify-between'>
          <div>
            <h3 className='font-extrabold text-slate-950'>Последняя загрузка</h3>
            {isLoadingLatest ? (
              <p className='mt-1 text-sm font-medium text-slate-500'>Проверяю последний расширенный ВВП...</p>
            ) : hasLatest ? (
              <p className='mt-1 text-sm font-medium text-slate-600'>
                {latestReport!.fileName} · период {latestReport!.period} · {formatDateTime(latestReport!.uploadedAt)}
              </p>
            ) : (
              <p className='mt-1 text-sm font-medium text-slate-500'>Расширенный ВВП ещё не загружен. Текущая аналитика ниже продолжает работать по payroll snapshot.</p>
            )}
          </div>
          {hasLatest && (
            <p className='rounded-md bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm'>
              {latestReport!.sourceReportType}
            </p>
          )}
        </div>

        {hasLatest && diagnostics ? (
          <>
            <div className='mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
              <div className='rounded-lg bg-white px-3 py-3 shadow-sm'>
                <p className='text-xs font-bold uppercase text-slate-400'>Строк</p>
                <p className='mt-1 text-lg font-extrabold text-slate-950'>{formatNumber(latestReport!.rowsCount)}</p>
              </div>
              <div className='rounded-lg bg-white px-3 py-3 shadow-sm'>
                <p className='text-xs font-bold uppercase text-slate-400'>Выручка</p>
                <p className='mt-1 whitespace-nowrap text-lg font-extrabold text-slate-950'>{formatMoney(diagnostics.revenue)}</p>
              </div>
              <div className='rounded-lg bg-white px-3 py-3 shadow-sm'>
                <p className='text-xs font-bold uppercase text-slate-400'>Валовая прибыль</p>
                <p className='mt-1 whitespace-nowrap text-lg font-extrabold text-slate-950'>{formatMoney(diagnostics.grossProfit)}</p>
              </div>
              <div className='rounded-lg bg-white px-3 py-3 shadow-sm'>
                <p className='text-xs font-bold uppercase text-slate-400'>Возвраты RETURN</p>
                <p className='mt-1 text-lg font-extrabold text-slate-950'>{formatNumber(diagnostics.realReturnCount)}</p>
              </div>
              <div className='rounded-lg bg-white px-3 py-3 shadow-sm'>
                <p className='text-xs font-bold uppercase text-slate-400'>Отрицательные строки</p>
                <p className='mt-1 text-lg font-extrabold text-slate-950'>{formatNumber(diagnostics.negativeCount)}</p>
              </div>
            </div>

            {documentNameMissingShare > 0.5 && (
              <p className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>
                В расширенном ВВП не распознана колонка документа. RETURN может определяться неверно.
              </p>
            )}
            {diagnostics.realReturnCount === 0 && diagnostics.negativeCount > 0 && (
              <p className='mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>
                Есть отрицательные строки, но документы возврата не распознаны. Проверьте documentName/documentType.
              </p>
            )}

            <div className='mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white'>
              <div className='border-b border-slate-200 px-4 py-3'>
                <h4 className='font-extrabold text-slate-950'>Разбивка по documentType</h4>
              </div>
              <div className='overflow-x-auto'>
                {diagnostics.documentTypes.length ? (
                  <table className='w-full text-sm'>
                    <thead className='bg-slate-50 text-left text-xs uppercase text-slate-500'>
                      <tr>
                        <th className='px-4 py-3'>documentType</th>
                        <th className='px-4 py-3 text-right'>Строк</th>
                        <th className='px-4 py-3 text-right'>Выручка</th>
                        <th className='px-4 py-3 text-right'>ВП</th>
                        <th className='px-4 py-3 text-right'>Минус</th>
                      </tr>
                    </thead>
                    <tbody>
                      {diagnostics.documentTypes.map((row) => (
                        <tr key={row.documentType} className='border-t border-slate-200'>
                          <td className='px-4 py-3 font-bold text-slate-950'>{row.documentType}</td>
                          <td className='whitespace-nowrap px-4 py-3 text-right text-slate-700'>{formatNumber(row.rowsCount)}</td>
                          <td className='whitespace-nowrap px-4 py-3 text-right text-slate-700'>{formatMoney(row.revenue)}</td>
                          <td className='whitespace-nowrap px-4 py-3 text-right font-semibold text-slate-950'>{formatMoney(row.grossProfit)}</td>
                          <td className='whitespace-nowrap px-4 py-3 text-right text-slate-700'>{formatNumber(row.negativeCount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className='px-4 py-5 text-sm font-semibold text-slate-500'>
                    Диагностика documentType пока недоступна. Обновите страницу или проверьте структуру отчёта.
                  </p>
                )}
              </div>
            </div>

            <details className='mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white'>
              <summary className='cursor-pointer px-4 py-3 text-sm font-bold text-primary hover:bg-slate-50'>
                Примеры документов ({diagnostics.examples.length})
              </summary>
              <div className='overflow-x-auto'>
                <table className='w-full text-xs'>
                  <thead className='bg-slate-50 text-left uppercase text-slate-500'>
                    <tr>
                      <th className='px-3 py-2'>Дата</th>
                      <th className='px-3 py-2'>Тип</th>
                      <th className='px-3 py-2'>Документ</th>
                      <th className='px-3 py-2'>Сотрудник</th>
                      <th className='px-3 py-2'>Клиент</th>
                      <th className='px-3 py-2'>Вид</th>
                      <th className='px-3 py-2'>Товар</th>
                      <th className='px-3 py-2'>Артикул</th>
                      <th className='px-3 py-2 text-right'>Кол-во</th>
                      <th className='px-3 py-2 text-right'>Выручка</th>
                      <th className='px-3 py-2 text-right'>С/с</th>
                      <th className='px-3 py-2 text-right'>ВП</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diagnostics.examples.map((row) => (
                      <tr key={row.id} className='border-t border-slate-200 align-top'>
                        <td className='whitespace-nowrap px-3 py-2 text-slate-600'>{formatDate(row.documentDate)}</td>
                        <td className='whitespace-nowrap px-3 py-2 font-bold text-slate-900'>{row.documentType}</td>
                        <td className='max-w-[280px] px-3 py-2 text-slate-700' title={row.documentName ?? ''}>{row.documentName || '—'}</td>
                        <td className='whitespace-nowrap px-3 py-2 font-semibold text-slate-900'>{row.employeeName}</td>
                        <td className='max-w-[180px] px-3 py-2 text-slate-600'>{row.client || '—'}</td>
                        <td className='max-w-[180px] px-3 py-2 text-slate-600'>{row.nomenclatureType || '—'}</td>
                        <td className='min-w-[240px] px-3 py-2 font-semibold text-slate-900'>{row.itemName}</td>
                        <td className='whitespace-nowrap px-3 py-2 text-slate-600'>{row.article || '—'}</td>
                        <td className='whitespace-nowrap px-3 py-2 text-right text-slate-700'>{row.quantity ?? '—'}</td>
                        <td className='whitespace-nowrap px-3 py-2 text-right text-slate-700'>{formatMoney(row.revenue)}</td>
                        <td className='whitespace-nowrap px-3 py-2 text-right text-slate-700'>{formatMoney(row.cost)}</td>
                        <td className={row.grossProfit < 0 ? 'whitespace-nowrap px-3 py-2 text-right font-semibold text-red-700' : 'whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-900'}>{formatMoney(row.grossProfit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </>
        ) : null}
      </div>
    </Card>
  );
}
