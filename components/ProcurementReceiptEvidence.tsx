import React from 'react';
import type { OrderReceiptSettlement } from '@/lib/procurement-planning-verification';
import type { OrderPaymentClosure } from '@/lib/procurement-order-payment-closure';

const money = (n: number) => n.toLocaleString('ru-RU', {minimumFractionDigits: 2, maximumFractionDigits: 2}) + ' ₽';
export function ProcurementReceiptEvidence({ evidence, paymentClosure }: { evidence?: OrderReceiptSettlement; paymentClosure?: OrderPaymentClosure }) {
  if (!evidence) return null;
  return <details className="mt-2 text-xs font-normal text-slate-600">
    <summary className="cursor-pointer underline">Приобретения и оплаты</summary>
    <div className="mt-2 space-y-3">
      {evidence.receipts.map(receipt => {
        // Never turn amount minus balance into an invented cash payment.
        // Show payment documents only when linked by the existing strict proof.
        const proof = paymentClosure?.receipts.find(r => r.ref === receipt.ref);
        return <div key={receipt.ref}>
          <p className="font-semibold">Приобретение №{receipt.number} · {money(receipt.amountRub)}</p>
          <p>{receipt.remainingRub === 0 ? 'По этому приобретению долга в 1С нет.' : `Остаток в 1С: ${money(receipt.remainingRub)}.`}</p>
          {proof?.payments.map(payment => <p key={`${payment.ref || payment.number}:${payment.method}`}>
            Оплата по РКО №{payment.number} от {payment.date.split(' ')[0].split('T')[0]} · на это приобретение {money(payment.appliedRub)}
          </p>)}
        </div>;
      })}
      {evidence.receipts.some(receipt => receipt.remainingRub < receipt.amountRub
        && !paymentClosure?.receipts.some(r => r.ref === receipt.ref && r.payments.length))
        ? <p>Остатки взяты из 1С. Полный список связанных оплат пока не подтверждён.</p> : null}
      <p>Данные 1С на {new Date(evidence.checkedAt).toLocaleString('ru-RU', {timeZone:'Europe/Moscow'})}.</p>
    </div>
  </details>;
}

export function ProcurementPaymentGuidance({ evidence, noAcquisitions }: { evidence?: OrderReceiptSettlement; noAcquisitions?: { checkedAt: string } }) {
  return <p className="text-xs text-amber-800">
    {noAcquisitions
      ? 'Приобретений по заказу пока нет. Планируйте предоплату, только если договорились о ней с поставщиком.'
      : evidence?.debtRub === 0
      ? 'По этим приобретениям долга в 1С нет.'
      : evidence?.requiresAdvanceReview
        ? 'Сумма новой оплаты требует сверки. Остаток по приобретениям — не готовая сумма платежа.'
        : 'Не удалось подтвердить остаток по заказу. Сумма новой оплаты требует сверки.'}
  </p>;
}
