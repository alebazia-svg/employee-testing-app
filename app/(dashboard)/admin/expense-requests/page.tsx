import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, Inbox, Search } from 'lucide-react';
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
function normalize(value: unknown) { return text(value).toLocaleLowerCase('ru-RU'); }

function dateTime(value: Date | null) {
  if (!value) return 'Дата не указана';
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(value);
}

function engineLabel(state: string) {
  if (state === 'complete') return { text: 'Данных достаточно', className: 'bg-green-100 text-green-800', icon: CheckCircle2 };
  return { text: 'Нужно уточнить', className: 'bg-amber-100 text-amber-900', icon: AlertCircle };
}

type PageSearchParams = { view?: string; q?: string };

export default async function ExpenseRequestsAdminPage({ searchParams }: { searchParams?: PageSearchParams }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');

  const view = searchParams?.view === 'all' || searchParams?.view === 'reviewed' ? searchParams.view : 'current';
  const query = text(searchParams?.q);
  const normalizedQuery = normalize(query);
  const caseWhere = view === 'all' ? {} : view === 'reviewed' ? { reviewedAt: { not: null } } : expenseRequestCurrentWhere;
  const [cases, currentCases, reviewedTotal] = await Promise.all([
    prisma.expenseRequestAdminCase.findMany({
      where: caseWhere,
      orderBy: [{ seenAt: { sort: 'asc', nulls: 'first' } }, { oneCDate: 'desc' }],
      take: 200,
      include: {
        evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 1 },
        feedback: { where: { scope: 'overall' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    }),
    prisma.expenseRequestAdminCase.findMany({
      where: expenseRequestCurrentWhere,
      select: { seenAt: true, latestCompletenessState: true },
    }),
    prisma.expenseRequestAdminCase.count({ where: { reviewedAt: { not: null } } }),
  ]);

  const unreadCount = currentCases.filter((item) => !item.seenAt).length;
  const clarificationCount = currentCases.filter((item) => item.latestCompletenessState !== 'complete').length;
  const completeCount = currentCases.filter((item) => item.latestCompletenessState === 'complete').length;
  const visibleCases = cases.filter((item) => {
    if (!normalizedQuery) return true;
    const source = record(item.evaluations[0]?.normalizedSource);
    return [item.oneCNumber, item.requestedByName, item.businessOperationName, item.counterpartyName, source.comment, source.paymentPurpose, nestedName(source, 'cashFlowItem'), nestedName(source, 'sourceDocument')]
      .some((value) => normalize(value).includes(normalizedQuery));
  }).sort((left, right) => {
    if (view !== 'current') return 0;
    const leftNeedsAttention = left.latestCompletenessState === 'complete' ? 0 : 1;
    const rightNeedsAttention = right.latestCompletenessState === 'complete' ? 0 : 1;
    return rightNeedsAttention - leftNeedsAttention;
  });

  const tabs = [
    { key: 'current', label: `Текущие · ${currentCases.length}`, href: '/admin/expense-requests' },
    { key: 'reviewed', label: `Проверенные · ${reviewedTotal}`, href: '/admin/expense-requests?view=reviewed' },
    { key: 'all', label: 'История', href: '/admin/expense-requests?view=all' },
  ];
  const heading = view === 'current' ? 'Текущие заявки' : view === 'reviewed' ? 'Проверенные заявки' : 'История заявок';

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Заявки' />
      <div className='mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-[26px] font-extrabold tracking-normal text-slate-950 md:text-[28px]'>Заявки на расходы</h1>
          <p className='mt-1 text-sm font-medium text-slate-500'>Рабочая очередь заявок из 1С. Портал ничего не согласует и не изменяет в 1С.</p>
        </div>
        <div className='self-start rounded-full bg-white px-4 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-200 sm:self-auto'>Обновление каждые 3 минуты</div>
      </div>

      <section className='mt-5 grid gap-3 sm:grid-cols-3'>
        {[
          { label: 'Новые', value: unreadCount, hint: 'ещё не открыты', icon: Inbox, tone: 'text-amber-700 bg-amber-50' },
          { label: 'Нужно уточнить', value: clarificationCount, hint: 'по текущим заявкам', icon: AlertCircle, tone: 'text-amber-800 bg-amber-50' },
          { label: 'Данных достаточно', value: completeCount, hint: 'по текущим заявкам', icon: CheckCircle2, tone: 'text-green-700 bg-green-50' },
        ].map((item) => (
          <div key={item.label} className='flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80'>
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}><item.icon className='h-5 w-5' /></div>
            <div><p className='text-xl font-extrabold text-slate-950'>{item.value}</p><p className='text-sm font-bold text-slate-700'>{item.label}</p><p className='text-xs font-medium text-slate-400'>{item.hint}</p></div>
          </div>
        ))}
      </section>

      <section className='mt-5 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80'>
        <div className='border-b border-slate-200 px-5 py-4'>
          <div className='flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between'>
            <div><h2 className='text-lg font-extrabold text-slate-950'>{heading}</h2><p className='mt-1 text-xs font-medium text-slate-500'>{view === 'current' ? 'Сначала показаны заявки, по которым нужно уточнение.' : 'История не смешивается с текущей рабочей очередью.'}</p></div>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center'>
              <form action='/admin/expense-requests' method='get' className='flex min-w-0 items-center gap-2'>
                {view !== 'current' && <input type='hidden' name='view' value={view} />}
                <label className='relative min-w-0 flex-1 sm:w-72'>
                  <span className='sr-only'>Поиск заявок</span>
                  <Search className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <input name='q' defaultValue={query} placeholder='Номер, сотрудник или комментарий' className='w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-2 focus:ring-green-100' />
                </label>
                <button type='submit' className='rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800'>Найти</button>
              </form>
              <div className='flex flex-wrap gap-2'>
                {tabs.map((filter) => <Link key={filter.key} href={filter.href} className={`rounded-full px-3 py-1.5 text-xs font-bold ${view === filter.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{filter.label}</Link>)}
              </div>
            </div>
          </div>
        </div>

        {visibleCases.length === 0 ? (
          <div className='px-6 py-14 text-center'>
            <CheckCircle2 className='mx-auto h-10 w-10 text-green-600' />
            <p className='mt-3 font-extrabold text-slate-950'>{query ? 'Ничего не найдено' : view === 'current' ? 'Текущих заявок нет' : 'Заявок в этом разделе нет'}</p>
            <p className='mt-1 text-sm text-slate-500'>{query ? 'Попробуйте изменить запрос.' : 'Новая рабочая заявка появится после ближайшего автоматического обновления.'}</p>
            {query && <Link href={view === 'current' ? '/admin/expense-requests' : `/admin/expense-requests?view=${view}`} className='mt-4 inline-flex text-sm font-bold text-green-700 hover:text-green-800'>Сбросить поиск</Link>}
          </div>
        ) : (
          <div className='divide-y divide-slate-100'>
            {visibleCases.map((item) => {
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
                      {view === 'current' && !item.seenAt && <span className='rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-slate-950'>Новая</span>}
                      {item.deletionMark && <span className='rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-extrabold text-red-800'>Удалена в 1С</span>}
                      <span className='font-extrabold text-slate-950'>{item.requestedByName || 'Заявитель не указан'}</span>
                      <span className='text-sm font-bold text-slate-900'>{money(item.amount)}</span>
                    </div>
                    <p className='mt-1 truncate text-sm font-medium text-slate-600'>{item.businessOperationName || item.latestCategory || 'Операция не определена'}{cashFlowItem ? ` · ${cashFlowItem}` : ''}</p>
                    {comment && <p className='mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-slate-500'>{comment}</p>}
                    <p className='mt-1 flex items-center gap-1 text-xs font-medium text-slate-400'><Clock3 className='h-3.5 w-3.5' />{dateTime(item.oneCDate)} · {item.oneCNumber || 'без номера'}</p>
                  </div>
                  <div className='min-w-0'>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${engine.className}`}><EngineIcon className='h-3.5 w-3.5' />{engine.text}</span>
                    <p className='mt-2 truncate text-xs font-medium text-slate-500'>{item.counterpartyName || 'Контрагент не указан'}{sourceDocument ? ` · ${sourceDocument}` : ''}</p>
                    {item.feedback[0] && <p className='mt-1 text-xs font-bold text-green-700'>Подсказка оценена</p>}
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
