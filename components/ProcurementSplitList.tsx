"use client";
import React, { useState, type ReactNode } from "react";

export type ProcurementListItem = { id: string; name: string; amount: string; meta: string; search?: string; warning?: string };
export function ProcurementSplitList({ items, renderDetail, empty = "Записей нет." }: { items: ProcurementListItem[]; renderDetail: (id: string) => ReactNode; empty?: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [mobileDetail, setMobileDetail] = useState(false);
  const filtered = items.filter(item => (item.name + " " + (item.search || "")).toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")));
  const active = filtered.find(item => item.id === selected) || filtered[0];
  if (!items.length) return <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">{empty}</p>;
  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(270px,.9fr)_minmax(0,1.1fr)]">
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white ${mobileDetail && active ? "hidden lg:block" : ""}`} aria-label="Список оплат">
      <label className="block border-b border-slate-200 p-3 text-xs font-semibold text-slate-500">Найти поставщика или заказ
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} className="mt-2 min-h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-slate-900" />
      </label>
      <div className="max-h-[520px] overflow-y-auto">
        {filtered.map(item => <button type="button" key={item.id} aria-pressed={active?.id === item.id} onClick={() => { setSelected(item.id); setMobileDetail(true); }} className={`block w-full border-b border-l-[3px] border-b-slate-100 px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#829fbd] ${active?.id === item.id ? "border-l-[#263b5c] bg-slate-100" : "border-l-transparent hover:bg-slate-50"}`}>
          {item.warning ? <span className="mb-1 inline-block rounded bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900">{item.warning}</span> : null}
          <strong className="block text-sm text-slate-950">{item.name}</strong><span className="mt-1 block text-lg font-black text-[#263b5c]">{item.amount}</span>
          <span className="mt-1 block text-xs text-slate-500">{item.meta}</span>
        </button>)}
        {!filtered.length ? <p className="p-4 text-sm text-slate-500">Ничего не найдено. Измените поиск.</p> : null}
      </div>
    </section>
    {active ? <section aria-label="Подробности оплаты" className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 ${mobileDetail ? "" : "hidden lg:block"}`}>
      <button type="button" onClick={() => setMobileDetail(false)} className="mb-3 min-h-10 text-sm font-bold text-[#263b5c] lg:hidden">← К списку оплат</button>
      {renderDetail(active.id)}
    </section> : null}
  </div>;
}
