'use client';
import React, { useState } from 'react';
import { ProcurementDeliveryFundingNotice } from './ProcurementDeliveryFundingNotice';
import { ProcurementDeliveryCreate } from './ProcurementDeliveryCreate';
import type { DeliveryFunding } from '@/lib/procurement-delivery-funding';
import type { DeliveryView } from '@/lib/procurement-delivery-reminders';
import { DELIVERY_RESERVE, deliveryFresh } from '@/lib/procurement-delivery-policy';
import { chooseDeliveryCashbox, parseDeliveryFundingAmount } from '@/lib/procurement-delivery-cashbox-choice';

const money = (n: number) => `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`;
const cashName = (name: string) => name.replace(/^Касса\s+/i, '');

export function ProcurementDeliveryCashboxChoice({ data, view, now = Date.now() }: { data: DeliveryFunding; view: DeliveryView; now?: number }) {
  const [amountInput, setAmountInput] = useState<string | null>(null);
  const [override, setOverride] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const fresh = deliveryFresh(view.snapshot, now);
  const buyerAmount = view.requestStateAvailable && view.requestedByBuyer ? view.requestDetails?.amount : undefined;
  const proposed = buyerAmount ?? (fresh && !view.requestedByBuyer ? Math.max(0, Math.round((DELIVERY_RESERVE.target - view.snapshot.balance!) * 100) / 100) : null);
  const input = amountInput ?? (proposed && proposed > 0 ? String(proposed) : '');
  const amount = parseDeliveryFundingAmount(input);
  const choice = chooseDeliveryCashbox(data, amount, now);
  const box = override ? data.cashboxes.find(b => b.ref === override) ?? null : choice.selected;
  const eligible = Boolean(box && choice.candidates.some(b => b.ref === box.ref));
  const manual = Boolean(box && box.ref === override);

  // An existing native request must be dealt with before suggesting another top-up.
  if (choice.state === 'existing_request') return <p className="mt-3 text-sm text-slate-600">Заявка на пополнение уже есть в 1С. Проверьте её перед новой выдачей.</p>;
  if (!view.requestStateAvailable) return null;
  return <div>
    <div hidden={reviewing}>
    {buyerAmount === undefined ? <><label htmlFor="delivery-funding-amount" className="text-sm font-bold text-slate-950">Сумма выдачи, ₽</label>
    <input id="delivery-funding-amount" inputMode="decimal" type="text" autoComplete="off" value={input}
      onChange={event => { setAmountInput(event.target.value); setOverride(''); }}
      aria-describedby="delivery-funding-origin" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-lg font-bold tabular-nums outline-none focus:border-slate-700" />
    <p id="delivery-funding-origin" className="mt-1 text-xs text-slate-500">{amountInput !== null ? manual ? 'Касса выбрана вами' : 'Касса подбирается автоматически' : proposed ? `До запаса ${money(DELIVERY_RESERVE.target)}. Это не запрос Астемира.` : 'Укажите сумму для подбора кассы.'}</p></> : null}
    <div className="space-y-3">
      <div>
        <label htmlFor="delivery-cashbox" className="block text-xs font-semibold text-slate-600">Касса выдачи</label>
        <select id="delivery-cashbox" value={override || box?.ref || ''} disabled={choice.state === 'stale' || !data.cashboxes.length}
          onChange={event => setOverride(event.target.value)} aria-describedby="delivery-cashbox-hint"
          className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-700 focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100">
          {!box && !override ? <option value="">Выберите кассу</option> : null}
          {override && !box ? <option value={override}>Выбранная касса больше недоступна</option> : null}
          {data.cashboxes.map(b => {
            const available = choice.candidates.some(candidate => candidate.ref === b.ref);
            const reason = choice.state === 'stale' ? 'обновляем данные' : b.pending === null || !Number.isFinite(b.balance) || !Number.isFinite(b.pending) ? 'остаток требует проверки' : 'недостаточно средств с учётом заявок';
            return <option key={b.ref} value={b.ref} disabled={!available}>{cashName(b.name)} · {money(b.balance)}{available ? data.cashboxes.length > 1 && b.ref === choice.selected?.ref ? ' · рекомендуем' : '' : ` · ${reason}`}</option>;
          })}
        </select>
        <p hidden={data.cashboxes.length === 1} id="delivery-cashbox-hint" className="mt-1.5 text-xs text-slate-500">{data.cashboxes.length === 1 ? 'Подключена одна касса.' : manual ? 'Выбрана вами · остаток проверим перед созданием.' : 'Предложена касса с наибольшим остатком. Можно изменить.'}</p>
      </div>
      {box && amount !== null && eligible ? <dl className="grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-slate-500">В кассе по 1С</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{money(box.balance)}</dd></div>
        <div><dt className="text-slate-500">После этой выдачи</dt><dd className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{money(Math.round((box.balance - amount) * 100) / 100)}</dd></div>
        {box.pending! > 0 ? <div className="col-span-2 text-slate-600">По другим заявкам этой кассы ещё к выдаче: {money(box.pending!)}.</div> : null}
      </dl> : null}
      {override && !eligible ? <p role="alert" className="text-xs text-amber-800">Выбранная касса больше не подходит для этой суммы. Выберите другую; автоматически касса не менялась.</p> : null}
      {!eligible && !(choice.state === 'invalid_amount' && !input) ? <p role="status" className="text-sm text-amber-800">{choice.state === 'stale' ? 'Обновляем остатки касс…' : choice.state === 'no_cashboxes' ? 'Кассы менеджеров не подключены.' : choice.state === 'unknown' ? 'Остатки или назначенные выплаты требуют проверки в 1С.' : choice.state === 'insufficient' ? 'Одной кассы на эту сумму не хватает. Уменьшите сумму или оформите выдачу из нескольких касс в 1С.' : choice.state === 'invalid_amount' ? 'Введите сумму больше нуля, не более двух знаков после запятой.' : 'Выберите доступную кассу.'}</p> : null}
      {box && choice.preliminary ? data.unassignedCount || data.reviewCount ? <ProcurementDeliveryFundingNotice /> : <p className="border-l-2 border-amber-300 pl-3 text-xs text-amber-900">Не по всем кассам известны выплаты. Предложены только кассы с проверенными данными.</p> : null}
    </div>
    </div>
    <ProcurementDeliveryCreate onReviewChange={setReviewing} cashboxRef={box?.ref} ready={choice.state === 'ready' && eligible && buyerAmount !== undefined && amount === buyerAmount} />
  </div>;
}
