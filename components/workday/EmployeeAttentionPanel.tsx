'use client';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { PremiumDangerTriangleIcon, PremiumBillListIcon, PremiumClockIcon } from '@/components/PwaPreviewIcons';
import { useSearchParams } from 'next/navigation';
import type { EmployeeExpenseSnapshot } from '@/lib/employee-expense-policy';
import { startVisibleSync } from '@/lib/visible-sync';
import { orderEmployeeAttention, type EmployeeAttentionItem } from '@/lib/employee-attention';
import { useCashIssue } from '@/app/(dashboard)/employee/CashIssueClient';
import { cashIssueCompactCopy } from '@/lib/procurement-cash-issue-policy';
import { Button } from '@/components/ui/button';

type Item = EmployeeAttentionItem;
function Marker({ kind, waiting }: { kind: Item['kind']; waiting: boolean }) {
  const Icon = waiting ? PremiumClockIcon : kind === 'receipt' ? PremiumBillListIcon : PremiumDangerTriangleIcon;
  return <span className={`attention-preview-marker ${waiting ? 'is-waiting' : 'needs-action'}`} aria-hidden="true"><Icon color={waiting ? '#687078' : '#a85a08'} secondaryColor={waiting ? '#d5d9dc' : '#f6d58b'} secondaryOpacity={0.9} className="h-5 w-5 shrink-0" /></span>;
}

