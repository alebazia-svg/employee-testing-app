import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, Eye, Inbox } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { expenseRequestCurrentWhere } from '@/lib/expense-request-admin-lifecycle';

export const dynamic = 'force-dynamic';

function money(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽` : '—';
}
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return String(value ?? '').trim(); }
function nestedName(source: Record<string, unknown>, key: string) { return text(record(source[key]).name); }

function dateTime(value: Date | null) {
  if (!value) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(value);
}

function engineLabel(state: string) {
  if (state === 'complete') return { text: 'Данных достаточно', className: 'bg-green-100 text-green-800', icon: CheckCircle2 };
  if (state === 'needs_review' || state === 'cannot_determine') return { text: 'Нужен просмотр', className: 'bg-slate-200 text-slate-700', icon: Eye };
  return { text: 'Есть подсказки', className: 'bg-amber-100 text-amber-900', icon: AlertCircle };
}

export default async function ExpenseRequestsAdminPage({ searchParams }: { searchParams?: { view?: string } }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const view = searchParams?.view === 'all' || searchParams?.view === 'reviewed' ? searchParams.view : 'current';
  const caseWhere = view === 'all' ? {} : view === 'reviewed' ? { reviewedAt: { not: null } } : expenseRequestCurrentWhere;
  const [cases, unreadCount, reviewedCount] = await Promise.all([
    prisma.expenseRequestAdminCase.findMany({
      where: caseWhere,
      orderBy: [{ seenAt: { sort: 'asc', nulls: 'first' } }, { oneCDate: 'desc' }],
      take: 200,
      include: {
        evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 },
        feedback: { where: { scope: 'overall' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.expenseRequestAdminCase.count({ where: { ...expenseRequestCurrentWhere, seenAt: null } }),
    prisma.expenseRequestAdminCase.count({ where: { ...expenseRequestCurrentWhere, reviewedAt: { not: null } } }),
  ]);
  const withHints = cases.filter((item) => item.latestCompletenessState !== 'complete').length;

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Заявки' />
      <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-[26px] font-extrabold tracking-normal text-slate-950 md:text-[28px]'>Заявки на расходование ДС</h1>
          <p className='mt-1 text-sm font-medium text-slate-500'>ADMIN-наблюдение. Портал ничего не меняет в 1С и не пишет сотрудникам.</p>
        </div>
        <div className='rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200'>Обновляется автоматически каждые 3 минуты</div>
      </div>

      <section className='mt-5 grid gap-3 sm:grid-cols-3'>
        {[
          { label: 'Непросмотренные', value: unreadCount, icon: Inbox, tone: 'text-amber-700 bg-amber-50' },
          { label: 'С подсказками', value: withHints, icon: AlertCircle, tone: 'text-slate-700 bg-slate-100' },
          { label: 'Feedback сохранён', value: reviewedCount, icon: CheckCircle2, tone: 'text-green-700 bg-green-50' },
        ].map((item) => <div key={item.label} className='rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80'><div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${item.tone}`}><item.icon className='h-5 w-5' /></div><p className='mt-3 text-2xl font-extrabold text-slate-950'>{item.value}</p><p className='text-sm font-semibold text-slate-500'>{item.label}</p></div>)}
      </section>

      <section className='mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
        <div className='border-b border-slate-200 px-5 py-4'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div><h2 className='text-lg font-extrabold text-slate-950'>{view === 'current' ? 'Не согласованы в 1С' : view === 'reviewed' ? 'С сохранённым feedback' : 'История всех заявок'}</h2><p className='mt-1 text-xs font-medium text-slate-500'>Новые находятся сверху. Engine показывает только совет администратору.</p></div>
            <div className='flex flex-wrap gap-2'>
              {[
                { key: 'current', label: 'Текущие', href: '/admin/expense-requests' },
                { key: 'reviewed', label: 'С feedback', href: '/admin/expense-requests?view=reviewed' },
                { key: 'all', label: 'Все', href: '/admin/expense-requests?view=all' },
              ].map((filter) => <Link key={filter.key} href={filter.href} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === filter.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{filter.label}</Link>)}
            </div>
          </div>
        </div>
        {cases.length === 0 ? (
          <div className='px-6 py-14 text-center'><CheckCircle2 className='mx-auto h-10 w-10 text-green-600' /><p className='mt-3 font-extrabold text-slate-950'>Новых заявок нет</p><p className='mt-1 text-sm text-slate-500'>Новая заявка со статусом «Не согласована» появится здесь после ближайшего автоматического обновления.</p></div>
        ) : (
          <div className='divide-y divide-slate-100'>
            {cases.map((item) => {
              const engine = engineLabel(item.latestCompletenessState);
              const EngineIcon = engine.icon;
              const source = record(item.evaluations[0]?.normalizedSource);
              const cashFlowItem = nestedName(source, 'cashFlowItem');
              const sourceDocument = nestedName(source, 'sourceDocument');
              const comment = text(source.comment || source.paymentPurpose);
              return (
                <Link key={item.id} href={`/admin/expense-requests/${item.id}`} className='group grid gap-3 px-5 py-4 transition hover:bg-slate-50 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center'>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2'>
                      {!item.seenAt && <span className='rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-slate-950'>Новая</span>}
                      {item.deletionMark && <span className='rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-800'>Удалена в 1С</span>}
                      <span className='font-extrabold text-slate-950'>{item.requestedByName || 'КтоЗаявил не указан'}</span>
                      <span className='text-sm font-bold text-slate-900'>{money(item.amount)}</span>
                    </div>
                    <p className='mt-1 truncate text-sm font-medium text-slate-600'>{item.businessOperationName || item.latestCategory || 'Операция не определена'}{cashFlowItem ? ` · ${cashFlowItem}` : ''}</p>
                    {comment && <p className='mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500'>{comment}</p>}
                    <p className='mt-1 flex items-center gap-1 text-xs font-medium text-slate-400'><Clock3 className='h-3.5 w-3.5' />{dateTime(item.oneCDate)} · {item.oneCNumber || 'без номера'}</p>
                  </div>
                  <div className='min-w-0'>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${engine.className}`}><EngineIcon className='h-3.5 w-3.5' />{engine.text}</span>
                    <p className='mt-2 truncate text-xs font-medium text-slate-500'>{item.counterpartyName || 'Контрагент/партнёр не указан'}{sourceDocument ? ` · ${sourceDocument}` : ''}</p>
                    {item.feedback[0] && <p className='mt-1 text-xs font-bold text-green-700'>Ваш вывод сохранён</p>}
                  </div>
                  <ChevronRight className='hidden h-5 w-5 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700 sm:block' />
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
