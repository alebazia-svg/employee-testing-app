'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import { DELIVERY_RESERVE } from '@/lib/procurement-delivery-policy';
import { deliveryAmountFromText, type DeliveryRequestInput } from '@/lib/procurement-delivery-request';

export function ProcurementDeliveryRequestDialog({ balance, pending, available, error, onCancel, onSubmit }: {
  balance: number; pending: boolean; available: boolean; error: string;
  onCancel: () => void; onSubmit: (input: DeliveryRequestInput) => void;
}) {
  const [amount, setAmount] = useState(() => String(Math.max(0, Math.round((DELIVERY_RESERVE.target - balance) * 100) / 100)).replace('.', ','));
  const [comment, setComment] = useState('');
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const amountValue = deliveryAmountFromText(amount);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={dialogRef} aria-labelledby={titleId}
    onCancel={event => { event.preventDefault(); if (!pending) onCancel(); }}
    className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 text-slate-950 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm sm:p-6">
    <h2 id={titleId} className="text-xl font-black">Пополнение подотчёта</h2>
    <form className="mt-5 space-y-4" onSubmit={event => { event.preventDefault(); if (amountValue !== null && available && !pending) onSubmit({ amount: amountValue, comment: comment.trim() }); }}>
      <label className="block text-sm font-semibold">Сумма пополнения, ₽
        <input autoFocus required inputMode="decimal" value={amount} disabled={pending} onChange={event => setAmount(event.target.value)}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-lg font-bold" />
      </label>
      <p className="!mt-2 text-xs leading-5 text-slate-500">Предложена сумма до запаса 35 000 ₽. Можно изменить.</p>
      <label className="block text-sm font-semibold">Комментарий <span className="font-normal text-slate-500">· необязательно</span>
        <textarea rows={2} maxLength={500} value={comment} disabled={pending} onChange={event => setComment(event.target.value)} placeholder="Например, завтра две крупные доставки"
          className="mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-3 text-base font-normal" />
      </label>
      {!available && !pending ? <p role="status" className="text-sm text-amber-800">Отправка временно недоступна. Проверьте остаток в карточке; заполненное сохранится в этом окне.</p> : null}
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <p className="text-xs text-slate-500">Выдача денег — после согласования.</p>
      <div className="flex flex-col gap-2">
        <button type="submit" disabled={pending || !available || amountValue === null} className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-40">{pending ? 'Отправляем…' : 'Отправить запрос'}</button>
        <button type="button" disabled={pending} onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold disabled:opacity-40">Отмена</button>
      </div>
    </form>
  </dialog>;
}
