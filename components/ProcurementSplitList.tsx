"use client";
import React, { useEffect, useRef, useState, type ReactNode } from "react";

export type ProcurementListItem = { id: string; name: string; amount: string; meta: string; search?: string; warning?: string; group?: string; warningTone?: "neutral" };
export function ProcurementSplitList({ items, renderDetail, empty = "Записей нет.", initialSelectedId = "" }: { items: ProcurementListItem[]; renderDetail: (id: string) => ReactNode; empty?: string; initialSelectedId?: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initialSelectedId);
  const [mobileDetail, setMobileDetail] = useState(Boolean(initialSelectedId));
  const detailRef = useRef<HTMLElement>(null);
  const [sticky, setSticky] = useState(false);
  const filtered = items.filter(item => (item.name + " " + (item.search || "")).toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")));
  const active = filtered.find(item => item.id === selected) || filtered[0];
  useEffect(() => {
    const element = detailRef.current;
    if (!element) return;
    const measure = () => setSticky(element.getBoundingClientRect().height < window.innerHeight - 48);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [active?.id]);
  if (!items.length) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{empty}</p>;
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(270px,.9fr)_minmax(0,1.1fr)]">
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${mobileDetail && active ? "hidden lg:block" : ""}`} aria-label="Список оплат">
      <label className="block border-b border-slate-200 p-3 text-xs font-semibold text-slate-500">Найти поставщика или заказ
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900" />
      </label>
      <div>
        {filtered.map((item,index) => <React.Fragment key={item.id}>
          {item.group && item.group !== filtered[index-1]?.group ? <h3 data-priority={item.group === "Просрочено" ? "overdue" : item.group === "Сегодня" ? "today" : item.group === "Завтра" ? "tomorrow" : "later"} className="procurement-list-group border-y border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-600"><span className="flex items-center justify-between text-sm"><span>{item.group}</span><span>{filtered.filter(row=>row.group===item.group).length}</span></span></h3> : null}
          <button type="button" aria-pressed={active?.id === item.id} onClick={() => { setSelected(item.id); setMobileDetail(true); }} className={`block w-full border-b border-l-[3px] border-b-slate-100 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#829fbd] ${active?.id === item.id ? "border-l-[#263b5c] bg-slate-100" : "border-l-transparent hover:bg-slate-50"}`}>
          {item.warning ? <span className={`mb-1 inline-block rounded px-2 py-1 text-[11px] font-bold ${item.warningTone === "neutral" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-900"}`}>{item.warning}</span> : null}
          <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><strong className="text-sm text-slate-950">{item.name}</strong><span className="whitespace-nowrap text-base font-extrabold tabular-nums text-[#263b5c]">{item.amount}</span></span>
          <span className="mt-1 block text-xs text-slate-500">{item.meta}</span>
        </button></React.Fragment>)}
        {!filtered.length ? <p className="p-4 text-sm text-slate-500">Ничего не найдено. Измените поиск.</p> : null}
      </div>
    </section>
    {active ? <section ref={detailRef} aria-label="Подробности оплаты" className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 ${sticky ? "lg:sticky lg:top-4" : ""} ${mobileDetail ? "" : "hidden lg:block"}`}>
      <button type="button" onClick={() => setMobileDetail(false)} className="mb-3 min-h-10 text-sm font-bold text-[#263b5c] lg:hidden">← К списку оплат</button>
      {renderDetail(active.id)}
    </section> : null}
  </div>;
}
