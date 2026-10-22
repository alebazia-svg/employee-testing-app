'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { getInitialPayrollBonuses } from '@/lib/payroll-compensation';
import { payrollDraftDifferences, payrollDraftFingerprint, validatePayrollDraft, type PayrollDraft, type PayrollDraftRead } from '@/lib/payroll-draft';

type State = { period: string; phase: 'loading' | 'ready' | 'choice' | 'error'; record?: PayrollDraftRead; local?: PayrollDraft; message?: string };
function readBrowser(period: string) {
  const year = period.slice(0, 4), month = String(Number(period.slice(5)) - 1);
  const keys = [`payroll-manual-${year}-${month}`, `payroll-fixed-${year}-${month}`, `payroll-purchase-${year}-${month}`, `payroll-bonuses-v1-${period}`];
  const raw = keys.map(key => localStorage.getItem(key));
  const empty: PayrollDraft = { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: getInitialPayrollBonuses(period) };
  let payload: PayrollDraft;
  try { payload = validatePayrollDraft({
    manual: raw[0] ? JSON.parse(raw[0]) : {}, fixed: raw[1] ? JSON.parse(raw[1]) : {},
    purchase: raw[2] ? JSON.parse(raw[2]) : { advance: '', deduction: '', comment: '' },
    bonuses: raw[3] ? JSON.parse(raw[3]) : getInitialPayrollBonuses(period),
  }); } catch (error) {
    localStorage.setItem(`payroll-draft-raw-recovery-${period}`, JSON.stringify(Object.fromEntries(keys.map((key, index) => [key, raw[index]]))));
    throw error;
  }
  return { hasLocal: raw.some(value => value !== null) && payrollDraftFingerprint(payload) !== payrollDraftFingerprint(empty), payload };
}
async function readResponse(response: Response, period: string): Promise<PayrollDraftRead> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Сохранение не подтверждено.');
  if (body.periodKey !== period || !Number.isSafeInteger(body.revision) || body.revision < 0 || typeof body.locked !== 'boolean') throw new Error('Не удалось прочитать сохранённые правки.');
  return { periodKey: period, revision: body.revision, savedAt: body.savedAt, payload: body.payload === null ? null : validatePayrollDraft(body.payload), locked: body.locked };
}
export function usePayrollDraftSync(enabled: boolean, period: string, payload: PayrollDraft, apply: (payload: PayrollDraft) => void) {
  const [state, setState] = useState<State>({ period: '', phase: 'loading' });
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const current = useRef({ payload, apply, period }); current.current = { payload, apply, period };
  const pending = useRef<{ period: string; revision: number; payload: PayrollDraft; requestId: string } | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    // Capture before the legacy local-storage effects can initialize/reset defaults.
    let browser: ReturnType<typeof readBrowser> | null = null;
    try { browser = readBrowser(period); } catch { /* Recovery UI below preserves server data. */ }
    setState({ period, phase: 'loading' });
    void (async () => {
      try {
        const record = await readResponse(await fetch(`/api/admin/payroll/draft?period=${period}`, { cache: 'no-store', signal: controller.signal }), period);
        if (cancelled) return;
        if (record.locked) { setState({ period, phase: 'ready', record }); return; }
        if (!browser) { setState({ period, phase: 'choice', record, message: 'Правки из браузера не удалось прочитать. Можно открыть сохранённые данные.' }); return; }
        if (browser.hasLocal && (!record.payload || payrollDraftFingerprint(browser.payload) !== payrollDraftFingerprint(record.payload))) {
          setState({ period, phase: 'choice', record, local: browser.payload, message: record.payload
            ? 'Правки в этом браузере отличаются от сохранённых. Выберите, с какими продолжить.'
            : 'В этом браузере есть прежние правки. Их можно перенести в общее сохранение.' });
          return;
        }
        current.current.apply(record.payload ?? browser.payload);
        setState({ period, phase: 'ready', record });
      } catch {
        if (!cancelled) setState({ period, phase: 'error', message: 'Не удалось загрузить сохранённые правки. Ваши данные из браузера сохранены; повторите загрузку.' });
      } finally { clearTimeout(timeout); }
    })();
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [enabled, period, refresh]);
  const ready = !enabled || state.period === period && state.phase === 'ready';
  const locked = state.record?.locked ?? false;
  const baseline = state.record?.payload ?? { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: [] };
  const dirty = enabled && ready && !locked && payrollDraftFingerprint(payload) !== payrollDraftFingerprint(baseline);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const choose = useCallback((local: boolean) => {
    if (state.period !== period || !state.record) return;
    try {
      if (state.local) localStorage.setItem(`payroll-draft-recovery-${period}`, JSON.stringify(state.local));
      const selected = local ? state.local : state.record.payload ?? { manual: {}, fixed: {}, purchase: { advance: '', deduction: '', comment: '' }, bonuses: getInitialPayrollBonuses(period) };
      if (!selected) return;
      current.current.apply(selected);
      pending.current = null;
      setState({ period, phase: 'ready', record: state.record });
    } catch { setState(previous => ({ ...previous, message: 'Не удалось сохранить запасную копию правок браузера. Выбор не применён.' })); }
  }, [period, state]);
  const save = useCallback(async () => {
    if (!dirty || saving || !state.record) return;
    let snapshot: PayrollDraft;
    try { snapshot = validatePayrollDraft(current.current.payload); }
    catch (error) { setState(previous => ({ ...previous, message: (error as Error).message })); return; }
    const revision = state.record.revision;
    if (!pending.current || pending.current.period !== period || pending.current.revision !== revision || payrollDraftFingerprint(pending.current.payload) !== payrollDraftFingerprint(snapshot)) {
      pending.current = { period, revision, payload: snapshot, requestId: crypto.randomUUID() };
    }
    setSaving(true);
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/admin/payroll/draft', { method: 'PUT', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending.current), signal: controller.signal });
      if (!mounted.current || current.current.period !== period) return;
      if (response.status === 409) {
        pending.current = null;
        setState(previous => ({ ...previous, phase: 'error', message: 'В другом окне изменились правки или месяц уже утверждён. Ваш ввод не перезаписан. Загрузите данные для сравнения.' }));
        return;
      }
      const record = await readResponse(response, period);
      if (!mounted.current || current.current.period !== period) return;
      pending.current = null;
      if (payrollDraftFingerprint(record.payload) !== payrollDraftFingerprint(snapshot)) {
        setState({ period, phase: 'choice', record, local: current.current.payload, message: 'На сервере уже есть более новые правки. Выберите, с какими продолжить.' });
      } else setState({ period, phase: 'ready', record });
    } catch {
      if (mounted.current && current.current.period === period) setState(previous => ({ ...previous, message: 'Сохранение не подтверждено. Ваш ввод оставлен на экране — повторите сохранение.' }));
    } finally { clearTimeout(timeout); if (mounted.current) setSaving(false); }
  }, [dirty, period, saving, state.record]);
  function restore(draft: PayrollDraft) {
    if (!ready || saving || locked) return;
    try {
      localStorage.setItem(`payroll-draft-recovery-${period}`, JSON.stringify(current.current.payload));
      current.current.apply(validatePayrollDraft(draft));
      pending.current = null;
      setState(previous => ({ ...previous, message: undefined }));
    } catch { setState(previous => ({ ...previous, message: 'Не удалось подготовить прежние правки. Текущий ввод сохранён на экране.' })); }
  }
  return { enabled, ready, saving, dirty, locked, state, choose, save, restore, reload: () => setRefresh(value => value + 1) };
}
export function PayrollDraftStatus({ sync, compact = false }: { sync: ReturnType<typeof usePayrollDraftSync>; compact?: boolean }) {
  const [history, setHistory] = useState<Array<{ revision: number; savedAt: string; author: string; payload: PayrollDraft }>>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyLoading, setHistoryLoading] = useState(false);
  useEffect(() => { setHistory([]); setHistoryOpen(false); setHistoryError(''); }, [sync.state.period, sync.state.record?.revision]);
  useEffect(() => {
    if (!historyOpen) return;
    let cancelled = false;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 15000);
    setHistoryLoading(true); setHistoryError('');
    void fetch(`/api/admin/payroll/draft?period=${sync.state.period}&history=1`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok || body.periodKey !== sync.state.period || !Array.isArray(body.records)) throw new Error();
      const records = body.records.map((row: { revision: number; savedAt: string; author: string; payload: unknown }) => ({ ...row, payload: validatePayrollDraft(row.payload) }));
      if (!cancelled) setHistory(records);
    }).catch(() => { if (!cancelled) setHistoryError('Не удалось загрузить историю. Закройте её и откройте снова.'); }).finally(() => { clearTimeout(timeout); if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; controller.abort(); clearTimeout(timeout); };
  }, [historyOpen, sync.state.period]);
  if (!sync.enabled) return null;
  const { state } = sync;
  const label = state.phase === 'loading' ? 'Загружаю сохранённые правки…'
    : sync.saving ? 'Сохраняю правки…'
      : state.message ?? (sync.locked ? 'Месяц утверждён или закрыт. Финальный расчёт защищён.'
        : sync.dirty ? 'Есть несохранённые правки' : state.record?.revision ? 'Правки сохранены' : 'Ручных правок нет');
  return <section aria-label='Сохранение правок зарплаты' className={compact ? 'min-w-0 self-end text-sm' : 'mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm'}>
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <p role={state.phase === 'error' ? 'alert' : 'status'}>{label}</p>
      <div className='flex flex-wrap gap-2'>
        {state.phase === 'ready' && !sync.locked && <button type='button' className='min-h-11 rounded-lg bg-primary px-3 py-2 font-semibold text-white disabled:opacity-50' disabled={!sync.dirty || sync.saving} onClick={() => void sync.save()}>Сохранить правки</button>}
        {state.phase === 'error' && <button type='button' className='min-h-11 rounded-lg border px-3 py-2 font-semibold' onClick={sync.reload}>Загрузить данные</button>}
        {state.phase === 'choice' && <>
          <button type='button' className='min-h-11 rounded-lg border px-3 py-2 font-semibold' onClick={() => sync.choose(false)}>{state.record?.payload ? 'Открыть сохранённые' : 'Начать без прежних правок'}</button>
          {state.local && <button type='button' className='min-h-11 rounded-lg border px-3 py-2 font-semibold' onClick={() => sync.choose(true)}>Продолжить с правками браузера</button>}
        </>}
        {state.record && state.record.revision > 0 && <button type='button' disabled={!sync.ready || sync.saving} className='min-h-11 rounded-lg border px-3 py-2 font-semibold disabled:opacity-50' onClick={() => setHistoryOpen(value => !value)}>{historyOpen ? 'Скрыть историю' : 'История правок'}</button>}
      </div>
    </div>
    {state.phase === 'choice' && <p className='mt-1 text-xs text-slate-600'>Исходный черновик браузера будет сохранён отдельно. Перед общим сохранением проверьте дни, суммы и премии.</p>}
    {state.phase === 'choice' && state.local && <details className='mt-2 rounded-lg bg-slate-50 p-2' open>
      <summary className='cursor-pointer font-semibold'>Сравнить правки</summary>
      <div className='mt-2 grid gap-2'>{payrollDraftDifferences(state.local, state.record?.payload ?? null).map((row, index) => <div key={index} className='rounded-lg border border-slate-200 bg-white p-2'>
        <p className='font-semibold'>{row.employee} · {row.field}</p>
        <div className='mt-1 grid grid-cols-2 gap-2 break-words'><p><span className='block text-xs text-slate-500'>В этом браузере</span>{row.local}</p><p><span className='block text-xs text-slate-500'>Сохранено</span>{row.saved}</p></div>
      </div>)}</div>
    </details>}
    {historyOpen && <div className='mt-2 grid gap-2 border-t border-slate-200 pt-2'>
      <p className='text-xs text-slate-500'>Последние 20 сохранений. Прежние версии сохраняются при восстановлении.</p>
      {historyLoading && <p role='status'>Загружаю историю…</p>}
      {historyError && <p role='alert'>{historyError}</p>}
      {history.map(row => <details key={row.revision} className='rounded-lg border border-slate-200 p-2'>
        <summary className='cursor-pointer font-semibold'>{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', dateStyle: 'short', timeStyle: 'short' }).format(new Date(row.savedAt))} · {row.author}</summary>
        <p className='mt-1 text-xs text-slate-500'>Сохранение №{row.revision}</p>
        <ul className='mt-2 grid gap-1'>{payrollDraftDifferences(row.payload, state.record?.payload ?? null).map((change, index) => <li key={index}>{change.employee} · {change.field}: {change.local} <span className='text-slate-500'>(сейчас: {change.saved})</span></li>)}</ul>
        {!sync.locked && row.revision !== state.record?.revision && <button type='button' disabled={!sync.ready || sync.saving} className='mt-2 min-h-11 rounded-lg border px-3 py-2 font-semibold' onClick={() => { sync.restore(row.payload); setHistoryOpen(false); }}>Использовать эти правки</button>}
      </details>)}
    </div>}
  </section>;
}

export function PayrollDraftGuard({ sync, children }: { sync: ReturnType<typeof usePayrollDraftSync>; children: ReactNode }) {
  if (!sync.enabled) return <>{children}</>;
  return <fieldset disabled={!sync.ready || sync.saving} className='m-0 min-w-0 border-0 p-0'>{children}</fieldset>;
}
