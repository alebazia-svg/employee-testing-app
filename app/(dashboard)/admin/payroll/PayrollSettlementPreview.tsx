'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
export function EmployeeCardOverlay({ modal, name, onClose, children }: { modal: boolean; name: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!modal) return;
    const dialog = ref.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = previousOverflow; };
  }, [modal]);
  if (!modal) return <div className='fixed inset-0 z-50 flex justify-end bg-slate-950/45'>{children}</div>;
  return <dialog ref={ref} aria-label={`Расчёт зарплаты: ${name}`} className='settlement-employee-dialog' onCancel={onClose} onClick={event => {
    if (event.target === event.currentTarget) onClose();
  }}>{children}</dialog>;
}
export type SettlementExample = { name: string; paid: number; remaining: number; document?: string; accrual?: number; calculation?: {gross: number; components: [string, number][]}; note?: string; first?: number; advance?: number; other?: number; firstDocument?: string; advancePayments?: {date: string; amount: number; doc: string}[] };
const money = (n: number) => Number.isFinite(n) ? `${n.toLocaleString('ru-RU', {minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2})} ₽` : 'Не сверено';
const total = (r: SettlementExample) => r.paid + (r.first || 0) + (r.advance || 0) + (r.other || 0);
export function verifiedSettlementRemainder(row: SettlementExample | undefined, gross: number, deduction: number): number | null {
  if (!row || row.accrual === undefined || ![gross, deduction, row.accrual, total(row)].every(Number.isFinite) || Math.abs(row.accrual - gross) > 0.005 || deduction !== 0) return null;
  return Math.round((gross - deduction - total(row)) * 100) / 100;
}
export function findSettlement(rows: SettlementExample[] | undefined, name: string | null, period: string) {
  const aliases: Record<string, string> = { 'СтажерРозница · поклейка (09.2026)': 'Стажёр розницы · поклейка', 'Даудова Татьяна': 'Татьяна' };
  return rows?.find(r => r.name === (aliases[name || ''] || name) && period === (r.accrual !== undefined ? '2026-10' : '2026-09'));
}
export function SettlementCardPayments({ row }: { row?: SettlementExample }) {
  if (!row) return <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Выплаты за этот месяц ещё не сопоставлены. Это не означает, что выплат не было.</p>;
  const payments = [
    ...(row.advancePayments ? row.advancePayments.map(p => ({...p, label: 'Аванс за сентябрь'})) : row.advance ? (row.name.includes('Стажёр') ? [
      { date: '17 сентября', amount: 15000, doc: '00OF-001697', label: 'Аванс за сентябрь' },
      { date: '7 октября', amount: 5000, doc: '00OF-001849', label: 'Аванс за сентябрь' },
    ] : [{ date: '28 сентября', amount: row.advance, doc: '00OF-001769', label: 'Аванс за сентябрь' }]) : []),
    ...(row.first ? [{ date: '1 октября', amount: row.first, doc: row.firstDocument || '00OF-001802', label: 'Выплата' }] : []),
    ...(row.other ? [{ date: '7 октября', amount: row.other, doc: '00OF-001879', label: 'Выплата' }] : []),
    ...(row.paid ? [{ date: '16 октября', amount: row.paid, doc: row.document, label: row.accrual !== undefined ? 'Аванс за октябрь' : 'Выплата' }] : []),
  ];
  return <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-bold">Выплаты и авансы</h3>
    <p className="mt-1 text-sm text-slate-600">Всего выдано: <strong>{money(total(row))}</strong></p>
    <div className="mt-3 divide-y divide-slate-100">{payments.map(p => <div key={`${p.doc}-${p.label}`} className="flex justify-between gap-3 py-3 text-sm"><div><strong>{p.date} · {p.label}</strong><p className="mt-1 text-xs text-slate-500">Расходник № {p.doc}</p></div><strong className="whitespace-nowrap tabular-nums">{money(p.amount)}</strong></div>)}</div>
    {!payments.length && <p className="mt-3 text-sm text-slate-500">В проверенной выборке выплат не найдено.</p>}
    <p className="mt-2 text-xs text-slate-500">{row.remaining === 0 ? 'По данным 1С на 16 октября задолженности перед сотрудником нет.' : `Всего осталось выдать: ${money(row.remaining)}. По данным 1С, включая прошлые месяцы.`}</p>
  </section>;
}