export function EmployeeAttentionPanel({ view, onBack, renderHandle, paletteClass, activeShift = false, onClosing, onExpenses }: {
  onExpenses?: (snapshot: EmployeeExpenseSnapshot) => void;
  view: string;
  activeShift?: boolean;
  onClosing: (scope?: 'encashment' | 'closing') => void;
  onBack: () => void;
  renderHandle: (onDismiss: () => void) => ReactNode;
  paletteClass: string;
}) {
  const preview = useEmployeePreview();
  const requestRead = preview?.request ?? fetch;
  const cashIssue = useCashIssue();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<Item['kind'] | null>(null);
  const [liveExpenses, setLiveExpenses] = useState<EmployeeExpenseSnapshot | null>(null);
  const [expenseUnavailable, setExpenseUnavailable] = useState(false);
  const expenseListener = useRef(onExpenses); expenseListener.current = onExpenses;
  const [liveItems, setLiveItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const requestSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await requestRead('/api/employee/workday-attention', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!Array.isArray(payload.items)) throw new Error();
      if (sequence === requestSequence.current) { setLiveItems(previous => payload.expenses?.state === 'unavailable' ? [...payload.items.filter((item: Item) => item.kind !== 'cash'), ...previous.filter(item => item.kind === 'cash')] : payload.items);
        setExpenseUnavailable(payload.expenses?.state === 'unavailable');
        if (payload.expenses) { if (payload.expenses.state !== 'unavailable') setLiveExpenses(payload.expenses); expenseListener.current?.(payload.expenses); }
        setLoadState('ready'); }
    } catch { if (sequence === requestSequence.current) setLoadState('error'); }
    finally { window.clearTimeout(timer); }
  }, []);
  useEffect(() => startVisibleSync(refresh, 30000), [refresh]);
  const request = activeShift ? cashIssue?.snapshot.request : null;
  const cashItem: Item[] = request ? [{ id: `cash-issue:${request.ref}`, kind: 'cash_issue', title: cashIssueCompactCopy(request).title, state: 'action', status: cashIssue?.snapshot.unavailable ? 'Нужно обновить данные' : cashIssueCompactCopy(request).subtitle, date: request.checkedAt, detail: 'Перед выдачей проверьте сумму и получателя.', priority: 0 }] : [];
  const payable = liveExpenses?.payable.filter(item => item.ref !== request?.ref);
  const ownItems = liveItems.flatMap(item => item.kind !== 'cash' || !payable ? [item] : payable.length ? [{ ...item, facts: payable.map(row => [`№${row.number} · ${row.purpose}`, `${row.remaining.toLocaleString('ru-RU')} ₽`] as [string,string]) }] : []);
  const allItems = orderEmployeeAttention([...ownItems, ...cashItem]);
  const items = allItems.filter(item => !scope || item.kind === scope);
  const entry = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const lastSelectedId = useRef<string | null>(null);
  const returnToList = () => setSelectedId(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const selected = items.find(item => item.id === selectedId);
  const reading = useRef(new Set<number>());
  useEffect(() => {
    if (preview || !open || !selected) return;
    for (const id of selected.notificationIds ?? []) {
      if (reading.current.has(id)) continue;
      reading.current.add(id);
      void fetch('/api/employee/workday-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(response => {
        if (!response.ok) throw new Error();
        setLiveItems(items => items.map(item => ({ ...item, notificationIds: item.notificationIds?.filter(value => value !== id) })));
      }).catch(() => reading.current.delete(id));
    }
  }, [open, selected, preview]);
  const close = () => { if (busy) return; setOpen(false); setSelectedId(null); setScope(null); };
  const openSheet = (kind: Item['kind'] | null = null, id: string | null = null) => {
    void refresh(); previousFocus.current = document.activeElement as HTMLElement;
    setScope(kind); const rows = allItems.filter(item => !kind || item.kind === kind);
    setSelectedId(id ?? (rows.length === 1 ? rows[0].id : null)); setOpen(true);
  };
  useEffect(() => {
    const listener = (event: Event) => { const detail = (event as CustomEvent).detail; openSheet(detail?.kind ?? null, detail?.id ?? null); };
    window.addEventListener('mobo:attention-open', listener);
    return () => window.removeEventListener('mobo:attention-open', listener);
  });
  const openedQuery = useRef(false);
  useEffect(() => { if (!openedQuery.current && ['cash', 'receipt', 'closing'].includes(searchParams.get('attention') ?? '')) { openedQuery.current = true; openSheet(searchParams.get('attention') as 'cash' | 'receipt' | 'closing', searchParams.get('item')); } }, [searchParams]);
  useEffect(() => { if (view === 'attention') { previousFocus.current = document.activeElement as HTMLElement; setOpen(true); setSelectedId(items.length === 1 ? items[0].id : null); onBack(); } }, [view, onBack, items]);
  const openItem = (id: string) => { setActionError(''); listScroll.current = scrollArea.current?.scrollTop ?? 0; lastSelectedId.current = id; setSelectedId(id); };
  const act = async (action: string) => {
    if (preview) { preview.blocked(); return; }
    if (!selected?.endpoint || busy) return;
    setBusy(true); setActionError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await requestRead(selected.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), signal: controller.signal });
      if (!response.ok) throw new Error();
      await refresh();
    } catch { setActionError('Не удалось отправить. Попробуйте ещё раз.'); }
    finally { window.clearTimeout(timer); setBusy(false); }
  };

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const buttons = () => Array.from(sheet.current?.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]') ?? []);
    buttons()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) { event.preventDefault(); setOpen(false); setSelectedId(null); }
      if (event.key !== 'Tab') return;
      const list = buttons(), first = list[0], last = list.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); previousFocus.current?.focus(); };
  }, [open, busy]);

  useEffect(() => {
    if (!open) return;
    if (scrollArea.current) scrollArea.current.scrollTop = selectedId ? 0 : listScroll.current;
    const restored = !selectedId && lastSelectedId.current ? Array.from(sheet.current?.querySelectorAll<HTMLElement>('[data-attention-item]') ?? []).find(element => element.dataset.attentionItem === lastSelectedId.current) : null;
    (restored ?? sheet.current?.querySelector<HTMLElement>('button'))?.focus({ preventScroll: true });
  }, [open, selectedId, selected?.state]);

  if (view === 'schedule' && !open) return null;
  const action = items.filter(item => item.state === 'action');
  const waiting = items.filter(item => item.state === 'waiting');
  return <>
    {loadState === 'error' && <button type="button" className="cash-discrepancy-trigger attention-preview-entry" onClick={() => void refresh()}>Не удалось обновить замечания · повторить</button>}
    {expenseUnavailable && <p className="px-1 text-xs text-slate-500" role="status">Заявки: не удалось обновить данные 1С.</p>}
    {view !== 'schedule' && allItems.length > 0 && <section className="employee-attention-groups" aria-label="Текущие действия">{[...new Set(allItems.map(item => item.kind))].map(kind => {
      const rows = allItems.filter(item => item.kind === kind), actionable = rows.some(item => item.state === 'action');
      const title = kind === 'receipt' ? 'Проверьте чеки' : kind === 'cash' ? 'Оформите расходники в 1С' : rows[0].title;
      const count = kind === 'cash' ? (payable?.length ?? 0) : rows.length;
      return <button key={kind} ref={entry} type="button" onClick={() => openSheet(kind)} aria-haspopup="dialog" className={`employee-attention-row ${rows.some(item => item.notificationIds?.length) ? 'employee-new-notice' : ''}`}>
        <span className="attention-preview-marker needs-action" aria-hidden="true"><Bell size={20} strokeWidth={1.7} className="text-[#a77550]"/></span>
        <span className="min-w-0 flex-1"><strong>{title}</strong><small className="employee-attention-caption">{kind === 'cash' ? 'Есть заявки к оплате' : !actionable ? rows[0].status : ''}{rows.some(item => item.notificationIds?.length) && <span className="employee-attention-new">Новое</span>}</small></span>
        {(kind === 'cash' ? count > 0 : count > 1) && <span className="shrink-0 text-xs font-bold tabular-nums text-stone-500" aria-label={kind === 'cash' ? `Заявок к оплате: ${count}` : undefined}>{count}</span>}<ChevronRight size={18} aria-hidden="true"/>
      </button>;
    })}</section>}
    {open && createPortal(<div className={`portal-neutral-design employee-material-ui employee-workday-sheet-overlay fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] md:items-center md:p-6 ${paletteClass}`} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={sheet} role="dialog" aria-modal="true" aria-labelledby="attention-preview-dialog-title" className="employee-material-sheet flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]">
        {renderHandle(close)}
        <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-2 pt-4"><div>{selected && items.length>1 && <button type="button" className="attention-preview-back" onClick={returnToList}><ArrowLeft size={16} aria-hidden="true"/>Назад</button>}<h2 id="attention-preview-dialog-title" className="text-[22px] font-black leading-tight text-slate-950">{selected?.title ?? (scope === 'receipt' ? 'Проверить чеки' : scope === 'cash' ? 'Заявки к оплате' : 'Замечания')}</h2><p className="mt-1 text-xs text-slate-500">{selected ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'}).format(new Date(selected.date)) : action.length ? `Нужно сделать: ${action.length}${waiting.length ? ` · на проверке: ${waiting.length}` : ''}` : `На проверке: ${waiting.length}`}</p></div><button type="button" onClick={close} disabled={busy} className="employee-material-sheet-close flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="Закрыть замечания"><X size={20}/></button></div>
        <div ref={scrollArea} className="min-h-0 overflow-y-auto overscroll-contain">{selectedId && !selected ? <div className="p-5"><p role="status" className="text-sm">{loadState === 'loading' ? 'Проверяем актуальность…' : loadState === 'error' || scope === 'cash' && expenseUnavailable ? 'Не удалось проверить актуальность. Повторите позже.' : 'Замечание больше не требует действий.'}</p><Button type="button" className="employee-material-secondary-action mt-3 w-full" onClick={returnToList}>К списку</Button></div> : selected ? <>
        <div className="px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2">
          <>
            {selected.shared && <p className="my-3 text-xs font-semibold text-amber-800">Общая задача смены</p>}
            <>{selected.kind !== 'cash' && <p className="my-3 text-sm text-slate-700">{selected.detail}</p>}</>
            {Boolean(selected.facts?.length) && <dl className="cash-discrepancy-sheet-facts">{selected.facts?.map(([label,value], index) => <div key={`${label}-${index}`} className="contents"><dt>{label}</dt><dd>{value}</dd></div>)}</dl>}
            {selected.kind === 'cash' && <p className="my-3 text-xs leading-relaxed text-slate-500">{expenseUnavailable ? 'Данные 1С не обновились. Проверьте статус заявки в 1С перед оформлением.' : selected.detail}</p>}
            {selected.reply && <div className="my-3 rounded-xl bg-stone-100 p-3"><p className="text-xs font-semibold text-slate-500">Ответ администратора</p><p className="mt-1 text-sm text-slate-800">{selected.reply}</p></div>}
            {selected.state === 'waiting' && <p role="status" className="my-3 text-sm font-semibold text-slate-700">{selected.status}</p>}
            {actionError && <p role="alert" className="my-3 text-sm text-red-800">{actionError}</p>}
            {selected.kind === 'cash_issue' && request && <Button type="button" className="employee-material-primary-action h-12 w-full" onClick={() => { close(); cashIssue?.open(request.ref); }}>Проверить выдачу</Button>}
            {selected.kind === 'closing' && selected.state === 'action' && <Button type="button" className="employee-material-primary-action h-12 w-full" onClick={() => { close(); onClosing(selected.closingScope); }}>Продолжить сдачу смены</Button>}
            {Boolean(selected.actions?.length) && <div className="grid gap-2">{selected.actions?.map(a => <Button key={a.action} type="button" disabled={busy || Boolean(preview)} title={preview ? "Только просмотр" : undefined} className="employee-material-secondary-action min-h-12 w-full" onClick={() => void act(a.action)}>{busy ? 'Отправляем…' : a.label}</Button>)}</div>}
            {selected.state === 'waiting' && !selected.actions?.length && <Button type="button" className="employee-material-secondary-action h-12 w-full" onClick={() => items.length > 1 ? returnToList() : close()}>Понятно</Button>}
          </>


        </div>
        </> : <div className="attention-preview-page px-5 pb-5 pt-2">
        {loadState === 'loading' && items.length === 0 && <p role="status" className="text-sm text-slate-500">Загружаем замечания…</p>}
        {loadState === 'ready' && items.length===0&&<div className="attention-preview-history"><CheckCircle2 size={20} aria-hidden="true"/><strong>Открытых замечаний нет</strong></div>}
        {[{ title: 'Нужно сделать', rows: action }, { title: 'Ожидает проверки', rows: waiting }].map(group => group.rows.length > 0 && <section className="attention-preview-group" key={group.title}><h3>{group.title}<span>{group.rows.length}</span></h3><div className="attention-preview-list">{group.rows.map(item => <button type="button" key={item.id} data-attention-item={item.id} onClick={() => openItem(item.id)}><Marker kind={item.kind} waiting={item.state === 'waiting'}/><span className="attention-preview-item-copy"><strong>{item.title}</strong><small>{item.shared ? 'Общая задача смены · ' : ''}{item.status}</small></span><ChevronRight size={18} aria-hidden="true"/></button>)}</div></section>)}
        {action.length === 0 && items.length > 0 && <p className="attention-preview-all-done"><CheckCircle2 size={18} aria-hidden="true"/>От вас сейчас ничего не требуется</p>}
        </div>}</div>
      </section>
    </div>, document.body)}
  </>;
}
