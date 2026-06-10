import { Activity, AlertTriangle, CheckCircle2, Clock, Server } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getAIAgentHealth, type OneCEndpointResult } from '@/lib/one-c';

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

export default async function AdminOneCPage() {
  const health = await getAIAgentHealth();
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

      <section className='grid gap-5 xl:grid-cols-3'>
        <EndpointCard title='Ping' result={health.endpoints.ping} />
        <EndpointCard title='Version' result={health.endpoints.version} />
        <EndpointCard title='Info' result={health.endpoints.info} />
      </section>
    </AdminShell>
  );
}
