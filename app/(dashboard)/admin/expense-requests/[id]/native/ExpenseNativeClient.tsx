'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, RefreshCw, Pencil, Search, X } from 'lucide-react';
import { expenseBreakdownDisplay } from '@/lib/expense-request-breakdown';
import { isExpenseRef, parseExpenseCommand, readNativeExpenseCard, supportsExpenseAction, type ExpenseChange, type ExpenseCommand, type ExpenseField, type NativeExpenseCard, type NativeExpenseState, type NativeExpenseValue } from '@/lib/expense-request-command';

const button = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:min-h-9 sm:py-1.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50';
const primary = `${button} border-transparent !bg-slate-900 !text-white`;
const panel = 'rounded-xl border border-slate-200 bg-white p-4';
const label = (key: string) => ({ Партнер: 'Партнёр', Заказ: 'Основание / заказ', СтатьяРасходов: 'Статья расходов/активов', АналитикаРасходов: 'Аналитика расходов', СтатьяДвиженияДенежныхСредств: 'Статья ДДС', Подразделение: 'Подразделение', Комментарий: 'Комментарий', НазначениеПлатежа: 'Назначение платежа', Сумма: 'Сумма', НаправлениеДеятельности: 'Направление деятельности' } as Record<string, string>)[key] || key;
const changeKey = (scope: string, line: number, field: string) => `${scope}:${line}:${field}`;
function name(value: unknown) { return value && typeof value === 'object' && 'name' in value ? String(value.name || '') : ''; }
function money(value: unknown, currency: unknown) { return typeof value === 'number' && Number.isFinite(value) ? `${value.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ${name(currency)}`.trim() : 'Нет данных'; }
function differences(before: NativeExpenseState, after: NativeExpenseState) {
  const rows: { label: string; before: string; after: string }[] = [];
  for (const [key, value] of Object.entries(after.header)) if (JSON.stringify(value) !== JSON.stringify(before.header[key])) rows.push({ label: label(key), before: before.header[key] ? expenseBreakdownDisplay(before.header[key]) : 'Нет данных', after: expenseBreakdownDisplay(value) });
  for (const line of after.lines) for (const [key, value] of Object.entries(line.fields)) {
    const old = before.lines.find(row => row.line_number === line.line_number)?.fields[key];
    if (JSON.stringify(old) !== JSON.stringify(value)) rows.push({ label: `Строка ${line.line_number} · ${label(key)}`, before: old ? expenseBreakdownDisplay(old) : 'Нет данных', after: expenseBreakdownDisplay(value) });
  }
  if (after.document.status.key !== before.document.status.key) rows.push({ label: 'Статус в 1С', before: before.document.status.name, after: after.document.status.name });
  return rows;
}

