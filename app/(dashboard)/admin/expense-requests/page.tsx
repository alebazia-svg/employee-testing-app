import Link from 'next/link';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Search } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { ProcurementDeliveryAdminSection } from '@/components/ProcurementDeliveryAdminSection';
import { ProcurementDataRefresh } from '@/components/ProcurementDataRefresh';
import { ExpenseRequestDialogRow } from '@/components/ExpenseRequestDialogRow';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { expenseText, type ExpenseListItem } from '@/lib/expense-request-list-view';
import {expenseListItem} from '@/lib/expense-request-list-item';

export const dynamic = 'force-dynamic';
type SearchParams = { view?: string; q?: string; deliveryCursor?: string; stage?: string; request?: string };
export default async function ExpenseRequestsAdminPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const params = await searchParams;
  const history = ['all','history','reviewed'].includes(params?.view || '');
  const query = expenseText(params?.q), search = query.toLocaleLowerCase('ru-RU');
  const filter = ['decision','issuance'].includes(params?.stage || '') ? params!.stage! : 'all';
  const loadBatch = (cursor?: string) => prisma.expenseRequestAdminCase.findMany({
    where: history ? {} : { currentCycleOrigin: 'live', deletionMark: false, OR: [{ isNotApproved: true }, { currentStatusKey: { in: ['approved','payable'] } }] },
    orderBy: history ? [{oneCDate:'desc'},{id:'desc'}] : [{enteredNotApprovedAt:{sort:'asc',nulls:'last'}},{oneCDate:'asc'},{id:'asc'}],
    take:500,
    ...(cursor ? {cursor:{id:cursor},skip:1} : {}),
    include:{evaluations:{orderBy:{evaluatedAt:'desc'},take:1}},
  });
  const toItem = expenseListItem;
  const toRows = (cases: Awaited<ReturnType<typeof loadBatch>>) => cases.map(toItem).filter(item => history ? item.archived || item.stage === 'closed' || !['not_approved','approved','payable'].includes(item.statusKey) : item.stage !== 'closed')
    .filter(item => !search || [item.number,item.person,item.purpose,item.comment,item.article,item.operation,item.cashbox,String(item.amount)].some(s => s.toLocaleLowerCase('ru-RU').includes(search)))
    .filter(item => history || filter === 'all' || item.stage === filter);
  let cursor: string | undefined, checkedAt = '';
  const collected: ExpenseListItem[] = [];
  // Scan past completed documents before limiting the visible queue. A page of
  // old payable documents must never conceal newer requests needing a decision.
  while (true) {
    const batch = await loadBatch(cursor);
    for (const item of batch) checkedAt = item.lastSeenAt.toISOString() > checkedAt ? item.lastSeenAt.toISOString() : checkedAt;
    collected.push(...toRows(batch));
    if (batch.length < 500) break;
    cursor = batch[batch.length-1].id;
  }
  const hasMore = collected.length > 200;
  const rows = collected.sort((a,b) => history ? Date.parse(b.date || '')-Date.parse(a.date || '') : ({decision:0,check:1,issuance:2,closed:3}[a.stage]-{decision:0,check:1,issuance:2,closed:3}[b.stage] || Date.parse(a.since || a.date || '')-Date.parse(b.since || b.date || ''))).slice(0,200);
  const requestedCase = params?.request ? await prisma.expenseRequestAdminCase.findFirst({where:{id:params.request},include:{evaluations:{orderBy:{evaluatedAt:'desc'},take:1}}}) : null;
  const empty = <div className="px-5 py-12 text-center"><p className="font-semibold text-slate-900">{query ? 'Ничего не найдено' : history ? 'Завершённых заявок пока нет' : 'В показанной очереди заявок нет'}</p><p className="mt-2 text-sm text-slate-500">{query ? 'Измените запрос или сбросьте поиск.' : 'Статусы обновляются при синхронизации с 1С.'}</p></div>;
  return <AdminShell pageTitle="Заявки на расходы" pageDescription="Согласование и контроль выдачи денег" headerWidthClass="max-w-[1320px]">
    <div className="mx-auto w-full max-w-[1320px]">
      {requestedCase && <ExpenseRequestDialogRow item={toItem(requestedCase)} initialOpen detailOnly/>}
      {params?.request && !requestedCase && <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Заявка не найдена. Проверьте номер в списке.</p>}
      <div className="grid grid-cols-1 items-center gap-x-4 sm:flex">
      <nav aria-label="Разделы заявок" className="admin-section-tabs min-w-0 flex-1">
        <Link href="/admin/expense-requests" aria-current={!history?'page':undefined} className="admin-section-tab">В работе</Link>
        <Link href="/admin/expense-requests?view=history" aria-current={history?'page':undefined} className="admin-section-tab">История</Link>
      </nav>
      <ProcurementDataRefresh checkedAt={checkedAt} label="Данные на" compact pauseWhileDialogOpen/>
      </div>
      <form className="my-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]" action="/admin/expense-requests" method="get">
        {history && <input type="hidden" name="view" value="history"/>}
        <label className="relative col-span-2 min-w-0 sm:col-span-1"><span className="sr-only">Поиск заявок</span><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-500"/><input name="q" defaultValue={query} placeholder="Сотрудник, номер или назначение" className="min-h-11 w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm"/></label>
        {!history && <label className="flex min-w-0 items-center text-sm text-slate-600"><span className="sr-only">Статус</span><select name="stage" defaultValue={filter} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800"><option value="all">Все в работе</option><option value="decision">Ждут решения</option><option value="issuance">Ждут выдачи</option></select></label>}
        <button type="submit" className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700">Найти</button>
        {(query || filter!=='all') && <Link className="text-sm text-[#754725] underline" href={`/admin/expense-requests${history?'?view=history':''}`}>Сбросить</Link>}
      </form>
      <section aria-label="Заявки на расходы" className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <Suspense fallback={<><p role="status" className="px-5 py-3 text-sm text-slate-500">Обновляем подотчёт…</p>{rows.map(item=><ExpenseRequestDialogRow key={item.id} item={item}/>)}</>}>
          <ProcurementDeliveryAdminSection history={history} cursor={params?.deliveryCursor} query={query} stageFilter={filter} hasMoreNative={hasMore} empty={empty} rows={rows.map(item=>({id:item.id,nativeRef:item.nativeRef,date:item.date || item.checkedAt,queueSince:item.since,stage:item.stage === 'closed'?'check':item.stage,content:<ExpenseRequestDialogRow item={item}/>}))}/>
        </Suspense>
      </section>
    </div>
  </AdminShell>;
}
