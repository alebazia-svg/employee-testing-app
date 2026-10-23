'use client';
import { useEmployeePreview } from '@/components/EmployeePreviewProvider';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './CashIssueClient.module.css';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, RefreshCw, X } from 'lucide-react';
import { startVisibleSync } from '@/lib/visible-sync';
import { DELIVERY_MAX_AGE_MS } from '@/lib/procurement-delivery-policy';
import { cashIssueCompactCopy, type cashIssuePermission } from '@/lib/procurement-cash-issue-policy';
import { DELIVERY_PHONE_RESERVE_REF } from '@/lib/procurement-delivery-reserve';

type RequestData = NonNullable<ReturnType<typeof cashIssuePermission>>;
type Snapshot = { request: RequestData | null; unavailable: boolean; waitingForShift?: boolean };
const CashIssueContext = createContext<{ snapshot: Snapshot; open: (ref: string) => void; refresh: (fresh?: boolean) => Promise<void> } | null>(null);
const money = (amount: number) => `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;

export function useCashIssue() { return useContext(CashIssueContext); }

export function CashIssueSummary({ activeShift }: { activeShift: boolean }) {
  const context = useCashIssue();
  const refresh = context?.refresh;
  useEffect(() => { if (refresh) void refresh(true); }, [activeShift, refresh]);
  const request = context?.snapshot.request;
  if (!activeShift || !context || !request) return null;
  const unknown = context.snapshot.unavailable || Date.now() - Date.parse(request.checkedAt) > DELIVERY_MAX_AGE_MS;
  const copy = cashIssueCompactCopy(request);
  return <button type='button' onClick={() => context.open(request.ref)} className={styles.notice} aria-label={unknown ? 'Проверить выдачу денег' : `${copy.title}. ${copy.subtitle}`}>
    <span className='min-w-0 flex-1'><span className='block text-[15px] font-extrabold leading-5 text-slate-950'>{unknown ? 'Проверить выдачу денег' : copy.title}</span><span className='mt-0.5 block text-xs font-medium leading-4 text-slate-500'>{unknown ? 'Нужно обновить данные' : copy.subtitle}</span></span>
    <ChevronRight className='h-[18px] w-[18px] shrink-0 text-[#94633e]' aria-hidden='true' />
  </button>;
}

export function CashIssueProvider({ children }: { children: ReactNode }) {
  const preview = useEmployeePreview();
  const requestRead = preview?.request ?? fetch;
  const [snapshot, setSnapshot] = useState<Snapshot>({ request: null, unavailable: false });
  const [openedRef, setOpenedRef] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const modal = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const linkedRef = params.get('cashIssue');
  const lastLink = useRef<string | null>(null);

  const refresh = useCallback(async (fresh = false) => {
    const id = ++sequence.current;
    if (fresh) setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await requestRead(`/api/employee/cash-issue${fresh ? '?fresh=1' : ''}`, { cache: 'no-store', signal: controller.signal });
      if (response.status === 401 || response.status === 403) {
        if (id === sequence.current) setSnapshot({ request: null, unavailable: true });
        return;
      }
      if (!response.ok) throw new Error('Unavailable');
      const next: Snapshot = await response.json();
      if (id === sequence.current) setSnapshot(previous => next.unavailable ? { request: previous.request, unavailable: true } : next);
    } catch {
      if (id === sequence.current) setSnapshot(previous => ({ ...previous, unavailable: true }));
    } finally { window.clearTimeout(timeout); if (id === sequence.current) setBusy(false); }
  }, []);
  useEffect(() => startVisibleSync(() => refresh(), 30_000), [refresh]);
  const open = useCallback((ref: string) => { setOpenedRef(ref); void refresh(true); }, [refresh]);
  const close = useCallback(() => {
    setOpenedRef(null);
    if (linkedRef) {
      const next = new URLSearchParams(params.toString());
      next.delete('cashIssue');
      router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    }
  }, [linkedRef, params, pathname, router]);
  useEffect(() => {
    if (linkedRef && linkedRef !== lastLink.current) open(linkedRef);
    lastLink.current = linkedRef;
  }, [linkedRef, open]);
  useEffect(() => {
    if (!openedRef) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key !== 'Tab') return;
      const elements = modal.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]');
      if (!elements?.length) return;
      const first = elements[0], last = elements[elements.length - 1];
      if (!modal.current?.contains(document.activeElement)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', onKey); previous?.focus(); };
  }, [openedRef, close]);
  const request = snapshot.request?.ref === openedRef ? snapshot.request : null;
  const unknown = snapshot.unavailable || Boolean(request && Date.now() - Date.parse(request.checkedAt) > DELIVERY_MAX_AGE_MS);
  const ready = request && !unknown && !busy;

  return <CashIssueContext.Provider value={{ snapshot, open, refresh }}>{children}
    {openedRef && createPortal(<div className='portal-neutral-design portal-palette-mobo portal-typography-refined employee-material-ui'>
      <div className='employee-workday-sheet-overlay fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/45 backdrop-blur-[2px] md:items-center md:p-6' onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <div ref={modal} role='dialog' aria-modal='true' aria-labelledby='cash-issue-title' className='employee-material-sheet employee-cash-issue-sheet flex max-h-[90dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-white shadow-2xl md:rounded-[28px]'>
          <div className='px-5 pb-3 pt-3'><div className='mx-auto mb-3 h-1 w-9 rounded-full bg-slate-300' aria-hidden='true' /><div className='flex items-center justify-between gap-3'><h2 id='cash-issue-title' className='text-xl font-black text-slate-950'>Выдача денег</h2><button ref={closeButton} type='button' onClick={close} aria-label='Закрыть выдачу денег' className='employee-material-sheet-close flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600'><X className='h-5 w-5' /></button></div></div>
          <div className='overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]'>
            {ready ? <>
              <p className='text-xs font-semibold text-slate-500'>{request.issued > 0 ? 'Осталось выдать' : 'К выдаче'}</p><p className='mt-1 text-[32px] font-black leading-tight tracking-tight text-slate-950'>{money(request.amount)}</p>
              <p className='mt-2 text-base font-bold text-slate-950'>{request.recipient}</p>
              <p className='mt-1 text-sm text-slate-500'>{request.cashbox} · № {request.number}</p>
              {request.issued > 0 && <p className='mt-3 text-sm text-slate-600'>Уже выдано {money(request.issued)} из {money(request.total)}.</p>}
              {request.cashboxRef === DELIVERY_PHONE_RESERVE_REF && <p className='mt-3 text-sm leading-5 text-slate-600'>Поручение общее для менеджеров розницы на смене. Выдачу выполняет один сотрудник: перед выдачей убедитесь, что коллега ещё не выдал деньги, и проверьте заявку в 1С.</p>}
              <p className='mt-4 border-t border-slate-200 pt-3 text-sm leading-5 text-slate-600'>После выдачи денег создайте расходник в 1С на основании этой заявки.</p>
            </> : <p className='py-4 text-sm leading-6 text-slate-600' role='status'>{busy ? 'Проверяем сумму и кассу…' : unknown ? 'Не удалось проверить данные. Перед выдачей обновите статус или проверьте заявку в 1С.' : snapshot.waitingForShift ? 'Для выдачи денег начните текущий рабочий день. Заявка сохранена.' : 'Выдача из вашей кассы больше не требуется.'}</p>}
            <button type='button' onClick={() => void refresh(true)} disabled={busy} className='mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#94633e] disabled:opacity-50'><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />{busy ? 'Проверяем…' : 'Обновить статус'}</button>
          </div>
        </div>
      </div>
    </div>, document.body)}
  </CashIssueContext.Provider>;
}
