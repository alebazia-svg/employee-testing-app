import React from 'react';

type Props = {
  showPlanned?:boolean;
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
export function ProcurementRequestRate({method, rate, evidence,showPlanned=true}: Props) {
  if (!['USDT', 'CNY'].includes(method)) return null;
  const planned = Number(rate);
  const actual = Number(evidence?.actualExchangeRate);
  const confirmed = method === 'USDT' && evidence?.verification === 'current'
    && ['PARTIALLY_PAID_BY_ONE_C', 'PAID_BY_ONE_C'].includes(evidence.state)
    && evidence.paidForeignAmount > 0 && !evidence.paymentAmountNeedsConfirmation
    && Number.isFinite(actual) && actual > 0;
  return <div className="payment-request-rate mt-1 text-sm leading-5 text-slate-600 tabular-nums">
    {showPlanned?<p>Курс заявки: <span className="whitespace-nowrap">{Number.isFinite(planned) && planned > 0 ? <>{format(planned)} ₽<span className="payment-request-rate-unit"> / {method}</span></> : 'не указан'}</span></p>:null}
    {confirmed ? <p>Курс оплаты: <span className="whitespace-nowrap">{format(actual)} ₽<span className="payment-request-rate-unit"> / {method}</span></span></p> : null}
  </div>;
}
