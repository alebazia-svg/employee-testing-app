import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2, CircleAlert, History, Info } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ExpenseRequestFeedbackClient } from '../ExpenseRequestFeedbackClient';
import { ExpenseRequestSeenClient } from '../ExpenseRequestSeenClient';

export const dynamic = 'force-dynamic';

function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function text(value: unknown) { return String(value ?? '').trim(); }
function nestedName(source: Record<string, unknown>, key: string) { return text(record(source[key]).name); }
function list(value: unknown) { return Array.isArray(value) ? value.map(String) : []; }
function money(value: unknown) { const number = Number(value); return Number.isFinite(number) ? `${number.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽` : '—'; }
function dateTime(value: Date | null) { return value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Moscow' }).format(value) : '—'; }
function feedbackLabel(value: string) {
  return ({ normal: 'Всё нормально', clarification_required: 'Действительно нужно уточнить', hint_unnecessary: 'Подсказка лишняя', rule_change_required: 'Правило нужно изменить' } as Record<string, string>)[value] ?? value;
}
const categoryLabels: Record<string, string> = {
  supplier_payment: 'Оплата поставщику', customer_refund: 'Возврат клиенту', accountable_advance: 'Подотчёт',
  salary: 'Зарплата', goods_delivery: 'Доставка товара', money_to_supplier: 'Отправка денег поставщику',
  communications: 'Связь / интернет', works_services: 'Работы / услуги', materials: 'Материалы',
  stationery: 'Канцтовары', household_purchase: 'Хозяйственные покупки', packaging: 'Упаковка',
  rent_utilities: 'Аренда / коммунальные услуги', other_expense: 'Другой расход', unknown: 'Не определена',
};
const completenessLabels: Record<string, string> = {
  complete: 'Данных достаточно', needs_clarification: 'Нужно уточнение', needs_document: 'Нужен документ',
  needs_review: 'Нужен просмотр ADMIN', cannot_determine: 'Нельзя определить однозначно',
};
const confidenceLabels: Record<string, string> = { high: 'высокая', medium: 'средняя', low: 'низкая' };
const executionLabels: Record<string, string> = {
  not_executed: 'Не исполнена', partially_executed: 'Частично исполнена', fully_executed: 'Полностью исполнена',
  unavailable: 'Данные недоступны', needs_review: 'Нужен просмотр ADMIN',
};
const missingLabels: Record<string, string> = {
  delivery_origin: 'откуда / от какого поставщика', delivery_contents: 'что доставляли', delivery_destination: 'куда / кому доставили',
  money_recipient: 'получатель денег', money_obligation: 'основание обязательства', internet_account_or_object: 'объект / лицевой счёт',
  internet_period: 'период оплаты', work_provider: 'исполнитель', work_scope: 'содержание работы', work_object: 'объект работ',
  supplier: 'поставщик', payment_basis: 'основание оплаты', accountable_purpose: 'цель подотчёта',
  accountable_deadline: 'срок отчёта', purchase_description: 'что приобретается', return_source_document: 'основание возврата',
};

function Fact({ label, value, wide = false }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return <div className={`rounded-xl bg-slate-50 px-4 py-3 ${wide ? 'sm:col-span-2' : ''}`}><p className='text-[11px] font-extrabold uppercase tracking-wide text-slate-400'>{label}</p><div className='mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-800'>{value || '—'}</div></div>;
}

export default async function ExpenseRequestDetailPage({ params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin) redirect('/login');
  if (admin.role !== 'ADMIN') redirect('/employee');
  const item = await prisma.expenseRequestAdminCase.findUnique({
    where: { id: params.id },
    include: {
      evaluations: { orderBy: { evaluatedAt: 'desc' }, take: 10 },
      feedback: { orderBy: { createdAt: 'desc' }, include: { reviewedBy: { select: { name: true } }, evaluation: { select: { ruleVersion: true } } } },
    },
  });
  if (!item) notFound();
  const evaluation = item.evaluations[0] ?? null;
  const source = record(evaluation?.normalizedSource);
  const execution = record(source.execution);
  const reasonCodes = list(evaluation?.reasonCodes);
  const missing = list(evaluation?.missingInformation);
  const sourceDocument = nestedName(source, 'sourceDocument');
  const counterparty = nestedName(source, 'partner') || nestedName(source, 'counterparty');

  return (
    <AdminShell>
      <ExpenseRequestSeenClient caseId={item.id} />
      <AdminBreadcrumbs current='Карточка заявки' />
      <Link href='/admin/expense-requests' className='mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-950'><ArrowLeft className='h-4 w-4' />К списку заявок</Link>
      <div className='mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
        <div>
          <div className='flex flex-wrap items-center gap-2'>
            <h1 className='text-2xl font-extrabold text-slate-950'>Заявка {item.oneCNumber || 'без номера'}</h1>
            {!item.seenAt && <span className='rounded-full bg-amber-400 px-2.5 py-1 text-xs font-extrabold text-slate-950'>Новая</span>}
          </div>
          <p className='mt-1 text-sm font-medium text-slate-500'>{dateTime(item.oneCDate)} · появление в очереди №{item.notApprovedCycle}</p>
        </div>
        <div className='rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700'>{item.currentStatusName || item.currentStatusKey || 'Статус не указан'}</div>
      </div>

      <div className='mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,0.8fr)]'>
        <div className='space-y-5'>
          <section className='rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80'>
            <h2 className='text-lg font-extrabold text-slate-950'>Данные из 1С</h2>
            <div className='mt-4 grid gap-3 sm:grid-cols-2'>
              <Fact label='КтоЗаявил' value={item.requestedByName} />
              <Fact label='Сумма' value={money(item.amount)} />
              <Fact label='Хозяйственная операция' value={nestedName(source, 'businessOperation') || item.businessOperationName} />
              <Fact label='Статья ДДС' value={nestedName(source, 'cashFlowItem')} />
              <Fact label='Контрагент / партнёр' value={counterparty} />
              <Fact label='Документ-основание' value={sourceDocument} />
              <Fact label='Назначение платежа' value={text(source.paymentPurpose)} wide />
              <Fact label='Комментарий' value={text(source.comment)} wide />
              <Fact label='Исполнение' value={executionLabels[text(execution.state)] || text(execution.state) || 'Нет данных'} />
              <Fact label='Исполнено / осталось' value={`${money(execution.executed_amount)} / ${money(execution.remaining_amount)}`} />
            </div>
          </section>

          <section className='rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80'>
            <div className='flex items-start gap-3'>
              <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700'><Info className='h-5 w-5' /></div>
              <div><h2 className='text-lg font-extrabold text-slate-950'>Подсказка автоматической проверки</h2><p className='mt-1 text-xs font-medium text-slate-500'>Совет только для ADMIN. Он ничего не блокирует и не отправляется сотруднику.</p></div>
            </div>
            {evaluation ? (
              <div className='mt-4 space-y-4'>
                <div className='grid gap-3 sm:grid-cols-3'>
                  <Fact label='Категория' value={categoryLabels[evaluation.category] || evaluation.category} />
                  <Fact label='Состояние' value={completenessLabels[evaluation.completenessState] || evaluation.completenessState} />
                  <Fact label='Уверенность' value={`${confidenceLabels[evaluation.confidence] || evaluation.confidence}${evaluation.ambiguous ? ' · неоднозначно' : ''}`} />
                </div>
                {evaluation.suggestedQuestion && <div className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'><p className='text-xs font-extrabold uppercase text-amber-700'>Возможное уточнение</p><p className='mt-1 text-sm font-semibold text-amber-950'>{evaluation.suggestedQuestion}</p></div>}
                <div>
                  <p className='text-xs font-extrabold uppercase tracking-wide text-slate-400'>Что engine считает отсутствующим</p>
                  <div className='mt-2 flex flex-wrap gap-2'>{missing.length ? missing.map((value) => <span key={value} className='rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900'>{missingLabels[value] || value}</span>) : <span className='text-sm font-semibold text-green-700'>Ничего</span>}</div>
                </div>
                <details className='rounded-xl border border-slate-200 bg-slate-50 px-4 py-3'>
                  <summary className='cursor-pointer text-xs font-bold text-slate-600'>Техническая диагностика</summary>
                  <div className='mt-3 flex flex-wrap gap-2'>{reasonCodes.map((value) => <span key={value} className='rounded-full bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-slate-600 ring-1 ring-slate-200'>{value}</span>)}</div>
                  <p className='mt-3 text-xs font-medium text-slate-400'>Версия правил: {evaluation.ruleVersion} · источник полный: {evaluation.sourceComplete ? 'да' : 'нет'}</p>
                </details>
              </div>
            ) : <p className='mt-4 text-sm font-semibold text-slate-500'>Оценка ещё не выполнена.</p>}
          </section>
        </div>

        <div className='space-y-5'>
          <section className='rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80'>
            <ExpenseRequestFeedbackClient caseId={item.id} reasonCodes={reasonCodes} />
          </section>
          <section className='rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80'>
            <div className='flex items-center gap-2'><History className='h-5 w-5 text-slate-500' /><h2 className='text-lg font-extrabold text-slate-950'>История feedback</h2></div>
            {item.feedback.length === 0 ? <p className='mt-4 text-sm font-medium text-slate-500'>Решений пока нет.</p> : (
              <div className='mt-4 space-y-3'>{item.feedback.map((entry) => <div key={entry.id} className='rounded-xl border border-slate-200 px-4 py-3'><div className='flex flex-wrap items-center justify-between gap-2'><p className='text-sm font-extrabold text-slate-900'>{feedbackLabel(entry.decision)}</p><span className='text-xs font-medium text-slate-400'>{dateTime(entry.createdAt)}</span></div><p className='mt-1 text-xs font-semibold text-slate-500'>{entry.scope === 'reason' ? `По причине: ${entry.reasonCode}` : 'Общий вывод'} · {entry.reviewedBy.name}</p>{entry.comment && <p className='mt-2 text-sm leading-relaxed text-slate-700'>{entry.comment}</p>}</div>)}</div>
            )}
          </section>
          <div className='rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-medium leading-relaxed text-green-900'><div className='flex gap-2'><CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0' /><p>Любой feedback сохраняется только в audit портала. Согласование, отклонение и изменение заявки в 1С здесь отсутствуют.</p></div></div>
        </div>
      </div>
    </AdminShell>
  );
}
