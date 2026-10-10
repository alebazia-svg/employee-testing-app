import React from 'react';
import type { OrderReceiptSettlement } from '@/lib/procurement-planning-verification';
import type { OrderPaymentClosure } from '@/lib/procurement-order-payment-closure';

const money = (n: number) => n.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' ₽';
export function ProcurementReceiptEvidence({ evidence, paymentClosure, noAcquisitions, inline = false }: {
  evidence?: OrderReceiptSettlement;
  paymentClosure?: OrderPaymentClosure;
  noAcquisitions?: { checkedAt: string };
  inline?: boolean;
}) {
  const receipts = evidence?.receipts.length ? evidence.receipts : paymentClosure?.receipts;
  const checkedAt = evidence?.receipts.length ? evidence.checkedAt : paymentClosure?.checkedAt;
  if (!receipts?.length) return noAcquisitions ? <p className="mt-2 text-xs text-slate-500">Приобретений пока нет · предоплата</p> : null;
  const documents = <div className="mt-2 space-y-3">
      {receipts.map(receipt => {
        // Never turn amount minus balance into an invented cash payment.
        // Show payment documents only when linked by the existing strict proof.
        const proof = 'payments' in receipt ? receipt : receipt.ref ? paymentClosure?.receipts.find(r => r.ref === receipt.ref) : undefined;
        return <div key={receipt.ref || receipt.number} className="border-l-2 border-slate-200 pl-3">
          <p className="font-semibold">Приобретение №{receipt.number} · {money(receipt.amountRub)}</p>
          <p>Остаток: {money(receipt.remainingRub)}</p>
          {proof?.payments.length ? <p className="mt-2 font-medium">Связанные РКО</p> : null}
          {proof?.payments.map(payment => <p className="mt-1" key={`${payment.ref || payment.number}:${payment.method}`}>
            РКО №{payment.number} · {payment.date.split(' ')[0].split('T')[0]}<br />
            На это приобретение: {money(payment.appliedRub)}
          </p>)}
        </div>;
      })}
      {checkedAt?<p>1С · {new Date(checkedAt).toLocaleString('ru-RU', {timeZone:'Europe/Moscow',dateStyle:'short',timeStyle:'short'})}{paymentClosure?.recheckPending?' · обновление ожидается':''}</p>:null}
    </div>;
  return <div className="mt-2 text-xs font-normal text-slate-600">
    {documents ? inline ? documents : <details className="mt-1">
      <summary className="cursor-pointer underline">Приобретения по 1С</summary>
      {documents}
    </details> : null}
  </div>;
}