function FieldEditor({ field, current, draft, api, disabled, onChange, onClose, line }: {
  field: ExpenseField; current: NativeExpenseValue; draft?: ExpenseChange; api: string; disabled: boolean;
  line: number; onChange: (change: ExpenseChange, display?: string) => void; onClose: () => void;
}) {
  const [type, setType] = useState(draft?.type || (field.types.some(t => t.type === current.type) ? current.type : field.types[0].type));
  const [query, setQuery] = useState('');
  const [choices, setChoices] = useState<NativeExpenseValue[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [truncated, setTruncated] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const choice = field.types.find(item => item.type === type)!;
  useEffect(() => {
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) onClose(); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [onClose]);
  useEffect(() => {
    if (choice.kind !== 'reference') return;
    const controller = new AbortController();
    setSearching(true); setError(''); setChoices([]);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`${api}?${new URLSearchParams({ mode: 'choices', scope: field.scope, field: field.name, type, q: query })}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.items)) throw new Error('Не удалось загрузить список из 1С. Закройте поле и попробуйте ещё раз.');
        if (!controller.signal.aborted) { setChoices(result.items); setTruncated(result.truncated === true); }
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Нет связи с 1С.'); }
      finally { if (!controller.signal.aborted) setSearching(false); }
    }, query ? 250 : 0);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, field.scope, field.name, type, query, choice.kind]);
  return <div ref={root} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }}>
    {choice.kind === 'reference' ? <div className='relative'>
      <div className='flex items-center gap-2'><Search className='h-4 w-4 shrink-0 text-slate-400' /><input autoFocus aria-label={`Поиск: ${field.label}`} className='min-h-11 min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold outline-none' value={query} maxLength={100} disabled={disabled} onChange={event => setQuery(event.target.value)} placeholder='Найти в 1С…' /><button type='button' onClick={onClose} className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500' aria-label='Закрыть выбор'><X className='h-4 w-4' /></button></div>
      <div className='absolute left-0 right-0 top-full z-30 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg' aria-label={`Варианты: ${field.label}`}>
        {searching ? <p role='status' className='p-3 text-sm text-slate-500'>Загружаем…</p> : error ? <p role='alert' className='p-3 text-sm text-amber-800'>{error}</p> : !choices.length ? <p className='p-3 text-sm text-slate-500'>Ничего не найдено</p> : choices.map(value => <button type='button' key={`${value.type}:${value.xml}`} disabled={disabled} className='block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100 focus:bg-slate-100' onClick={() => { onChange({scope:field.scope,line_number:line,field:field.name,type:value.type,xml:value.xml},expenseBreakdownDisplay(value)); onClose(); }}>{expenseBreakdownDisplay(value)}</button>)}
        {truncated && <p className='px-3 py-2 text-xs text-slate-500'>Уточните название — показаны первые 50.</p>}
        {field.types.length > 1 && <label className='block border-t border-slate-200 p-2 text-xs text-slate-500'>Тип значения<select aria-label='Тип значения' className='mt-1 w-full rounded border border-slate-200 bg-white p-2' value={type} disabled={disabled} onChange={event => {setType(event.target.value);setQuery('');}}>{field.types.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}</select></label>}
      </div>
    </div> : type === 'Строка' ? <textarea aria-label={field.label} autoFocus rows={2} className='mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold outline-none focus:border-slate-500' disabled={disabled} maxLength={1000} value={draft?.xml ?? current.xml} onBlur={onClose} onChange={event => onChange({scope:field.scope,line_number:line,field:field.name,type,xml:event.target.value})} /> : <p className='text-sm text-slate-500'>Этот тип изменяется в 1С.</p>}
  </div>;
}

export function ExpenseNativeClient({ caseId, onDirtyChange, onBusyChange }: { caseId: string; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void }) {
  const api = `/api/admin/expense-requests/${encodeURIComponent(caseId)}/native`;
  const [card, setCard] = useState<NativeExpenseCard | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeField, setActiveField] = useState<string | null>(null);
  const draftNames = useRef<Record<string, string>>({});
  const [changes, setChanges] = useState<Record<string, ExpenseChange>>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const [preview, setPreview] = useState<{ command: ExpenseCommand; token: string; before: NativeExpenseState; after: NativeExpenseState } | null>(null);
  const [recovery, setRecovery] = useState<{ command: ExpenseCommand; token: string } | null>(null);
  const pending = useRef<string | null>(null);
  useEffect(() => { onDirtyChange?.(Object.keys(changes).length > 0 || busy || uncertain); }, [changes, busy, uncertain, onDirtyChange]);
  useEffect(() => { onBusyChange?.(busy); }, [busy, onBusyChange]);
  const recoveryKey = `expense-native-pending:${caseId}`;
  const clearRecovery = useCallback(() => { pending.current = null; setRecovery(null); try { sessionStorage.removeItem(recoveryKey); } catch { /* In-memory recovery remains available when storage is disabled. */ } }, [recoveryKey]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(api, { cache: 'no-store' }); const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось обновить заявку.');
      const next = readNativeExpenseCard(payload.card, payload.card?.state?.document?.ref);
      setCard(next); setEnabled(payload.writesEnabled === true);
      if (pending.current && next.history.rows.some(row => row.command_id === pending.current)) {
        setNotice('Действие записано в 1С. Показана актуальная версия заявки.'); setUncertain(false); clearRecovery(); setPreview(null); setChanges({}); setActiveField(null);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Нет связи с 1С.'); }
    finally { setLoading(false); }
  }, [api, clearRecovery]);
  useEffect(() => {
    try { const saved = JSON.parse(sessionStorage.getItem(recoveryKey) || 'null'); if (saved && isExpenseRef(saved.token)) { const command = parseExpenseCommand(saved.command); pending.current = command.command_id; setRecovery({ command, token: saved.token }); setUncertain(true); } } catch { try { sessionStorage.removeItem(recoveryKey); } catch { /* Storage can be disabled. */ } }
    void load();
  }, [load, recoveryKey]);
  useEffect(() => {
    if (!Object.keys(changes).length && !uncertain && !busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const protectLink = (event: MouseEvent) => { if ((event.target as Element)?.closest('a[href]')) { event.preventDefault(); event.stopPropagation(); setError('Сначала сохраните или отмените исправления.'); } };
    window.addEventListener('beforeunload', warn); document.addEventListener('click', protectLink, true);
    return () => { window.removeEventListener('beforeunload', warn); document.removeEventListener('click', protectLink, true); };
  }, [changes, uncertain, busy]);
  function change(value: ExpenseChange, display?: string) {
    if (!card) return;
    const fields = value.scope === 'header' ? card.state.header : card.state.lines.find(line => line.line_number === value.line_number)!.fields;
    const old = fields[value.field]; const key = changeKey(value.scope, value.line_number, value.field);
    draftNames.current[key] = display ?? value.xml;
    if (display !== undefined) setActiveField(null);
    setChanges(current => { const next = { ...current }; if (old.type === value.type && old.xml === value.xml) delete next[key]; else next[key] = value; return next; }); setPreview(null);
  }
  async function send(stage: 'preview' | 'confirm', action: ExpenseCommand['action'], retry = false) {
    if (!card || inFlight.current || (uncertain && !retry)) return;
    const confirmation = retry ? recovery : preview;
    if (stage === 'confirm' && !confirmation) return;
    inFlight.current = true; setBusy(true); setError(''); setNotice('');
    const command = stage === 'confirm' ? confirmation!.command : { command_id: crypto.randomUUID(), version_token: card.state.document.version_token, action, changes: Object.values(changes) };
    try {
      if (stage === 'confirm') { pending.current = command.command_id; const saved = { command, token: confirmation!.token }; setRecovery(saved); try { sessionStorage.setItem(recoveryKey, JSON.stringify(saved)); } catch { /* Keep the same command in memory; never generate a replacement on retry. */ } }
      const response = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage, command, ...(stage === 'confirm' ? { previewToken: confirmation!.token } : {}) }) });
      const result = await response.json();
      if (!response.ok) { setUncertain(result.uncertain === true); if (!result.uncertain) clearRecovery(); throw new Error(result.error || '1С не подтвердила действие.'); }
      if (result.kind === 'preview') { setPreview({ command, token: result.token, before: result.before, after: result.after }); setActiveField(null); }
      else {
        setCard(current => current ? { ...current, state: result.state } : current); setChanges({}); setPreview(null); setActiveField(null); setUncertain(false); clearRecovery();
        setNotice(result.verified ? action === 'mark_payable' ? 'Заявка утверждена к оплате в 1С. Менеджер может оформить расходник.' : 'Изменения сохранены в 1С.' : '1С записала действие, но данные успели измениться. Проверьте актуальную карточку.');
        await load();
      }
    } catch (e) { if (stage === 'confirm' && pending.current) setUncertain(true); setError(e instanceof Error ? e.message : 'Ответ не получен. Проверьте результат.'); }
    finally { inFlight.current = false; setBusy(false); }
  }
  if (!card) return <section className={panel}><h1 className='text-xl font-bold'>Заявка из 1С</h1><p className='mt-3 text-sm text-slate-600'>{loading ? 'Получаем актуальные данные из 1С…' : error}</p>{!loading && <button className={`${button} mt-4`} onClick={() => void load()}>Повторить</button>}</section>;
  const state = card.state, doc = state.document;
  const payable = doc.status.key === 'payable';
  const pendingDecision = ['not_approved', 'approved'].includes(doc.status.key) && !doc.deletion_mark;
  const supportsPayable = supportsExpenseAction(card, 'mark_payable');
  const canAct = enabled && !loading && !busy && !uncertain && pendingDecision && supportsPayable;
  const canSave = canAct && doc.status.key === 'not_approved' && supportsExpenseAction(card, 'save');
  const diff = preview ? differences(preview.before, preview.after) : [];
  const count = Object.keys(changes).length;
  const editable = canAct && !preview;
  function fact(title: string, value: string, wide = false, fieldInfo?: {scope:'header' | 'line';line:number;key:string;cell:NativeExpenseValue}) {
    const id = fieldInfo ? changeKey(fieldInfo.scope, fieldInfo.line, fieldInfo.key) : title;
    const schema = fieldInfo && card!.schema.find(item => item.scope === fieldInfo.scope && item.name === fieldInfo.key);
    const draft = changes[id];
    const display = draft ? draftNames.current[id] || (draft.type === 'Строка' ? draft.xml || '—' : 'Выбрано новое значение') : value;
    const canEdit = !!schema && !preview && enabled && pendingDecision && supportsPayable;
    return <div key={id} className={`relative border-b border-slate-100 px-1 py-2 ${wide ? 'sm:col-span-2' : ''} ${draft ? 'ring-1 ring-blue-200' : ''} ${activeField === id ? 'z-20' : ''}`}>
      <p className='text-xs font-medium text-slate-500'>{title}{draft && <span className='ml-2 normal-case tracking-normal text-blue-700'>изменено</span>}</p>
      {activeField === id && schema && fieldInfo && !preview ? <FieldEditor field={schema} current={fieldInfo.cell} draft={draft} api={api} line={fieldInfo.line} disabled={!editable} onChange={change} onClose={() => setActiveField(null)} /> : canEdit ? <button type='button' aria-label={`Изменить: ${title}`} disabled={!editable} className='mt-1 flex min-h-6 w-full items-start justify-between gap-2 text-left text-sm font-semibold leading-relaxed text-slate-800 disabled:opacity-60' onClick={() => setActiveField(id)}><span className='whitespace-pre-wrap break-words'>{display || 'Не заполнено'}</span><Pencil className='mt-1 h-3.5 w-3.5 shrink-0 text-slate-400' /></button> : <div className='mt-1 whitespace-pre-wrap break-words text-sm font-semibold leading-relaxed text-slate-800'>{display || '—'}</div>}
    </div>;
  }
  function nativeFact(title: string, scope: 'header' | 'line', line: number, key: string, wide = false) {
    const cell = (scope === 'header' ? state.header : state.lines.find(row => row.line_number === line)?.fields)?.[key];
    return fact(title, cell?.filled ? expenseBreakdownDisplay(cell) : '', wide, cell ? {scope,line,key,cell} : undefined);
  }
  const executionLabels: Record<string,string> = {not_executed:'Не исполнена',partially_executed:'Частично исполнена',fully_executed:'Полностью исполнена',unavailable:'Данные недоступны',needs_review:'Нужен просмотр администратора'};
  return <section>
    <h2 className='text-lg font-extrabold text-slate-950'>Что запрашивают</h2>
    <p className='mt-1 text-xs font-medium text-slate-500'>Основные сведения заявки, полученные из 1С.{pendingDecision && enabled ? ' Нажмите на поле с карандашом, чтобы исправить.' : ''}</p>
    {loading && <p role='status' className='mt-3 text-sm text-slate-500'>Обновляем из 1С…</p>}
    {error && <p role='alert' className='mt-3 whitespace-pre-wrap rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950'>{error}</p>}
    {notice && <p role='status' className='mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900'>{notice}</p>}
    <div className='mt-4 grid gap-3 sm:grid-cols-2'>
      {fact('Заявитель',name(doc.requested_by))}
      {fact('Сумма',money(doc.amount,doc.currency))}
      {fact('Операция',name(doc.business_operation))}
      {nativeFact('Статья ДДС','header',0,'СтатьяДвиженияДенежныхСредств')}
      <div className='sm:col-span-2'>
        <h3 className='text-sm font-bold text-slate-900'>Расшифровка платежа</h3>
        {!state.lines.length && <p className='mt-2 text-sm text-amber-800'>В 1С нет строк расшифровки. Добавьте строку в 1С и обновите заявку.</p>}
        {state.lines.map(line => {
          const mainKeys = ['СтатьяДвиженияДенежныхСредств', 'СтатьяРасходов', 'Подразделение', 'Партнер', 'Заказ'];
          const extraFields = card.schema.filter(field => field.scope === 'line' && !mainKeys.includes(field.name) && line.fields[field.name]);
          const rowLabel = (title: string) => state.lines.length > 1 ? `${title} · строка ${line.line_number}` : title;
          return <div key={line.line_number} className='mt-2 border-t border-slate-200 pt-1'>
            {state.lines.length > 1 && <p className='mt-2 text-xs font-semibold text-slate-500'>Строка {line.line_number} · {line.fields.Сумма ? expenseBreakdownDisplay(line.fields.Сумма) : 'Сумма не передана'}</p>}
            <div className='grid gap-x-4 sm:grid-cols-2'>
              {line.fields.СтатьяДвиженияДенежныхСредств && nativeFact(rowLabel('Статья ДДС в расшифровке'),'line',line.line_number,'СтатьяДвиженияДенежныхСредств')}
              {line.fields.СтатьяРасходов && nativeFact(rowLabel('Статья расходов/активов'),'line',line.line_number,'СтатьяРасходов')}
              {line.fields.Подразделение && nativeFact(rowLabel('Подразделение расходов'),'line',line.line_number,'Подразделение')}
              {line.fields.Партнер && nativeFact(rowLabel('Партнёр'),'line',line.line_number,'Партнер')}
              {line.fields.Заказ && nativeFact(rowLabel('Основание'),'line',line.line_number,'Заказ')}
            </div>
            {!!extraFields.length && <details className='mt-2'>
              <summary className='cursor-pointer py-2 text-xs font-semibold text-slate-600'>Аналитика и другие поля{extraFields.some(field => line.fields[field.name].filled) ? ' · есть заполненные' : ''}</summary>
              <div className='grid gap-x-4 sm:grid-cols-2'>{extraFields.map(field => nativeFact(rowLabel(field.label),'line',line.line_number,field.name))}</div>
            </details>}
          </div>;
        })}
      </div>
      {nativeFact('Назначение платежа','header',0,'НазначениеПлатежа',true)}
      {nativeFact('Комментарий','header',0,'Комментарий',true)}
      {fact('Исполнение',executionLabels[String(state.execution.state)] || 'Нет данных')}
      {fact('Исполнено / осталось',state.execution.complete === true ? `${money(state.execution.executed_amount,doc.currency)} / ${money(state.execution.remaining_amount,doc.currency)}` : 'Нет данных')}
    </div>
    {preview ? <div className='mt-4 border-t border-slate-200 pt-3'><p className='text-sm font-semibold'>1С проверила изменения. Осталось подтвердить:</p><div className='my-2 space-y-1'>{diff.map((row,index) => <p key={index} className='break-words text-sm text-slate-600'>{row.label}: {row.before} → <strong className='text-slate-900'>{row.after}</strong></p>)}</div><div className='flex flex-wrap gap-2'><button className={primary} disabled={busy || uncertain} onClick={() => void send('confirm',preview.command.action)}>{preview.command.action === 'mark_payable' ? 'Утвердить к оплате' : 'Сохранить в 1С'}</button><button className={button} disabled={busy || uncertain} onClick={() => {setPreview(null);setActiveField(null);}}>Продолжить редактирование</button></div></div> : pendingDecision && enabled && supportsPayable ? <div className='mt-4 border-t border-slate-200 pt-3'>
      <p className='mb-3 text-xs text-slate-600'>1С проверит обязательные поля перед утверждением. Изменения запишутся только после вашего подтверждения.</p>
      {!!count && <p className='mb-2 text-xs text-slate-600'>Исправлено полей: {count}. Изменения ещё не сохранены.</p>}
      <div className='flex flex-wrap gap-2'><button className={primary} disabled={!canAct} onClick={() => void send('preview','mark_payable')}><Check className='h-4 w-4' />Проверить и утвердить к оплате</button>{!!count && <><button className={button} disabled={!canSave} onClick={() => void send('preview','save')}>Сохранить без утверждения</button><button className={button} disabled={busy || uncertain} onClick={() => {setChanges({});draftNames.current={};setActiveField(null);setError('');}}>Отменить изменения</button></>}</div>
    </div> : payable ? <p className='mt-3 text-sm text-slate-600'>Статус согласования в 1С: «К оплате». Исполнение показано выше.</p> : null}
    {pendingDecision && (!enabled || !supportsPayable) && <p className='mt-3 text-sm text-amber-800'>Запись через портал пока недоступна. Измените заявку в 1С.</p>}
    {busy && <p role='status' className='mt-3 text-sm font-semibold'>1С проверяет действие…</p>}
    {uncertain && recovery && <p className='mt-3 text-sm text-amber-800'>Ответ на запись не подтверждён. Проверьте результат, прежде чем продолжить.</p>}
    <div className='mt-3 flex flex-wrap gap-3'><button className='inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-slate-500 disabled:opacity-50' disabled={loading || busy || (!uncertain && !!count)} onClick={() => {setPreview(null);setActiveField(null);void load();}}><RefreshCw className='h-3.5 w-3.5' />{uncertain ? 'Проверить результат' : 'Обновить из 1С'}</button>{uncertain && recovery && <button className={button} disabled={busy || loading || recovery.command.action === 'approve'} onClick={() => void send('confirm',recovery.command.action,true)}>Повторить это же действие</button>}</div>
    {!!card.history.rows.length && <details className='mt-3 border-t border-slate-100 pt-3'><summary className='cursor-pointer text-xs font-semibold text-slate-500'>Изменения через портал · {card.history.rows.length}</summary>{card.history.truncated && <p className='mt-2 text-xs text-amber-800'>Показана часть истории.</p>}{card.history.rows.map(row => <div key={row.command_id} className='mt-2 text-xs text-slate-600'><p>{new Date(row.at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'})} · {row.actor}</p>{differences(row.before,row.after).map((item,index) => <p key={index}>{item.label}: {item.before} → {item.after}</p>)}</div>)}</details>}
  </section>;
}
