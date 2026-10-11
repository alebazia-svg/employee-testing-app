'use client';
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { deliveryQueueStage, requestWaitingAge, type ExpenseQueueStage } from '@/lib/expense-request-queue';
import type { DeliveryHistoryRow, DeliveryView } from '@/lib/procurement-delivery-reminders';
import { deliveryIsCurrent, deliveryMatchesQuery, deliveryRowRef, retainDeliveryIdentity } from '@/lib/expense-request-unified-list';
import { ProcurementDeliveryFunding } from './ProcurementDeliveryFunding';
import { ProcurementDeliveryHistoryRow } from './ProcurementDeliveryHistory';

export type ExpenseListRow = { id: string; nativeRef: string; date: string; queueSince?: string | null; stage?: ExpenseQueueStage; content: React.ReactNode };
export function ExpenseRequestsList({ rows, delivery, history, query, empty, warning, queue = !history, hasMoreNative = false, stageFilter = 'all' }: {
  rows: ExpenseListRow[]; delivery?: DeliveryView; history?: { rows: DeliveryHistoryRow[]; nextCursor: string | null };
  stageFilter?: string; queue?: boolean; hasMoreNative?: boolean; query: string; empty: React.ReactNode; warning?: React.ReactNode;
}) {
  const [current, setCurrent] = useState(delivery);
  const updateCurrent = useCallback((next: DeliveryView) => setCurrent(previous => retainDeliveryIdentity(previous, next)), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => setCurrent(delivery), [delivery]);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 15_000); return () => clearInterval(tick); }, []);
  const showCurrent = current && deliveryIsCurrent(current, now) && deliveryMatchesQuery(current, query) && (stageFilter === 'all' || deliveryQueueStage(current, now) === stageFilter);
  const past = history?.rows.filter(row => deliveryMatchesQuery(row, query)) ?? [];
  // Exact document identities only. Equal amounts/names never merge requests.
  // A closed current request also hides its stale imported row until the next sync.
  const represented = new Set(past.map(deliveryRowRef).filter(Boolean));
  if (current && deliveryRowRef(current) && (!deliveryIsCurrent(current, now) || showCurrent || stageFilter !== 'all')) represented.add(deliveryRowRef(current));
  const nativeRows = rows.filter(row => !represented.has(row.nativeRef.toLowerCase()));
  const combined = [...nativeRows, ...past.map(row => ({ id: `delivery:${row.id}`, nativeRef: deliveryRowRef(row), date: row.requestedAt,
    content: <ProcurementDeliveryHistoryRow row={row} now={now} /> }))];
  if (history) combined.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  const summaryEntries: { stage: ExpenseQueueStage; since?: string | null }[] = nativeRows.map(row => ({ stage: row.stage || 'decision', since: row.queueSince }));
  if (showCurrent && current) summaryEntries.push({ stage: deliveryQueueStage(current, now), since: current.requestDetails?.requestedAt });
  const older = summaryEntries.filter(row => row.stage === 'decision' && requestWaitingAge(row.since, now)?.overDay).length;
  const entries = combined.map(row => ({ key: row.id, since: 'queueSince' in row ? row.queueSince : null, content: row.content }));
  if (delivery) entries.push({ key: 'delivery-current', since: current?.requestDetails?.requestedAt, content: <div hidden={!showCurrent}><ProcurementDeliveryFunding view={delivery} onView={updateCurrent} /></div> });
  const ranks = new Map(nativeRows.map(row => [row.id, row.stage === 'issuance' ? 2 : row.stage === 'check' ? 1 : 0]));
  if (current) ranks.set('delivery-current', deliveryQueueStage(current, now) === 'issuance' ? 2 : deliveryQueueStage(current, now) === 'check' ? 1 : 0);
  if (queue) entries.sort((a, b) => (ranks.get(a.key) ?? 0) - (ranks.get(b.key) ?? 0) || (a.since && Number.isFinite(Date.parse(a.since)) ? Date.parse(a.since) : Infinity) - (b.since && Number.isFinite(Date.parse(b.since)) ? Date.parse(b.since) : Infinity));
  return <>
    {warning}
    {queue && summaryEntries.length > 0 ? <div aria-label="Состояние очереди" className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-sm">
      <span className="font-semibold text-slate-900">{query ? 'В результатах поиска' : hasMoreNative ? 'В показанной части очереди' : 'В списке'}: {summaryEntries.length}</span>
      <span className="text-slate-600">Нужно решение <strong className="ml-1 text-slate-900">{summaryEntries.filter(row => row.stage === 'decision').length}</strong></span>
      {summaryEntries.some(row => row.stage === 'issuance') ? <span className="text-slate-600">Ждут выдачи <strong className="ml-1 text-slate-900">{summaryEntries.filter(row => row.stage === 'issuance').length}</strong></span> : null}
      {summaryEntries.some(row => row.stage === 'check') ? <span className="text-amber-800">Проверить статус: {summaryEntries.filter(row => row.stage === 'check').length}</span> : null}
      {older ? <span className="text-xs font-semibold text-amber-800">Ждут решения более суток: {older}</span> : null}
    </div> : null}
<div className="hidden grid-cols-[220px_minmax(0,1fr)_176px_224px] min-[1600px]:grid-cols-[240px_minmax(0,1fr)_220px_240px] gap-5 border-b border-slate-100 bg-slate-50/60 px-5 py-3 text-xs font-semibold text-slate-600 xl:grid"><span>Сотрудник и сумма</span><span>Назначение</span><span>Касса выдачи</span><span>Решение и статус</span></div>
    <div className="divide-y divide-slate-100">{entries.map(row => <div key={row.key}>{row.content}</div>)}</div>
    {hasMoreNative ? <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Найдено больше 200 заявок. Показаны первые 200 подходящих записей; уточните поиск. Полный список доступен в 1С.</p> : null}
    {!showCurrent && !combined.length && !warning ? empty : null}
    {history?.nextCursor ? <Link href={`/admin/expense-requests?view=all&deliveryCursor=${encodeURIComponent(history.nextCursor)}${query ? `&q=${encodeURIComponent(query)}` : ''}`} className="block border-t border-slate-100 px-5 py-3 text-sm font-semibold underline underline-offset-4">Более ранние запросы на подотчёт</Link> : null}
  </>;
}
