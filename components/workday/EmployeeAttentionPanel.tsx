'use client';
import { InteractionShown, useInteractionAudit } from '@/components/EmployeeInteractionAudit';
import type { InteractionContext } from '@/lib/employee-interaction-policy';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';

import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ChevronRight, X, CheckCircle2 } from 'lucide-react';
import { PremiumClockIcon } from '@/components/PwaPreviewIcons';
import { useSearchParams } from 'next/navigation';
import type { EmployeeExpenseSnapshot } from '@/lib/employee-expense-policy';
import { startVisibleSync } from '@/lib/visible-sync';
import { employeeAttentionSummary, orderEmployeeAttention, type EmployeeAttentionItem } from '@/lib/employee-attention';
import { useCashIssue } from '@/app/(dashboard)/employee/CashIssueClient';
import { cashIssueCompactCopy } from '@/lib/procurement-cash-issue-policy';
import { Button } from '@/components/ui/button';
import { useActionReminderEnabled, usePublishAttentionReminder } from './EmployeeActionReminder';
import { EmployeeNoticeIcon } from './EmployeeNoticeIcon';
import { employeeAttentionIconKind } from '@/lib/employee-notice-icons';

type Item = EmployeeAttentionItem;
function Marker({ kind, waiting }: { kind: Item['kind']; waiting: boolean }) {
  return <span className={`attention-preview-marker ${waiting ? 'is-waiting' : 'needs-action'}`} aria-hidden="true">{waiting ? <PremiumClockIcon color='#687078' secondaryColor='#d5d9dc' secondaryOpacity={0.9} className='h-5 w-5 shrink-0' /> : <EmployeeNoticeIcon kind={employeeAttentionIconKind(kind)} />}</span>;
}

