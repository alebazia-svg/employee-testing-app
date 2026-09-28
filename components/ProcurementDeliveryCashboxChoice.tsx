'use client';
import React, { useState } from 'react';
import type { DeliveryFunding } from '@/lib/procurement-delivery-funding';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { DELIVERY_RESERVE, deliveryFresh } from '@/lib/procurement-delivery-policy';
import { chooseDeliveryCashbox, parseDeliveryFundingAmount } from '@/lib/procurement-delivery-cashbox-choice';

const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const cashName = (name: string) => name.replace(/^Касса\s+/i, '');

export function ProcurementDeliveryCashboxChoice({ data, view, now = Date.now() }: { data: DeliveryFunding; view: DeliveryView; now?: number }) {
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const [override, setOverride] = useState('');
  const [changing, setChanging] = useState(false);
  const fresh = deliveryFresh(view.snapshot, now);
  const buyerAmount = view.requestStateAvailable && view.requestedByBuyer ? view.requestDetails?.amount : undefined;
  const proposed = buyerAmount ?? (fresh && !view.requestedByBuyer ? Math.max(0, Math.round((DELIVERY_RESERVE.target - view.snapshot.balance!) * 100) / 100) : null);
  const input = amountInput ?? (proposed && proposed > 0 ? String(proposed) : '');
  const amount = parseDeliveryFundingAmount(input);
  const choice = chooseDeliveryCashbox(data, amount, now);
  const box = choice.candidates.find(b => b.ref === override) ?? choice.selected;
  const manual = Boolean(box && box.ref === override);

  // An existing native request must be dealt with before suggesting another top-up.
  if (choice.state === 'existing_request') return <p className="mt-3 text-sm text-slate-600">Заявка на пополнение уже есть в 1С. Проверьте её перед новой выдачей.</p>;
  if (!view.requestStateAvailable) return null;
  return <div>
    <label htmlFor="delivery-funding-amount" className="text-sm font-bold text-slate-950">Сумма выдачи, ₽</label>
    <input id="delivery-funding-amount" inputMode="decimal" type="text" autoComplete="off" value={input}
      onChange={event => { setAmountInput(event.target.value); setOverride(''); }}
      aria-describedby="delivery-funding-origin" className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-lg font-bold tabular-nums outline-none focus:border-slate-700" />
    <p id="delivery-funding-origin" className="mt-1 text-xs text-slate-500">{amountInput !== null ? buyerAmount !== undefined ? 'Изменение только для подбора кассы, не запроса Астемира.' : manual ? 'Касса выбрана вами' : 'Касса подбирается автоматически' : buyerAmount !== undefined ? 'По запросу Астемира' : proposed ? `До запаса ${money(DELIVERY_RESERVE.target)}. Это не запрос Астемира.` : 'Укажите сумму для подбора кассы.'}</p>
    <div aria-live="polite" className="mt-3">
      {box && amount !== null ? <div className="rounded-xl bg-slate-50 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-slate-600">{manual ? 'Выбрана вами' : choice.preliminary ? 'Предлагаем кассу · предварительно' : 'Предлагаем кассу'}</p>
          {choice.candidates.length > 1 ? <button type="button" onClick={() => setChanging(!changing)} className="min-h-9 text-xs font-semibold underline underline-offset-4">{changing ? 'Свернуть' : 'Сменить'}</button> : null}</div>
        <p className="mt-1 text-lg font-bold">{cashName(box.name)}</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between gap-2"><dt>Сейчас по 1С</dt><dd className="whitespace-nowrap font-semibold">{money(box.balance)}</dd></div>
          <div className="flex justify-between gap-2"><dt>После выдачи</dt><dd className="whitespace-nowrap font-semibold">{money(Math.round((box.balance - amount) * 100) / 100)}</dd></div>
        </dl>
        {box.pending! > 0 ? <p className="mt-2 text-xs text-slate-600">Из остатка ещё предстоит выдать по заявкам: {money(box.pending!)}.</p> : null}
        {changing && choice.candidates.length > 1 ? <div aria-label="Выбор кассы" className="mt-3 space-y-2">
          <button type="button" aria-pressed={!manual} onClick={() => setOverride('')} className={`min-h-11 w-full rounded-lg border p-2 text-left text-xs ${!manual ? 'border-slate-700 bg-white font-semibold' : 'border-slate-200'}`}>Автоматически — наибольший остаток</button>
          {choice.candidates.map(b => <button type="button" key={b.ref} aria-pressed={manual && b.ref === override} onClick={() => setOverride(b.ref)} className={`flex min-h-11 w-full flex-wrap items-center justify-between gap-1 rounded-lg border p-2 text-left text-sm ${manual && b.ref === override ? 'border-slate-700 bg-white font-semibold' : 'border-slate-200'}`}><span>{cashName(b.name)}</span><span className="whitespace-nowrap">{money(b.balance)}</span></button>)}
        </div> : null}
        {override && !manual ? <p className="mt-2 text-xs text-amber-800">В выбранной кассе больше не хватает суммы. Подобрана другая.</p> : null}
      </div> : choice.state === 'invalid_amount' && !input ? null : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{choice.state === 'stale' ? 'Обновляем остатки касс…' : choice.state === 'no_cashboxes' ? 'Кассы менеджеров не подключены.' : choice.state === 'unknown' ? 'Не удалось подтвердить, что одной кассы хватит. Проверьте заявки в 1С или уменьшите сумму.' : choice.state === 'insufficient' ? 'Одной кассы на эту сумму не хватает. Уменьшите сумму или оформите выдачу из нескольких касс в 1С.' : 'Введите сумму больше нуля, не более двух знаков после запятой.'}</p>}
    </div>
    {box && choice.preliminary ? <p className="mt-2 text-xs text-amber-800">Есть заявки с неуточнённой кассой или суммой. Перед выдачей проверьте их в 1С.</p> : null}
    <p className="mt-3 text-xs text-slate-500">Это подбор кассы, не согласование. Заявку пока оформите в 1С.</p>
  </div>;
}
