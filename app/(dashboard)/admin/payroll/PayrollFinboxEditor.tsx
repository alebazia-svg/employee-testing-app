'use client';
import { useEffect, useState } from 'react';
import { PayrollFinboxImport } from './PayrollFinboxImport';
import type { FinboxPeriodRead } from '@/lib/payroll-finbox-input';

export function useFinboxPeriod(period: string, refresh = 0) {
  const [state, setState] = useState<{period: string; data: FinboxPeriodRead | null; error: string}>({period: '', data: null, error: ''});
  useEffect(() => {
    const controller = new AbortController();
    setState({ period, data: null, error: '' });
    void fetch(`/api/admin/payroll/finbox?period=${encodeURIComponent(period)}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json().catch(()=>{throw new Error('Не удалось прочитать сохранённые агентские. Повторите загрузку.');});
      if (!response.ok || data.periodKey !== period) throw new Error(data.error || 'Не удалось прочитать Finbox.');
      if (!controller.signal.aborted) setState({period, data, error: ''});
    }).catch(error => { if (!controller.signal.aborted) setState({period, data: null, error: error.message}); });
    return () => controller.abort();
  }, [period, refresh]);
  return state.period === period ? state : {period, data: null, error: ''};
}

export function PayrollFinboxEditor({periodKey, onSaved}: {periodKey: string; onSaved: (period: string) => void}) {
  const [period, setPeriod] = useState(periodKey);
  const [refresh, setRefresh] = useState(0);
  const read = useFinboxPeriod(period, refresh);
  const [draft, setDraft] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => { setDraft(read.data?.amount ?? ''); setConfirm(false); }, [read.data]);
  const disabled = busy || !read.data || read.data.locked;
  const amount = Number(draft.trim().replace(',', '.'));
  const valid = /^\d+(?:[.,]\d{1,2})?$/.test(draft.trim()) && amount <= 10_000_000;
  const money = (value: number) => value.toLocaleString('ru-RU', {style: 'currency', currency: 'RUB'});
  const button = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
  const changePeriod = (value: string) => {setPeriod(value);setConfirm(false);setError('');setNotice('');setDraft('');};
  return <section aria-label="Finbox Дианы" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="font-bold">Finbox · Кумахова Диана</h3>
    <p className="mt-1 text-sm text-slate-600">Выберите месяц начисления. Сумма сохраняется в портале, не только на этом компьютере.</p>
    <div className="mt-3 grid grid-cols-2 gap-2"><label className="grid gap-1 text-sm">Месяц Finbox<select aria-label="Месяц Finbox" disabled={busy} value={period.slice(5)} onChange={e=>changePeriod(period.slice(0,4)+'-'+e.target.value)} className={button}>{['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'].map((name,i)=><option key={name} value={String(i+1).padStart(2,'0')}>{name}</option>)}</select></label><label className="grid gap-1 text-sm">Год<select aria-label="Год Finbox" disabled={busy} value={period.slice(0,4)} onChange={e=>changePeriod(e.target.value+period.slice(4))} className={button}>{Array.from({length:100},(_,i)=>2000+i).map(y=><option key={y} value={y}>{y}</option>)}</select></label></div>
    {period!==periodKey&&<p className="mt-2 text-sm text-amber-800">Редактируется {period}, а на основном экране открыт {periodKey}.</p>}
    {read.error&&<p role="alert" className="mt-2 text-sm text-amber-800">{read.error}</p>}
    {read.data?.locked&&<p className="mt-2 text-sm text-amber-800">{read.data.lockReason}</p>}
    {!read.data&&!read.error&&<p className="mt-2 text-sm">Загрузка сохранённой суммы…</p>}
    {read.data&&<p className="mt-2 text-sm">Сохранено: {read.data.amount===null?'ещё не внесено':money(Number(read.data.amount))}{read.data.savedAt?' · '+new Date(read.data.savedAt).toLocaleString('ru-RU'):''}</p>}
    <label className="mt-3 grid gap-1 text-sm font-semibold">Агентские, ₽<input aria-label="Агентские Finbox" inputMode="decimal" disabled={disabled} value={draft} onChange={e=>{setDraft(e.target.value);setConfirm(false);setNotice('');}} className="min-h-11 rounded-lg border border-slate-300 bg-white p-2"/></label>
    <div className="mt-3"><PayrollFinboxImport key={period} periodKey={period} currentAmount={draft} disabled={disabled} onApply={value=>{setDraft(value);setConfirm(false);setNotice('');}}/></div>
    {error&&<p role="alert" className="mt-3 text-sm text-amber-800">{error}</p>}
    {notice&&<p role="status" className="mt-3 text-sm text-emerald-800">{notice}</p>}
    {confirm&&read.data&&<div className="mt-3 rounded-lg border border-slate-300 bg-white p-3 text-sm"><strong>Диана · {period} · {money(amount)}</strong><p className="mt-1">Заменит {read.data.amount===null?'незаполненное значение':money(Number(read.data.amount))}. Изменение начисления: {money(amount-Number(read.data.amount??0))}. Сохранённые ведомости не изменяются.</p></div>}
    <div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={disabled||!valid} onClick={async()=>{
      if(!confirm){setConfirm(true);return;}
      if(!read.data||busy)return;
      setBusy(true);setError('');setNotice('');
      try {
        const response=await fetch('/api/admin/payroll/finbox',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({period,amount:draft,revision:read.data.revision})});
        const body=await response.json().catch(()=>{throw new Error('Не удалось подтвердить сохранение. Загрузите сохранённые данные перед повтором.');});
        if(!response.ok)throw new Error(body.error||'Не удалось сохранить.');
        setNotice(`Сохранено за ${period}: ${money(Number(body.amount))}.`);setConfirm(false);setRefresh(v=>v+1);onSaved(period);
      }catch(e){setError(e instanceof Error?e.message:'Не удалось подтвердить сохранение.');setConfirm(false);setRefresh(v=>v+1);onSaved(period);}
      finally{setBusy(false);}
    }}>{busy?'Сохранение…':confirm?'Подтвердить сохранение':'Проверить и сохранить'}</button>
    <button className={button} disabled={busy} onClick={()=>{setRefresh(v=>v+1);setConfirm(false);setError('');}}>Загрузить сохранённое</button></div>
  </section>;
}