export function EmployeeAttentionPanel({ view, onBack, renderHandle, paletteClass, activeShift = false, onClosing, onExpenses, onScheduleSaved }: {
  onScheduleSaved?: () => void;
  onExpenses?: (snapshot: EmployeeExpenseSnapshot) => void;
  view: string;
  activeShift?: boolean;
  onClosing: (scope?: 'encashment' | 'closing') => void;
  onBack: () => void;
  renderHandle: (onDismiss: () => void) => ReactNode;
  paletteClass: string;
}) {
  const preview = useEmployeePreview();
  const audit=useInteractionAudit();
  const reminderPreviewEnabled = useActionReminderEnabled();
  const requestRead = preview?.request ?? fetch;
  const cashIssue = useCashIssue();
  const searchParams = useSearchParams();
  const [scope, setScope] = useState<Item['kind'] | null>(null);
  const [expenseUnavailable, setExpenseUnavailable] = useState(false);
  const [expenseUnavailableRefs, setExpenseUnavailableRefs] = useState<string[]>([]);
  const expenseListener = useRef(onExpenses); expenseListener.current = onExpenses;
  const [liveItems, setLiveItems] = useState<Item[]>([]);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const requestSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setRefreshing(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    try {
      const response = await requestRead('/api/employee/workday-attention', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error();
      const payload = await response.json();
      if (!Array.isArray(payload.items)) throw new Error();
      if (sequence === requestSequence.current) { setLiveItems(previous => [...payload.items, ...previous.filter(item => item.kind === 'cash' && (payload.expenseRoutingState === 'unavailable' || payload.expenseUnavailableRefs?.includes(item.expenseRef)) && !payload.items.some((next: Item) => next.id === item.id))]);
        setExpenseUnavailable(payload.expenseRoutingState === 'unavailable');
        setExpenseUnavailableRefs(payload.expenseUnavailableRefs ?? []);
        if (payload.expenses) expenseListener.current?.(payload.expenses);
        setLoadState('ready'); }
    } catch { if (sequence === requestSequence.current) setLoadState('error'); }
    finally { window.clearTimeout(timer); if (sequence === requestSequence.current) setRefreshing(false); }
  }, []);
  useEffect(() => startVisibleSync(refresh, 30000), [refresh]);
  useEffect(() => {
    const update = () => { void refresh(); };
    window.addEventListener('mobo:attention-refresh', update);
    return () => window.removeEventListener('mobo:attention-refresh', update);
  }, [refresh]);
  const request = activeShift ? cashIssue?.snapshot.request : null;
  const cashItem: Item[] = request ? [{ id: `cash-issue:${request.ref}`, kind: 'cash_issue', title: cashIssueCompactCopy(request).title, state: 'action', status: cashIssue?.snapshot.unavailable ? 'Нужно обновить данные' : cashIssueCompactCopy(request).subtitle, date: request.checkedAt, detail: 'Перед выдачей проверьте сумму и получателя.', priority: 0 }] : [];
  const ownItems = liveItems.filter(item => item.kind !== 'cash' || !request || item.expenseRef !== request.ref);
  const allItems = orderEmployeeAttention([...ownItems, ...cashItem]);
  usePublishAttentionReminder(allItems, loadState === 'ready', loadState === 'error');
  const items = allItems.filter(item => !scope || item.kind === scope);
  const entry = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sheet = useRef<HTMLElement>(null);
  const scrollArea = useRef<HTMLDivElement>(null);
  const listScroll = useRef(0);
  const lastSelectedId = useRef<string | null>(null);
  const targetFor=(id: string | null): Pick<InteractionContext,'target'|'ref'> | null => { const [kind,ref]=id?.split(':')??[];return ref&&['issue','review'].includes(kind)?{target:kind as 'issue'|'review',ref}:null; };
  const recordSelected=(stage:InteractionContext['stage'])=>{const target=targetFor(selectedId);if(target)audit({...target,stage});};
  const returnToList = () => {recordSelected('close');setSelectedId(null);};
  const previousFocus = useRef<HTMLElement | null>(null);
  const selected = items.find(item => item.id === selectedId);
  const selectedExpenseUnavailable = expenseUnavailable || expenseUnavailableRefs.includes(selected?.expenseRef ?? selectedId?.split(':')[3] ?? '');
  const reading = useRef(new Set<number>());
  const markRead = (item: Item) => {
    if (preview) return;
    for (const id of item.notificationIds ?? []) {
      if (reading.current.has(id)) continue;
      reading.current.add(id);
      void fetch('/api/employee/workday-notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then(response => {
        if (!response.ok) throw new Error();
        setLiveItems(items => items.map(item => ({ ...item, notificationIds: item.notificationIds?.filter(value => value !== id) })));
      }).catch(() => reading.current.delete(id));
    }
  };
  useEffect(() => {
    if (!open || !selected) return;
    markRead(selected);
  }, [open, selected, preview]);
  const close = () => { if (busy) return; recordSelected('close'); setOpen(false); setSelectedId(null); setScope(null); };
  const openCalendar = (item: Item) => {
    markRead(item);
    close();
    window.dispatchEvent(new CustomEvent('mobo:schedule-open', {detail:{date:item.scheduleDate,weekStart:item.scheduleWeekStart}}));
  };
  const openSheet = (kind: Item['kind'] | null = null, id: string | null = null) => {
    void refresh();
    const rows = allItems.filter(item => !kind || item.kind === kind);
    const direct = id ? rows.find(item=>item.id===id) : rows.length === 1 ? rows[0] : null;
    if (direct?.scheduleAction === 'week') { openCalendar(direct); return; }
    previousFocus.current = document.activeElement as HTMLElement;
    setScope(kind);
    setSelectedId(id ?? (rows.length === 1 ? rows[0].id : null)); setOpen(true);
  };
  useEffect(() => {
    const listener = (event: Event) => { const detail = (event as CustomEvent).detail; openSheet(detail?.kind ?? null, detail?.id ?? null); };
    window.addEventListener('mobo:attention-open', listener);
    return () => window.removeEventListener('mobo:attention-open', listener);
  });
  const openedQuery = useRef(false);
  useEffect(() => { if (!openedQuery.current && ['cash', 'receipt', 'closing', 'encashment', 'schedule'].includes(searchParams.get('attention') ?? '')) { openedQuery.current = true; openSheet(searchParams.get('attention') as Item['kind'], searchParams.get('item')); } }, [searchParams]);
  useEffect(() => { if (view === 'attention') { previousFocus.current = document.activeElement as HTMLElement; setOpen(true); setSelectedId(items.length === 1 ? items[0].id : null); onBack(); } }, [view, onBack, items]);
  const openItem = (id: string) => { const item=allItems.find(i=>i.id===id); if(item?.scheduleAction==='week'){openCalendar(item);return;} setActionError(''); listScroll.current = scrollArea.current?.scrollTop ?? 0; lastSelectedId.current = id; setSelectedId(id); };
  const act = async (action: string) => {
    if (preview) { preview.blocked(); return; }
    if (!selected?.endpoint || busy) return;
    recordSelected(['help','not_found','not_mine','undo_not_mine'].includes(action)?action as InteractionContext['stage']:'submit');
    setBusy(true); setActionError('');
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await requestRead(selected.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selected.kind === 'schedule' ? { date: selected.scheduleDate, noticeId: selected.scheduleNoticeId, expectedStatus: selected.scheduleExpectedStatus, ...(action === 'schedule_working' ? { status: 'working' } : action === 'schedule_off' ? { status: 'off' } : { action: 'decline_replacement' }) } : { action }), signal: controller.signal });
      if (!response.ok) {
        if (selected.kind === 'schedule' && response.status === 409) {
          await refresh(); onScheduleSaved?.();
          setActionError('График изменился. Откройте вопрос ещё раз.'); return;
        }
        throw new Error();
      }
      recordSelected('accepted');
      await refresh();
      if (selected.kind === 'schedule') { onScheduleSaved?.(); close(); }
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
      if (event.key === 'Escape' && !busy) { event.preventDefault(); close(); }
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
    {view !== 'schedule' && allItems.length > 0 && <section className="employee-attention-groups" aria-label="Текущие действия">{[...new Set(allItems.map(item => item.kind))].map(kind => {
      const rows = allItems.filter(item => item.kind === kind), actionable = rows.some(item => item.state === 'action');
      const title = kind === 'receipt' ? 'Проверьте чеки' : kind === 'cash' ? rows.length === 1 ? rows[0].title : rows.some(row => row.state === 'action' && row.expenseMode === 'execute') ? 'Оформите расходники в 1С' : rows.some(row => row.state === 'action') ? 'Уточните выдачу по заявке' : 'Заявки к оплате' : kind === 'schedule' && rows.length > 1 ? 'Вопросы по графику' : rows[0].title;
      const count = kind === 'cash' ? new Set(rows.map(row => row.expenseRef || row.id)).size : rows.length;
      return <button key={kind} ref={entry} type="button" onClick={() => kind === 'cash_issue' && request ? cashIssue?.open(request.ref) : openSheet(kind)} aria-haspopup="dialog" className={`employee-attention-row ${rows.some(item => item.notificationIds?.length) ? 'employee-new-notice' : ''}`}>
        <EmployeeNoticeIcon kind={employeeAttentionIconKind(kind)} animated={reminderPreviewEnabled && actionable} />
        <span className="min-w-0 flex-1"><strong>{title}</strong><small className="employee-attention-caption">{kind === 'cash' ? rows.length === 1 ? `По заявке ${rows[0].facts?.find(([label]) => label === 'Заявка')?.[1] || ''} в 1С` : 'Заявки готовы в 1С' : rows.length===1 && rows[0].scheduleAction==='week' ? `${['Сегодня не отмечено','Завтра не отмечено','Сегодня не заполнен','Завтра не заполнен','Сегодня и завтра не заполнены'].includes(rows[0].status) ? rows[0].status + ' · ' : ''}Открыть график` : !actionable ? rows[0].status : ''}{kind !== 'cash' && !(rows.length===1 && rows[0].scheduleAction==='week') && rows.some(item => item.notificationIds?.length) && <span className="employee-attention-new">Новое</span>}</small></span>
        {count > 1 && <span className="shrink-0 text-xs font-bold tabular-nums text-stone-500" aria-label={kind === 'cash' ? `Заявок к оплате: ${count}` : undefined}>{count}</span>}<ChevronRight size={18} aria-hidden="true"/>
      </button>;
    })}</section>}
    {open && createPortal(<div className={`portal-neutral-design employee-material-ui employee-workday-sheet-overlay fixed inset-0 z-[130] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] md:items-center md:p-6 ${paletteClass}`} onClick={event => { if (event.target === event.currentTarget) close(); }}>
      <section ref={sheet} role="dialog" aria-modal="true" aria-labelledby="attention-preview-dialog-title" className="employee-material-sheet employee-attention-sheet flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]">
        {renderHandle(close)}
        <header className="employee-attention-sheet-header">
          <div className="employee-attention-sheet-toolbar">
            {selected && items.length > 1 && <button type="button" className="attention-preview-back" onClick={returnToList}><ArrowLeft size={16} aria-hidden="true"/>Назад</button>}
            <button type="button" onClick={close} disabled={busy} className="employee-material-sheet-close flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600" aria-label="Закрыть замечания"><X size={20}/></button>
          </div>
          <h2 id="attention-preview-dialog-title" className="text-[22px] font-black leading-tight text-slate-950">{selected?.title ?? (scope === 'receipt' ? 'Проверить чеки' : scope === 'cash' ? 'Заявки утверждены' : scope === 'schedule' ? 'Вопросы по графику' : 'Замечания')}</h2>
          {(!selected || !['schedule', 'cash'].includes(selected.kind) && !selected.id.startsWith('review:')) && <p className="mt-1 text-xs text-slate-500">{selected ? new Intl.DateTimeFormat('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long'}).format(new Date(selected.date)) : scope === 'cash' ? `Частей к оплате: ${items.length}` : employeeAttentionSummary(action.length, waiting.length, refreshing || loadState === 'loading', loadState === 'error')}</p>}
        </header>
        <div ref={scrollArea} className="min-h-0 overflow-y-auto overscroll-contain">{selectedId && !selected ? <div className="p-5"><p role="status" className="text-sm">{loadState === 'loading' ? 'Проверяем актуальность…' : loadState === 'error' || scope === 'cash' && selectedExpenseUnavailable ? 'Не удалось проверить актуальность. Повторите позже.' : 'Замечание больше не требует действий.'}</p><Button type="button" className="employee-material-secondary-action mt-3 w-full" onClick={returnToList}>К списку</Button></div> : selected ? <>
        <div className="employee-attention-sheet-detail">
          {targetFor(selected.id)&&<InteractionShown context={{...targetFor(selected.id)!,stage:"open"}}/>}
          <>
            {selected.shared && <p className="my-3 text-xs font-semibold text-amber-800">Общая задача смены</p>}
            <p className={`my-3 text-sm text-slate-700 ${selected.kind === 'cash' ? 'font-semibold' : ''}`}>{selected.kind === 'cash' && selectedExpenseUnavailable ? 'Данные не обновились. Проверьте заявки в 1С.' : selected.detail}</p>
            {Boolean(selected.facts?.length) && <dl className={`cash-discrepancy-sheet-facts ${selected.kind === 'cash' ? 'employee-attention-request-facts' : ''}`}>{selected.facts?.filter(([label, value]) => label !== 'Сумма' || !selected.title.endsWith(value)).map(([label,value], index) => <div key={`${label}-${index}`} className="contents"><dt>{label}</dt><dd>{selected.kind==='cash'&&selected.expenseRef&&index===0&&<InteractionShown context={{target:"cash",ref:selected.expenseRef!,stage:selectedExpenseUnavailable?"warning":"shown",...(selectedExpenseUnavailable?{message:"data_unavailable" as const}:{})}}/>}{value}</dd></div>)}</dl>}

            {selected.kind === 'cash' && <p className="my-3 text-xs leading-relaxed text-slate-500">{selectedExpenseUnavailable ? 'В приложении ничего подтверждать не нужно.' : 'После проведения расходника эта часть заявки исчезнет.'}</p>}
            {selected.reply && <div className="my-3 rounded-xl bg-stone-100 p-3"><p className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-semibold text-slate-500"><span>{selected.replyAuthor?.name || "Ответ по проверке"}</span>{selected.replyAuthor && <time dateTime={selected.replyAuthor.at}>{new Intl.DateTimeFormat("ru-RU",{timeZone:"Europe/Moscow",hour:"2-digit",minute:"2-digit"}).format(new Date(selected.replyAuthor.at))}</time>}</p><p className="mt-1 text-sm text-slate-800">{selected.reply}</p></div>}
            {selected.state === 'waiting' && <p role="status" className="my-3 text-sm font-semibold text-slate-700">{selected.status}</p>}
            {actionError && <p role="alert" className="my-3 text-sm text-red-800">{targetFor(selected.id)&&<InteractionShown context={{...targetFor(selected.id)!,stage:"error",message:"send_failed"}}/>}{actionError}</p>}
            {selected.kind === 'cash_issue' && request && <Button type="button" className="employee-material-primary-action h-12 w-full" onClick={() => { close(); cashIssue?.open(request.ref); }}>Проверить выдачу</Button>}
            {selected.kind === 'closing' && selected.state === 'action' && <Button type="button" className="employee-material-primary-action h-12 w-full" onClick={() => { close(); onClosing(selected.closingScope); }}>Продолжить сдачу смены</Button>}
            {Boolean(selected.actions?.length) && <div className="grid gap-2">{selected.actions?.map(a => <Button key={a.action} type="button" disabled={busy || Boolean(preview)} title={preview ? "Только просмотр" : undefined} className={`${a.action === "schedule_working" ? "employee-material-primary-action" : "employee-material-secondary-action"} min-h-12 w-full`} onClick={() => void act(a.action)}>{busy ? 'Отправляем…' : a.label}</Button>)}</div>}
            {selected.state === 'waiting' && !['closing', 'encashment'].includes(selected.kind) && !selected.actions?.length && <Button type="button" className="employee-material-secondary-action h-12 w-full" onClick={() => items.length > 1 ? returnToList() : close()}>Понятно</Button>}
          </>


        </div>
        </> : <div className="attention-preview-page px-5 pb-5 pt-2">
        {(refreshing || loadState === 'loading') && items.length === 0 && <p role="status" className="text-sm text-slate-500">Загружаем замечания…</p>}
        {!refreshing && loadState === 'error' && items.length === 0 && <div role="status"><p>Не удалось загрузить список.</p><button type="button" onClick={() => void refresh()} className="min-h-11 font-semibold">Повторить</button></div>}
        {!refreshing && loadState === 'ready' && items.length===0&&<div className="attention-preview-history"><CheckCircle2 size={20} aria-hidden="true"/><strong>Открытых замечаний нет</strong></div>}
        {[{ title: 'Нужно сделать', rows: action }, { title: scope === 'cash' ? 'После начала смены' : 'Ожидает проверки', rows: waiting }].map(group => group.rows.length > 0 && <section className="attention-preview-group" key={group.title}>{action.length > 0 && waiting.length > 0 && <h3>{group.title}<span>{group.rows.length}</span></h3>}<div className="attention-preview-list">{group.rows.map(item => <button type="button" key={item.id} data-attention-item={item.id} onClick={() => openItem(item.id)}><Marker kind={item.kind} waiting={item.state === 'waiting'}/><span className="attention-preview-item-copy"><strong>{item.listTitle ?? item.title}</strong><small>{item.shared ? 'Общая задача смены · ' : ''}{item.listSubtitle ?? item.status}</small></span><ChevronRight size={18} aria-hidden="true"/></button>)}</div></section>)}
        {action.length === 0 && items.length > 0 && <p className="attention-preview-all-done"><CheckCircle2 size={18} aria-hidden="true"/>От вас сейчас ничего не требуется</p>}
        </div>}</div>
      </section>
    </div>, document.body)}
  </>;
}
