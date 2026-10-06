'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SupplierCurrencyPaymentRow } from '@/lib/procurement-currency-payment-source';
import { samePaymentSupplier } from '@/lib/procurement-manual-payment-links';
import {hasConfirmedPaymentBasis} from '@/lib/procurement-payment-basis';

type Plan = { id: string; supplierPartner: string; supplierCounterparty: string; orderRefs?: string[]; orderNumbers: string[]; remaining: number; remainingForeign: number | null; status: string; paymentMethod: string };
export function ProcurementUnlinkedPayments({ payments, plans, linked, view = 'review' }: {
  payments: SupplierCurrencyPaymentRow[]; plans: Plan[];
  linked: { planId: string; ref: string; label: string; confirmed: boolean }[];
  view?: 'review' | 'history';
}) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState(false);
  const money = (n: number) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
  async function save(id: string, ref: string, action: 'LINK' | 'UNLINK') {
    setBusy(ref); setMessage('');
    try {
      const response = await fetch(`/api/admin/procurement/payment-plans/${id}/payment-link`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref, action }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить.');
      setMessage(action === 'LINK' ? 'Оплата зачтена. Результат отразится и у Астемира.' : 'Привязка отменена. Документ 1С не изменён.');
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Нет связи с порталом.'); }
    finally { setBusy(''); }
  }
  const visiblePayments = view === 'review' ? payments : [];
  const visibleLinks = linked.filter(link => view === 'history' ? link.confirmed : !link.confirmed);
  const count = visiblePayments.length + visibleLinks.length;
  if (!count) return null;
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 className="font-bold text-slate-900">{view === 'history' ? 'Зачтено вручную' : 'Платежи для проверки'} · {count}</h2>
    {view === 'review' && <p className="mt-1 text-sm text-slate-500">Проверьте, к каким заявкам относятся эти оплаты.</p>}
    {message && <p role="status" className="mt-3 text-sm font-medium">{message}</p>}
    <div className="divide-y divide-slate-100">{(expanded ? visiblePayments : visiblePayments.slice(0, 5)).map((payment) => {
      const foreign = payment.documentCurrency === 'USDT';
      const hasBasis = hasConfirmedPaymentBasis(payment, plans.flatMap(plan => plan.orderRefs || []));
      const contractLabel = payment.contract?.trim() || payment.registerContractBasis?.contracts.map(c => c.name).join(', ');
      const options = plans.filter((plan) => plan.status === 'APPROVED' && (plan.paymentMethod === 'USDT') === foreign &&
        (foreign ? plan.remainingForeign == null || plan.remainingForeign >= payment.documentAmount : plan.remaining >= payment.documentAmount) && samePaymentSupplier(plan, payment));
      return <div key={payment.ref} className="grid gap-2 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,1fr)_auto] lg:items-center">
        <div><p className="font-semibold">{payment.supplier || payment.counterparty} · {foreign ? `${payment.documentAmount.toLocaleString('ru-RU')} USDT` : money(payment.documentAmount)}</p>
          <p className="text-xs text-slate-500">РКО {payment.number} · {payment.date}{contractLabel ? ` · ${contractLabel}` : ''}</p>
          <p className={hasBasis ? 'text-xs text-slate-500' : 'text-sm font-medium text-amber-800'}>{hasBasis ? 'Основание в 1С подтверждено' : 'Не удалось проверить основание оплаты'}</p></div>
        {!hasBasis ? <p className="text-sm text-slate-600 lg:col-span-2">Портал получил расходник, но не подтвердил его связь с договором или заказом. Заявка пока не закрыта.</p> : options.length ? <><select aria-label={`Заявка для РКО ${payment.number}`} className="min-w-0 rounded-lg border border-slate-200 p-2 text-sm"
          value={choices[payment.ref] || ''} onChange={(event) => setChoices({ ...choices, [payment.ref]: event.target.value })}>
          <option value="">Выберите заявку</option>{options.map((plan) => <option key={plan.id} value={plan.id}>{plan.orderNumbers.length ? `Заказ ${plan.orderNumbers.join(', ')}` : 'В счёт долга поставщику'} · остаток {foreign && plan.remainingForeign != null ? `${plan.remainingForeign} USDT` : money(plan.remaining)}</option>)}</select>
          <button disabled={Boolean(busy) || !choices[payment.ref]} onClick={() => save(choices[payment.ref], payment.ref, 'LINK')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40">Подтвердить</button></> :
          <p className="text-sm text-slate-500">Нет подходящей согласованной заявки. Оплата остаётся видна здесь.</p>}
      </div>;
    })}</div>
    {visiblePayments.length > 5 && <button onClick={() => setExpanded(!expanded)} className="text-sm font-semibold text-slate-600">{expanded ? 'Свернуть' : `Показать все ${visiblePayments.length}`}</button>}
    <div className="divide-y divide-slate-100 text-sm">{visibleLinks.map((link) => <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={`${link.planId}:${link.ref}`}>
      <div className="min-w-0 break-words"><p className="font-semibold text-slate-900">{link.label}</p>
        {!link.confirmed && <p className="mt-1 text-amber-800">Привязка требует проверки: оплата изменилась или не подтверждена.</p>}</div>
      <button disabled={Boolean(busy)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 disabled:opacity-40" onClick={() => save(link.planId, link.ref, 'UNLINK')}>Отменить привязку</button>
    </div>)}</div>
  </section>;
}
