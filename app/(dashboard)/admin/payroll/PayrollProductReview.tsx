'use client';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PayrollReviewDecision } from '@/lib/payroll-review-save';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { classifyPayrollSalesRows, type PayrollClassifiedSalesRow, type PayrollCalculationType, type PayrollSalesClassificationRule } from '@/lib/payroll-sales-classification';
const money=(n:number)=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB'}).format(n);
const btn='min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-600';
type Group={key:string;item:string;context:string;rows:PayrollClassifiedSalesRow[]};
type Effect={manager:string;before:number;after:number};
function targetFor(g:Group,kind:string):PayrollCalculationType {
  if(g.rows[0].department==='Опт') return kind==='tech'?'WHOLESALE_EXCLUDED_TECH':'WHOLESALE_INCLUDED_1_75';
  return kind==='tech'?(g.rows[0].isCreditSale?'CREDIT_GROSS_PROFIT':'RETAIL_GROSS_PROFIT_10'):'RETAIL_ACCESSORY_5';
}
function effectsFor(g:Group,kind:string):Effect[] {
  const f=g.rows[0];
  const rule:PayrollSalesClassificationRule={id:-1,title:'Макет',isActive:true,priority:100000,matchType:'EXACT_ITEM',itemText:f.item,categoryText:f.category,article:null,department:f.department==='Опт'?'wholesale':'retail',saleContext:f.isCreditSale?'credit':'regular',targetCalculationType:targetFor(g,kind),reason:'Без сохранения'};
  const result=classifyPayrollSalesRows(g.rows,[rule]);
  const before=classifyPayrollSalesRows(g.rows);
  if(f.department==='Опт') return ['Ахобекова Залина','Хурзокова Лиана'].map(manager=>({manager,before:g.rows.filter(r=>r.includedInWholesaleBase).reduce((s,r)=>s+r.revenue,0)*.0175,after:result.wholesale.bonusEach}));
  return [...new Set(g.rows.map(r=>r.manager))].map(manager=>({manager,before:before.managerSummaries.find(r=>r.manager===manager)?.totalBonus??0,after:result.managerSummaries.find(r=>r.manager===manager)?.totalBonus??0}));
}
export default function PayrollReviewPreview({rows, embedded=false, period='',onSave}:{rows:PayrollClassifiedSalesRow[];embedded?:boolean;period?:string;onSave?:(decisions:PayrollReviewDecision[])=>Promise<void>}) {
 const groups=useMemo(()=>{
   const m=new Map<string,Group>(); rows.forEach(r=>{const context=r.department==='Опт'?'Опт':r.isCreditSale?'Розница · кредит':'Розница';const key=JSON.stringify([r.item,r.category,r.department,r.isCreditSale]);const g=m.get(key)??{key,item:r.item,context,rows:[]};g.rows.push(r);m.set(key,g)});return [...m.values()];
 },[rows]);
 const [saving,setSaving]=useState(false),[saveError,setSaveError]=useState('');
 const [query,setQuery]=useState(''),[context,setContext]=useState('Все продажи'),[status,setStatus]=useState('pending');
 const [checked,setChecked]=useState<string[]>([]),[detail,setDetail]=useState(''),[kind,setKind]=useState(''),[confirm,setConfirm]=useState(false);
 const [decisions,setDecisions]=useState<Record<string,string>>({}),[notice,setNotice]=useState('');
 const visible=groups.filter(g=>(context==='Все продажи'||g.context===context)&&(status==='all'||(status==='done'?!!decisions[g.key]:!decisions[g.key]))&&(g.item+' '+g.rows.map(r=>r.manager).join(' ')).toLowerCase().includes(query.toLowerCase()));
 const selected=groups.filter(g=>checked.includes(g.key));
 const contexts=[...new Set(selected.map(g=>g.context))];
 const mixed=contexts.length>1;
 const current=groups.find(g=>g.key===detail);
 const totals=useMemo(()=>{const m=new Map<string,Effect>();if(!kind||mixed)return [];selected.forEach(g=>effectsFor(g,kind).forEach(e=>{const v=m.get(e.manager)??{manager:e.manager,before:0,after:0};v.before+=e.before;v.after+=e.after;m.set(e.manager,v)}));return [...m.values()];},[selected,kind,mixed]);
 const reset=()=>{setChecked([]);setKind('');setConfirm(false)};
 const toggle=(key:string)=>{setChecked(a=>a.includes(key)?a.filter(k=>k!==key):[...a,key]);setKind('');setConfirm(false)};
 const all=visible.length>0&&visible.every(g=>checked.includes(g.key));
 const Wrapper = embedded ? 'div' : AdminShell;
 return <Wrapper><div className="mx-auto max-w-[1440px]">
 {!embedded && <AdminBreadcrumbs current="Зарплата · проверка"/>}
 <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Проверка товаров</h2><p className="mt-1 text-sm text-slate-500">{period} · товаров к проверке: {groups.length-Object.keys(decisions).length}</p></div><span className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-600">{onSave?'Изменения сохраняются после подтверждения':'Предпросмотр. Изменения не сохраняются'}</span></div>

 <h2 className="mb-2 text-base font-bold">Товары: выбрать правило начисления</h2>
 <p className="mb-4 text-sm text-slate-600">Отметьте товары → выберите правило → проверьте изменение. Для подробностей нажмите на название.</p>
 {saveError&&<p role="alert" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">{saveError}</p>}
 {notice&&<p role="status" className="mb-3 rounded-lg border border-slate-200 bg-white p-3 text-sm">{notice}</p>}
 <div className="rounded-xl border border-slate-200 bg-white">
 <div className="flex flex-wrap gap-3 border-b border-slate-200 p-3">
 <label className="grid flex-1 gap-1 text-xs text-slate-500">Товар или сотрудник<input className={btn+' min-w-40'} placeholder="Поиск" value={query} onChange={e=>{setQuery(e.target.value);reset()}}/></label>
 <label className="grid gap-1 text-xs text-slate-500">Вид продажи<select className={btn} value={context} onChange={e=>{setContext(e.target.value);reset()}}>{['Все продажи','Розница','Опт','Розница · кредит'].map(v=><option key={v}>{v}</option>)}</select></label>
 {!onSave&&<label className="grid gap-1 text-xs text-slate-500">Показать<select className={btn} value={status} onChange={e=>{setStatus(e.target.value);reset()}}><option value="pending">Нерешённые</option><option value="done">Проверено в макете</option><option value="all">Все</option></select></label>}
 </div>
 <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 p-3">
 <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={()=>{setChecked(all?[]:visible.map(g=>g.key));setKind('');setConfirm(false)}} className="h-4 w-4 accent-slate-800"/>Все в списке ({visible.length})</label>
 {selected.length?<>
 <strong className="text-sm">Выбрано: {selected.length}</strong>
 <select aria-label="Групповое правило" className={btn} value={kind} disabled={mixed} onChange={e=>{setKind(e.target.value);setConfirm(false)}}><option value="">Учитывать как…</option><option value="tech">Техника</option><option value="accessory">{contexts[0]==='Опт'?'Товар в базе опта':'Аксессуар'}</option></select>
 <button className={btn+' !bg-slate-800 !text-white disabled:opacity-40'} disabled={!kind||mixed} onClick={()=>setConfirm(true)}>Показать изменения</button>
 <button className={btn} onClick={reset}>Снять выбор</button>
 </>:<span className="text-sm text-slate-500">Можно отметить несколько товаров сразу</span>}
 {mixed&&<p role="status" className="w-full text-sm text-amber-800">Выбраны разные виды продажи. Отфильтруйте розницу, опт или кредит: для них действуют разные правила.</p>}
 </div>
 <div className={'grid '+(current?'xl:grid-cols-[minmax(0,1fr)_370px]':'')}>
 <div className="min-w-0 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left text-xs text-slate-500"><tr><th className="w-10 p-3"><span className="sr-only">Выбор</span></th><th className="p-3">Товар / вид продажи</th><th className="p-3">Сейчас учитывается</th><th className="p-3 text-right">Начисление</th></tr></thead><tbody>
 {visible.map(g=>{const f=g.rows[0];const wholesale=f.department==='Опт';const amount=wholesale?g.rows.filter(r=>r.includedInWholesaleBase).reduce((s,r)=>s+r.revenue,0)*.0175:classifyPayrollSalesRows(g.rows).managerSummaries.reduce((s,r)=>s+r.totalBonus,0);return <tr key={g.key} className={'border-t border-slate-100 '+(checked.includes(g.key)?'bg-slate-50':'')}>
 <td className="p-3 align-top"><input aria-label={'Выбрать '+g.item+' · '+g.context} type="checkbox" checked={checked.includes(g.key)} onChange={()=>toggle(g.key)} className="mt-1 h-4 w-4 accent-slate-800"/></td>
 <td className="min-w-[230px] max-w-[520px] p-3"><button className="text-left font-semibold leading-snug text-slate-900 underline decoration-slate-300 underline-offset-4" onClick={()=>setDetail(g.key)}>{g.item}</button><p className="mt-1 text-xs text-slate-500">{g.context}</p>{decisions[g.key]&&<p className="mt-1 text-xs text-emerald-800">В макете: {decisions[g.key]==='tech'?'Техника':wholesale?'В базе опта':'Аксессуар'}</p>}</td>
 <td className="min-w-[145px] p-3 align-top text-slate-600">{wholesale?(f.includedInWholesaleBase?'База опта · 1,75%':'Исключено'):f.formula.replace(/, требует проверки/g,'')}<p className="mt-1 text-xs text-slate-400">{decisions[g.key]?'Исходное начисление':'Нужно подтвердить'}</p></td>
 <td className="whitespace-nowrap p-3 text-right align-top tabular-nums font-medium">{money(amount)}{wholesale&&<p className="mt-1 text-xs font-normal text-slate-500">каждому из двух</p>}</td>
 </tr>})}</tbody></table>{!visible.length&&<p className="p-8 text-center text-sm text-slate-500">Позиций нет. Измените фильтры или поиск.</p>}</div>
 {current&&<aside aria-label="Подробности товара" className="fixed inset-y-0 right-0 z-40 w-full max-w-[420px] overflow-y-auto border-l border-slate-200 bg-white p-5 shadow-xl xl:static xl:z-auto xl:max-w-none xl:shadow-none">
 <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Подробности</h2><button className={btn} onClick={()=>setDetail('')}>Закрыть</button></div><h3 className="mt-4 text-base font-bold">{current.item}</h3><p className="mt-1 text-xs text-slate-500">{current.context}</p>
 <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm"><strong>Почему проверяем:</strong> {current.rows[0].classificationReason}</p>
 <dl className="mt-4 space-y-3 text-sm">{(['revenue','cost','grossProfit'] as const).map((k,i)=><div key={k} className="flex justify-between gap-2"><dt className="text-slate-500">{['Выручка','Себестоимость','Прибыль'][i]}</dt><dd className="font-semibold">{money(current.rows.reduce((s,r)=>s+r[k],0))}</dd></div>)}</dl>
 <h4 className="mt-5 text-sm font-semibold">Сотрудники в источнике</h4><p className="mt-1 text-sm text-slate-600">{[...new Set(current.rows.map(r=>r.manager))].join(', ')}</p>
 <details className="mt-5 border-t border-slate-200 pt-4"><summary className="cursor-pointer text-sm font-semibold">Исходные строки ({current.rows.length})</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead className="bg-slate-50"><tr><th className="p-2 text-left">Сотрудник / клиент</th><th className="p-2 text-right">Выручка</th><th className="p-2 text-right">Себестоимость</th></tr></thead><tbody>{current.rows.map((r,i)=><tr key={i} className="border-t border-slate-100"><td className="p-2">{r.manager}<br/><span className="text-slate-500">{r.client}</span></td><td className="p-2 text-right">{money(r.revenue)}</td><td className="p-2 text-right">{money(r.cost)}</td></tr>)}</tbody></table></div><p className="mt-3 text-xs text-slate-500">Категория 1С: {current.rows[0].category}. Это сгруппированные строки снимка. Номеров документов в нём нет. Если по названию товар определить нельзя, проверьте его карточку в 1С; не назначайте правило наугад.</p></details>
 {decisions[current.key]&&<button className={btn+' mt-5'} onClick={()=>setDecisions(d=>{const n={...d};delete n[current.key];return n})}>Отменить решение в макете</button>}
 </aside>}
 </div></div>
 <p className="mt-3 text-xs text-slate-500">Массовый выбор относится только к видимому отфильтрованному списку. При смене фильтра выбор сбрасывается.</p>
 {confirm&&createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/30 p-4" onKeyDown={e=>{if(e.key==='Escape'&&!saving)setConfirm(false)}}><section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
 <div className="flex items-center justify-between gap-3"><h2 id="confirm-title" className="text-lg font-bold">Начислено по выбранным товарам</h2><button autoFocus className={btn} disabled={saving} onClick={()=>setConfirm(false)}>Закрыть</button></div>
 <p className="mt-3 text-sm">{contexts[0]} · Позиций: {selected.length} · {kind==='tech'?'Техника':contexts[0]==='Опт'?'Включить в базу опта':'Аксессуары'}</p>
 <p className="mt-2 text-sm text-slate-600">{contexts[0]==='Опт'?(kind==='tech'?'Техника исключается из базы опта.':'Выручка включается в базу: 1,75% каждому оптовому менеджеру.'):kind==='accessory'?'5% выручки.':contexts[0]==='Розница · кредит'?'10% прибыли после вычета 9% налогов и издержек.':'10% валовой прибыли.'}</p>
 <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 text-left">Сотрудник</th><th className="p-3 text-right">Сейчас</th><th className="p-3 text-right">После</th><th className="p-3 text-right">Разница</th></tr></thead><tbody>{totals.map(e=><tr key={e.manager} className="border-t border-slate-100"><td className="p-3">{e.manager}</td><td className="p-3 text-right">{money(e.before)}</td><td className="p-3 text-right font-semibold">{money(e.after)}</td><td className="p-3 text-right">{money((Math.round((e.after+Number.EPSILON)*100)-Math.round((e.before+Number.EPSILON)*100))/100)}</td></tr>)}</tbody></table></div>
 {onSave&&<p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm">Правила применяются к этим товарам и виду продажи во всех рабочих периодах, не только в текущем месяце. Сохранённые ведомости не изменяются.</p>}<div className="mt-5 flex flex-wrap gap-2"><button className={btn+' !bg-slate-800 !text-white'} disabled={saving} onClick={async ()=>{
 if(saving)return;setSaveError('');
 if(!onSave){setDecisions(d=>{const n={...d};selected.forEach(g=>n[g.key]=kind);return n});setNotice('Отмечено только в макете.');reset();return;}
 setSaving(true);
 try{
 await onSave(selected.map(g=>({item:g.rows[0].item,category:g.rows[0].category,department:g.rows[0].department==='Опт'?'wholesale':'retail',saleContext:g.rows[0].isCreditSale?'credit':'regular',target:targetFor(g,kind)})));
 setNotice('Правила сохранены. Список вопросов и начисления обновлены. Проверьте итог перед утверждением.');reset();
 }catch(error){setSaveError(error instanceof Error?error.message:'Не удалось сохранить.');setConfirm(false);}
 finally{setSaving(false);}
 }}>{saving?'Сохранение…':onSave?'Сохранить правила и пересчитать':'Подтвердить только в макете'}</button><button className={btn} disabled={saving} onClick={()=>setConfirm(false)}>Назад к выбору</button></div>
 </section></div>, document.body)}
 </div></Wrapper>;
}