// Authenticated local approval snapshot; no source writes or saved allocations.
export default function PayrollSettlementPreview({ rows, children, periodKey, periodPicker, onOpenEmployee }: { rows?: SettlementExample[]; children: (openCard: (name: string, period: string) => boolean) => ReactNode; periodKey: string; periodPicker: ReactNode; onOpenEmployee: (name: string) => boolean }) {
  const [tab, setTab] = useState('accruals');
  const [selected, setSelected] = useState<SettlementExample | null>(null);
  const [cardTab, setCardTab] = useState('history');
  const [cardPeriod, setCardPeriod] = useState('2026-09');
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close(); }, [selected]);
  useEffect(() => { setSelected(null); }, [periodKey]);
  if (!rows) return <>{children(() => false)}</>;
  const open = (r: SettlementExample, detail = 'history') => { if (onOpenEmployee(r.name)) return; setCardPeriod(r.accrual !== undefined ? '2026-10' : '2026-09'); setSelected(r); setCardTab(detail); };
  const openCard = (name: string, period: string) => {
    const aliases: Record<string, string> = { 'СтажерРозница · поклейка (09.2026)': 'Стажёр розницы · поклейка', 'Даудова Татьяна': 'Татьяна' };
    const row = rows.find(r => r.name === (aliases[name] || name));
    const matching = row && period === (row.accrual !== undefined ? '2026-10' : '2026-09');
    setSelected(matching ? row : { name, paid: Number.NaN, remaining: Number.NaN });
    setCardPeriod(period);
    setCardTab('overview');
    return true;
  };
  const trainee = rows.find(r => r.accrual !== undefined)!;
  const september = rows.filter(r => r.accrual === undefined && r.name !== 'Икаев Асад');
  // Department layout of the approved September snapshot, not payroll rules.
  const departmentColumns = [
    [{ name: 'Закупки', names: ['Тохов Астемир'], tone: 'bg-amber-50/70' }, { name: 'Оптовые продажи', names: ['Ахобекова Залина', 'Хурзокова Лиана'], tone: 'bg-blue-50/70' }, { name: 'Операционное управление', names: ['Кештова Бэла'], tone: 'bg-violet-50/60' }],
    [{ name: 'Розничные продажи', names: ['Кумахова Диана', 'Чеченова Милана', 'Костеренко Магомед', 'Абшаева Зухра', 'Стажёр розницы · поклейка'], tone: 'bg-emerald-50/60' }],
    [{ name: 'Фиксированный оклад', names: ['Атабиева Марианна', 'Жамбекова Саида', 'Татьяна', 'Улубиев Марат'], tone: 'bg-slate-100/70' }],
  ];
  const advanceCard = <div className="mt-4 rounded-xl border border-slate-200 p-3"><div className="mb-2 flex justify-between gap-3"><h3 className="text-sm font-bold">Авансы за октябрь</h3><span className="text-xs text-slate-500">Не входят в сентябрь</span></div><button type="button" onClick={() => open(trainee)} className="flex w-full items-center justify-between gap-3 text-left text-sm"><span>Кумыков Мухаммед <span className="ml-2 text-slate-500">16 октября</span></span><strong className="whitespace-nowrap">7 500 ₽ ›</strong></button></div>;
  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><nav className="admin-section-tabs" aria-label="Разделы зарплаты">{[['accruals','Начисления'],['payments','Выплаты']].map(([key,label]) => <button key={key} type="button" aria-pressed={tab === key} onClick={() => setTab(key)} className={`admin-section-tab ${tab === key ? 'is-active' : ''}`}>{label}</button>)}</nav><span className="text-xs text-slate-500">Показ для согласования · данные 16.10.2026</span></div>
    <div className="mb-3">{periodPicker}</div>
    <div hidden={tab !== 'accruals' || periodKey === '2026-09'}><p className="mb-3 text-sm text-slate-500">Показ локального расчёта. Данные этого месяца ещё не сопоставлены с выплатами.</p>{children(openCard)}</div>
    {tab === 'accruals' && periodKey === '2026-09' && <section className="payroll-settlement-statement rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Сентябрь 2026 · финальный расчёт</h2><p className="mt-1 text-xs text-slate-500">Ведомость №1 · выплаты на 16 октября</p></div><p className="text-sm">Начислено <strong className="ml-2 text-lg tabular-nums">{money(september.reduce((sum, r) => sum + (r.calculation?.gross || 0), 0))}</strong></p></div>
      <p className="mb-3 text-xs text-slate-500">Напротив имени — начислено. Подробный расчёт и выплаты — в карточке.</p>
      <div className="grid gap-3 lg:grid-cols-2 min-[1100px]:grid-cols-3" aria-label="Начисления по отделам">{departmentColumns.map((column, index) => <div key={index} className="grid min-w-0 content-start gap-3">{column.map(group => <section key={group.name} className="overflow-hidden rounded-lg border border-slate-200" aria-label={group.name}>
        <h3 className={`px-3 py-2 text-xs font-bold text-slate-700 ${group.tone}`}>{group.name}</h3>
        <div className="divide-y divide-slate-100">{group.names.map(name => september.find(r => r.name === name)).filter((r): r is SettlementExample => Boolean(r)).map(r => <button key={r.name} type="button" onClick={() => open(r, 'overview')} className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-2 text-left hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-600">
          <span className="min-w-0 text-sm font-semibold text-slate-900">{r.name}</span><strong className="whitespace-nowrap text-sm tabular-nums">{r.calculation ? money(r.calculation.gross) : 'Не сверено'}</strong>
          <span className="col-span-2 text-xs leading-5 text-slate-500">{r.advance ? <>Авансы {money(r.advance)} · </> : null}{r.remaining === 0 ? 'Выплачено полностью' : <span className="text-amber-800">Остаток в 1С {money(r.remaining)}</span>}</span>
        </button>)}</div>
      </section>)}</div>)}</div>
      <p className="mt-3 text-xs text-slate-500">Остаток в 1С включает задолженность прошлых месяцев.</p>
    </section>}
    {tab === 'payments' && <section className="payroll-settlement-statement rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3 text-sm font-semibold">{periodKey === '2026-09' ? 'Выплаты за сентябрь · выдачи в октябре и авансы' : `Выплаты за ${periodKey}`}</div>
      {periodKey === '2026-09' ? <>
        <p className="mb-3 text-sm text-slate-500">Финальный расчёт сентября · выплаты и остатки на 16 октября</p>
        <div className="mb-3 flex flex-wrap justify-between gap-2 text-sm"><span>Выдано с учётом авансов <strong className="ml-2">{money(september.reduce((sum,r) => sum + total(r),0))}</strong></span><span className="text-xs text-slate-500">Нажмите на сотрудника для подробностей</span></div>
        <div className="rounded-xl border border-slate-200"><table className="payroll-settlement-table text-left text-sm" aria-label="Выплаты сотрудникам за сентябрь">
          <thead className="bg-slate-50 text-xs text-slate-600"><tr>
            {['Сотрудник', 'Расчёт сентября', 'Авансы', '1 октября', '16 октября', 'Остаток · все месяцы'].map((label, i) => <th key={label} scope="col" className={`px-3 py-3 ${i ? 'text-right' : ''} ${i === 5 ? 'bg-stone-100' : ''}`}>{label}</th>)}
          </tr></thead>
          <tbody>{september.map(r => <tr key={r.name} className="border-t border-slate-100 hover:bg-slate-50/60">
            <td className="px-3 py-3"><button type="button" onClick={() => open(r)} className="text-left font-semibold hover:underline">{r.name} <span className="text-slate-400">›</span></button>{r.other ? <button type="button" onClick={() => open(r)} className="mt-1 block text-left text-xs text-slate-600 hover:underline">7 октября · {money(r.other)}</button> : null}</td>
            <td data-label="Расчёт сентября" className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{r.calculation ? <button type="button" onClick={() => open(r)} className="hover:underline">{money(r.calculation.gross)}</button> : 'Не сверено'}</td>
            <td data-label="Авансы" className="px-3 py-3 text-right tabular-nums">{r.advance ? <button onClick={() => open(r)} className="text-right hover:underline"><strong className="whitespace-nowrap">{money(r.advance)}</strong><span className="mt-1 block text-xs text-slate-500">{r.advancePayments ? r.advancePayments.map(p => p.date).join(' · ') : r.name.includes('Стажёр') ? '17.09 · 07.10' : '28.09'}</span></button> : <span className="text-slate-400">—</span>}</td>
            {[r.first, r.paid].map((amount, i) => <td key={i} data-label={['1 октября', '16 октября'][i]} className="px-3 py-3 text-right tabular-nums">{amount ? <button onClick={() => open(r)} className="whitespace-nowrap text-right font-semibold hover:underline">{money(amount)}</button> : <span className="text-slate-400">—</span>}</td>)}
            <td data-label="Остаток по всем месяцам" className="bg-stone-50 px-3 py-3 text-right"><button type="button" onClick={() => open(r)} className={`font-semibold tabular-nums hover:underline ${r.remaining > 0 ? 'text-amber-800' : 'text-slate-500'}`}>{r.remaining === 0 ? 'Выплачено полностью' : money(r.remaining)}</button></td>
          </tr>)}</tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-bold"><tr><td className="px-3 py-3">Итого по датам</td><td />{[['Авансы', 'advance'], ['1 октября', 'first'], ['16 октября', 'paid']].map(([label, field]) => <td key={field} data-label={label} className="whitespace-nowrap px-3 py-3 text-right">{money(september.reduce((sum,r) => sum + (Number(r[field as 'advance' | 'first' | 'paid']) || 0),0))}</td>)}<td /></tr></tfoot>
        </table></div>
        <p className="mt-2 text-xs text-slate-500">В другие даты выдано {money(september.reduce((sum,r) => sum + (r.other || 0),0))} — указано рядом с именами и включено в общую сумму.</p>
        <details className="mt-3 text-sm text-slate-500"><summary className="cursor-pointer">Как читать суммы</summary><p className="mt-2 leading-6">Расчёт взят из финальной ведомости. Выплаты — из расходников. Остаток показывает задолженность по всем месяцам в 1С; округления не создают новый долг. «—» — выдач не найдено. Состав выплаты Марианны ещё сверяется.</p></details>
        {advanceCard}
        <details className="mt-3 text-xs text-slate-500"><summary className="cursor-pointer">Другие остатки</summary><div className="mt-2 space-y-2"><p>Другие остатки 1С: Канукоев Марат — 20 ₽; Кештов Аслан — 150 ₽; Токбаев Юрий — 16 000 ₽. Без сотрудника — 26 900 ₽ с противоположным знаком. Нужна отдельная сверка.</p></div></details>
      </> : periodKey === '2026-10' ? <div className="py-4"><h2 className="font-bold">Октябрь ещё идёт</h2><p className="mt-2 text-sm text-slate-500">Окончательная зарплата выплачивается в ноябре. Сейчас учитываем выданные авансы.</p>{advanceCard}<p className="mt-3 text-xs text-slate-500">Здесь показан подтверждённый вами аванс. Полная ведомость октября пока не сопоставлена.</p></div> : <div className="py-6"><h2 className="font-bold">История за выбранный месяц ещё не сверена</h2><p className="mt-2 text-sm leading-6 text-slate-600">Нужно сопоставить выплаты с начислением за выбранный месяц и прежним долгом.</p><p className="mt-2 text-sm text-slate-500">Отсутствие сверки не означает нулевую зарплату или отсутствие долга.</p></div>}
    </section>}
    <dialog ref={dialog} aria-label={selected?.name} onCancel={() => setSelected(null)} onClick={e => { if (e.target === e.currentTarget) setSelected(null); }} className="m-auto w-[calc(100%-24px)] max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-slate-900/35 sm:p-6">{selected && <>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-bold">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{cardPeriod === '2026-09' ? 'Сентябрь 2026' : cardPeriod === '2026-10' ? 'Октябрь 2026' : cardPeriod}{selected.accrual !== undefined ? ' · расчёт за 12–16 октября' : ''}</p></div><button type="button" autoFocus onClick={() => setSelected(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">Закрыть</button></div>
      <div className="my-5 grid grid-cols-2 gap-3 sm:grid-cols-4">{[
        ['Начислено', selected.calculation ? money(selected.calculation.gross) : selected.accrual !== undefined ? money(selected.accrual) : 'Не сверено'],
        ['Выплачено', money(total(selected))],
        ['Удержано', selected.accrual !== undefined || selected.calculation ? '0 ₽' : 'Не сверено'],
        ['Остаток · все месяцы', selected.remaining === 0 ? 'Выплачено полностью' : money(selected.remaining)],
      ].map(([label,value]) => <div key={label} className={`rounded-xl p-3 ${label === 'Осталось выплатить' && selected.accrual !== undefined ? 'bg-emerald-50' : 'bg-slate-50'}`}><p className="text-xs text-slate-500">{label}</p><strong className="mt-1 block text-lg">{value}</strong></div>)}</div>
      <p className="mb-4 text-xs leading-5 text-slate-500">{selected.accrual !== undefined ? 'Выданные 7 500 ₽ учитываются как аванс за октябрь; месяц ещё не закрыт.' : selected.remaining === 0 ? 'По данным 1С на 16 октября задолженности перед сотрудником нет. Разница с расчётом портала не добавляется к долгу.' : Number.isFinite(selected.remaining) ? `Осталось выплатить по всем месяцам: ${money(selected.remaining)}. Включает прежнюю задолженность.` : 'Выплаты за этот месяц пока не сопоставлены. Данные другого месяца сюда не подставляются.'}</p>
      <nav className="admin-section-tabs mb-4" aria-label="Подробности сотрудника">{[['overview','Начисления'],['history','Выплаты и авансы']].map(([key,label]) => <button key={key} type="button" aria-pressed={cardTab === key} onClick={() => setCardTab(key)} className={`admin-section-tab ${cardTab === key ? 'is-active' : ''}`}>{label}</button>)}</nav>
      {cardTab === 'overview' ? selected.calculation ? <section><h3 className="font-semibold">Состав начисления за сентябрь</h3><dl className="mt-3 divide-y divide-slate-100">{selected.calculation.components.map(([label, amount]) => <div key={label} className="flex justify-between gap-4 py-3 text-sm"><dt>{label}</dt><dd className="whitespace-nowrap font-semibold tabular-nums">{money(amount)}</dd></div>)}</dl><p className="mt-3 text-xs leading-5 text-slate-500">Финальная ведомость №1. Это расчёт до округления к выдаче; разница с выданной суммой сама по себе не означает долг. Компоненты округлены отдельно.</p></section> : <p className="text-sm leading-6 text-slate-600">{selected.accrual !== undefined ? '12–16 октября: 5 подтверждённых дней × 1 500 ₽ = 7 500 ₽. Выплату учитываем как аванс, а не окончательный расчёт за октябрь.' : 'Утверждённое начисление за выбранный месяц ещё не сопоставлено с выплатами в этом показе. Сумму зарплаты не восстанавливаем из выданных денег.'}</p> : <div className="space-y-3 text-sm">
        {!Number.isFinite(selected.paid) && <p className="text-slate-500">История выплат за выбранный месяц ещё не подключена.</p>}
        {selected.advance ? <div className="flex justify-between gap-3 border-b border-slate-100 pb-3"><span><strong>Авансы за сентябрь</strong><span className="mt-1 block text-xs text-slate-500">{selected.advancePayments ? selected.advancePayments.map(p => `${p.date}: ${money(p.amount)} · № ${p.doc}`).join('; ') : selected.name.includes('Стажёр') ? '17 сентября: 15 000 ₽ · № 001697; 7 октября: 5 000 ₽ · № 001849' : '28 сентября · № 001769'}</span></span><strong className="whitespace-nowrap">{money(selected.advance)}</strong></div> : null}
        {selected.first ? <div className="flex justify-between border-b border-slate-100 pb-3"><span><strong>1 октября</strong><span className="mt-1 block text-xs text-slate-500">Расходник № {selected.firstDocument || '00OF-001802'}</span></span><strong>{money(selected.first)}</strong></div> : null}
        {selected.other ? <div className="flex justify-between border-b border-slate-100 pb-3"><span>7 октября · № 00OF-001879</span><strong>{money(selected.other)}</strong></div> : null}
        {selected.paid ? <div className="flex justify-between border-b border-slate-100 pb-3"><span><strong>16 октября{selected.accrual !== undefined ? ' · аванс' : ''}</strong><span className="mt-1 block text-xs text-slate-500">Расходник № {selected.document}</span></span><strong>{money(selected.paid)}</strong></div> : null}
        {total(selected) === 0 && <p className="text-slate-500">С 1 по 16 октября выплат не найдено.</p>}
        {selected.accrual !== undefined && <p className="text-xs text-slate-500">Месяц указан по вашему решению. Расходник в 1С не изменён.</p>}
      </div>}
    </>}</dialog>
  </>;
}
