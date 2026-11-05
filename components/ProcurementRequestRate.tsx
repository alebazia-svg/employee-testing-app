import React from 'react';

type Props = {
  method: string;
  rate: string | number | null;
  evidence?: {
    verification?: string;
    state: string;
    actualExchangeRate: number | null;
    paidForeignAmount: number;
    paymentAmountNeedsConfirmation?: boolean;
  };
};
const format = (value: number) => value.toLocaleString('ru-RU', {maximumFractionDigits: 4});

/** Saved request rate and independently confirmed payment rate are different facts. */
export function ProcurementRequestRate({method, rate, evidence}: Props) {
  if (!['USDT', 'CNY'].includes(method)) return null;
  const planned = Number(rate);
  const actual = Number(evidence?.actualExchangeRate);
  const confirmed = method === 'USDT' && evidence?.verification === 'current'
    && ['PARTIALLY_PAID_BY_ONE_C', 'PAID_BY_ONE_C'].includes(evidence.state)
    && evidence.paidForeignAmount > 0 && !evidence.paymentAmountNeedsConfirmation
    && Number.isFinite(actual) && actual > 0;
  return <div className="mt-1 text-sm leading-5 text-slate-600 tabular-nums">
    <p>Курс заявки: <span className="whitespace-nowrap">{Number.isFinite(planned) && planned > 0 ? `${format(planned)} ₽ / ${method}` : 'не указан'}</span></p>
    {confirmed ? <p>Курс оплаты: <span className="whitespace-nowrap">{format(actual)} ₽ / {method}</span></p> : null}
  </div>;
}
