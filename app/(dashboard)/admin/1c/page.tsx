import { redirect } from 'next/navigation';
import { Activity, AlertTriangle, CheckCircle2, Clock, FileText, Server, ShoppingBag } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { getAIAgentHealth, getSalesRealizations, type OneCEndpointResult, type OneCSalesRealizationDocument } from '@/lib/one-c';

export const dynamic = 'force-dynamic';

function renderValue(value: unknown) {
  if (value === null || value === undefined || value === '') return 'нет данных';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value, null, 2);
}

function EndpointCard({ title, result }: { title: string; result: OneCEndpointResult }) {
  return (
    <Card className='p-0'>
      <div className='flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4'>
        <div>
          <p className='text-sm font-bold uppercase tracking-wide text-slate-500'>{result.path}</p>
          <h2 className='mt-1 text-lg font-extrabold text-slate-950'>{title}</h2>
        </div>
        <Badge className={result.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
          {result.ok ? 'OK' : 'Ошибка'}
        </Badge>
      </div>
      <div className='grid gap-3 p-5'>
        <div className='flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm'>
          <span className='font-semibold text-slate-500'>HTTP</span>
          <span className='font-bold text-slate-950'>{result.status ?? 'нет ответа'}</span>
        </div>
        <div className='flex items-center justify-between rounded-lg border border-slate-200/80 bg-slate-50 px-3 py-2 text-sm'>
          <span className='font-semibold text-slate-500'>Время</span>
          <span className='font-bold text-slate-950'>{result.durationMs} мс</span>
        </div>
        {result.error ? (
          <div className='rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800'>
            {result.error}
          </div>
        ) : null}
        <pre className='max-h-52 overflow-auto rounded-lg border border-slate-200/80 bg-white p-3 text-xs font-semibold text-slate-700'>
          {renderValue(result.data)}
        </pre>
      </div>
    </Card>
  );
}

function formatMoney(value: number | null, currency = 'RUB') {
  if (value === null) return 'нет данных';
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (currency ? ` ${currency}` : '');
}

function formatDocumentDate(value: string) {
  if (!value) return 'нет данных';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function SalesDocumentCard({ document }: { document: OneCSalesRealizationDocument }) {
  const manager = document.managerName || document.additionalManagerName || document.responsibleName || 'нет данных';
  const partner = document.partnerName || document.counterpartyName || 'нет данных';

  return (
    <Card className='p-0'>
      <div className='grid gap-4 border-b border-slate-200/80 px-5 py-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]'>
        <div className='min-w-0'>
          <div className='flex flex-wrap items-center gap-2'>
            <h3 className='text-lg font-extrabold text-slate-950'>Реализация {document.number || document.ref || 'без номера'}</h3>
            {document.posted !== null ? (
              <Badge className={document.posted ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-700'}>
                {document.posted ? 'проведён' : 'не проведён'}
              </Badge>
            ) : null}
            {document.deletionMark ? <Badge className='bg-red-100 text-red-700'>пометка удаления</Badge> : null}
          </div>
          <p className='mt-1 text-sm font-semibold text-slate-500'>{formatDocumentDate(document.date)}</p>
        </div>
        <div className='text-left lg:text-right'>
          <p className='text-sm font-bold text-slate-500'>Сумма</p>
          <p className='mt-1 text-2xl font-extrabold text-slate-950'>{formatMoney(document.amount, document.currency)}</p>
        </div>
      </div>

      <div className='grid gap-3 px-5 py-4 text-sm font-semibold text-slate-700 md:grid-cols-2 xl:grid-cols-4'>
        <div>
          <p className='text-slate-500'>Организация</p>
          <p className='mt-1 text-slate-950'>{document.organizationName || 'нет данных'}</p>
        </div>
        <div>
          <p className='text-slate-500'>Партнёр / контрагент</p>
          <p className='mt-1 text-slate-950'>{partner}</p>
        </div>
        <div>
          <p className='text-slate-500'>Менеджер</p>
          <p className='mt-1 text-slate-950'>{manager}</p>
        </div>
        <div>
          <p className='text-slate-500'>Строк товаров</p>
          <p className='mt-1 text-slate-950'>{document.lines.length}</p>
        </div>
      </div>

      {document.lines.length ? (
        <div className='overflow-x-auto border-t border-slate-200/80'>
          <table className='min-w-full text-left text-sm'>
            <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
              <tr>
                <th className='px-5 py-3'>#</th>
                <th className='px-5 py-3'>Товар</th>
                <th className='px-5 py-3'>Код / артикул</th>
                <th className='px-5 py-3 text-right'>Кол-во</th>
                <th className='px-5 py-3 text-right'>Цена</th>
                <th className='px-5 py-3 text-right'>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {document.lines.map((line) => (
                <tr key={`${document.ref || document.number}-${line.lineNumber}-${line.productCode}-${line.productName}`} className='border-t border-slate-200/80'>
                  <td className='px-5 py-3 font-bold text-slate-500'>{line.lineNumber}</td>
                  <td className='px-5 py-3 font-semibold text-slate-950'>{line.productName || 'нет данных'}</td>
                  <td className='px-5 py-3 text-slate-600'>{[line.productCode, line.productArticle].filter(Boolean).join(' / ') || 'нет данных'}</td>
                  <td className='px-5 py-3 text-right font-semibold text-slate-700'>{line.quantity ?? 'нет данных'}</td>
                  <td className='px-5 py-3 text-right font-semibold text-slate-700'>{formatMoney(line.price, document.currency)}</td>
                  <td className='px-5 py-3 text-right font-bold text-slate-950'>{formatMoney(line.amount, document.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className='border-t border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800'>
          В документе не найдены строки товаров. Проверьте поле lines/items/products в ответе endpoint.
        </div>
      )}
    </Card>
  );
}

export default async function AdminOneCPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const [health, salesRealizations] = await Promise.all([getAIAgentHealth(), getSalesRealizations()]);
  const version = renderValue(health.endpoints.version.data);

  return (
    <AdminShell>
      <AdminBreadcrumbs current='1C AIAgentAPI' />

      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>1C AIAgentAPI</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Read-only техническая проверка подключения к 1С API.</p>
        </div>
        <Badge className={health.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
          {health.ok ? 'Подключено' : 'Недоступно'}
        </Badge>
      </div>

      <section className='mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card>
          <div className='flex items-center gap-3'>
            <div className={health.ok ? 'flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-green-700' : 'flex h-11 w-11 items-center justify-center rounded-lg bg-red-100 text-red-700'}>
              {health.ok ? <CheckCircle2 className='h-5 w-5' /> : <AlertTriangle className='h-5 w-5' />}
            </div>
            <div>
              <p className='text-sm font-bold text-slate-500'>Статус</p>
              <p className='mt-1 text-xl font-extrabold text-slate-950'>{health.ok ? 'OK' : 'Ошибка'}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-lg bg-green-100 text-primary'>
              <Activity className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-bold text-slate-500'>Ping</p>
              <p className='mt-1 text-xl font-extrabold text-slate-950'>{health.endpoints.ping.ok ? `${health.endpoints.ping.durationMs} мс` : 'нет ответа'}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-lg bg-blue-100 text-blue-700'>
              <Server className='h-5 w-5' />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-bold text-slate-500'>Версия</p>
              <p className='mt-1 truncate text-xl font-extrabold text-slate-950'>{version}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className='flex items-center gap-3'>
            <div className='flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-700'>
              <Clock className='h-5 w-5' />
            </div>
            <div>
              <p className='text-sm font-bold text-slate-500'>Environment</p>
              <p className='mt-1 text-xl font-extrabold text-slate-950'>{renderValue(health.environment)}</p>
            </div>
          </div>
        </Card>
      </section>

      {health.errors.length ? (
        <Card className='mb-5 border-red-200 bg-red-50'>
          <div className='flex gap-3'>
            <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-red-700' />
            <div>
              <h2 className='font-extrabold text-red-950'>1С недоступна или настроена не полностью</h2>
              <ul className='mt-2 grid gap-1 text-sm font-semibold text-red-800'>
                {health.errors.map((error) => <li key={error}>{error}</li>)}
              </ul>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className='mb-5'>
        <div className='grid gap-3 text-sm font-semibold text-slate-700 md:grid-cols-4'>
          <div>
            <p className='text-slate-500'>Проверено</p>
            <p className='mt-1 text-slate-950'>{new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(health.checkedAt))}</p>
          </div>
          <div>
            <p className='text-slate-500'>Base URL</p>
            <p className='mt-1 text-slate-950'>{health.baseUrlConfigured ? 'задан' : 'не задан'}</p>
          </div>
          <div>
            <p className='text-slate-500'>Timeout</p>
            <p className='mt-1 text-slate-950'>{health.timeoutMs} мс</p>
          </div>
          <div>
            <p className='text-slate-500'>Cache TTL</p>
            <p className='mt-1 text-slate-950'>{health.cacheTtlSeconds} сек. {health.cached ? '(cache)' : ''}</p>
          </div>
        </div>
      </Card>

      <section className='mb-5'>
        <Card className='p-0'>
          <div className='flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 xl:flex-row xl:items-start xl:justify-between'>
            <div>
              <div className='flex flex-wrap items-center gap-2'>
                <ShoppingBag className='h-5 w-5 text-primary' />
                <h2 className='text-xl font-extrabold text-slate-950'>Кредитные реализации из 1С</h2>
                <Badge className={salesRealizations.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
                  {salesRealizations.ok ? 'OK' : 'диагностика'}
                </Badge>
              </div>
              <p className='mt-1 text-sm font-semibold text-slate-500'>Read-only проверка GET /sales-realizations с тестовыми параметрами.</p>
            </div>
            <div className='grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-3 xl:min-w-[520px]'>
              <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
                <p className='text-slate-500'>Получено</p>
                <p className='mt-1 text-lg font-extrabold text-slate-950'>{salesRealizations.responseDocumentCount}</p>
              </div>
              <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
                <p className='text-slate-500'>Всего в 1С</p>
                <p className='mt-1 text-lg font-extrabold text-slate-950'>{salesRealizations.totalDocuments ?? 'нет данных'}</p>
              </div>
              <div className='rounded-lg border border-slate-200 bg-slate-50 px-3 py-2'>
                <p className='text-slate-500'>Has more</p>
                <p className='mt-1 text-lg font-extrabold text-slate-950'>{salesRealizations.hasMore ? 'да' : 'нет'}</p>
              </div>
            </div>
          </div>

          <div className='grid gap-3 border-b border-slate-200/80 px-5 py-4 text-sm font-semibold text-slate-700 md:grid-cols-4 xl:grid-cols-7'>
            <div>
              <p className='text-slate-500'>date_from</p>
              <p className='mt-1 text-slate-950'>{salesRealizations.params.dateFrom}</p>
            </div>
            <div>
              <p className='text-slate-500'>date_to</p>
              <p className='mt-1 text-slate-950'>{salesRealizations.params.dateTo}</p>
            </div>
            <div className='md:col-span-2'>
              <p className='text-slate-500'>customer_ref</p>
              <p className='mt-1 break-all text-slate-950'>{salesRealizations.params.customerRef}</p>
            </div>
            <div>
              <p className='text-slate-500'>posted</p>
              <p className='mt-1 text-slate-950'>{salesRealizations.params.posted}</p>
            </div>
            <div>
              <p className='text-slate-500'>limit / offset</p>
              <p className='mt-1 text-slate-950'>{salesRealizations.params.limit} / {salesRealizations.params.offset}</p>
            </div>
            <div>
              <p className='text-slate-500'>Время</p>
              <p className='mt-1 text-slate-950'>{salesRealizations.durationMs} мс</p>
            </div>
          </div>

          {salesRealizations.error || salesRealizations.diagnostics.length ? (
            <div className='border-b border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800'>
              <div className='flex gap-3'>
                <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-red-700' />
                <div>
                  <p className='font-extrabold text-red-950'>Endpoint недоступен или ответ отличается от ожидаемой структуры.</p>
                  <ul className='mt-2 grid gap-1'>
                    {salesRealizations.error ? <li>{salesRealizations.error}</li> : null}
                    {salesRealizations.diagnostics.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className='grid gap-4 p-5'>
            {salesRealizations.documents.length ? (
              salesRealizations.documents.map((document, index) => (
                <SalesDocumentCard key={document.ref || `${document.number}-${document.date}-${index}`} document={document} />
              ))
            ) : (
              <div className='flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center'>
                <FileText className='mb-3 h-8 w-8 text-slate-400' />
                <p className='font-extrabold text-slate-950'>Документы не отображаются</p>
                <p className='mt-1 max-w-xl text-sm font-semibold text-slate-500'>Портал выполнил серверную проверку, но список документов пустой или не был распознан. Подробность выше в диагностике.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className='grid gap-5 xl:grid-cols-3'>
        <EndpointCard title='Ping' result={health.endpoints.ping} />
        <EndpointCard title='Version' result={health.endpoints.version} />
        <EndpointCard title='Info' result={health.endpoints.info} />
      </section>
    </AdminShell>
  );
}
