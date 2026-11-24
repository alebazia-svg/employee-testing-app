import {receiptPaymentDate} from '@/lib/procurement-receipt-policy';

type Evidence = {
  state: string;
  issuedAmount: number;
  verification?: string;
  cashOrders?: {ref?: string; number: string; date?: string; amount?: number}[];
};
const rubles = new Intl.NumberFormat('ru-RU', {style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2});
const day = new Intl.DateTimeFormat('ru-RU', {day: 'numeric', month: 'long', timeZone: 'UTC'});

export function ProcurementPartialCashDetails({evidence, plannedAmount}: {evidence?: Evidence; plannedAmount?: number}) {
  if (evidence?.state !== 'PARTIALLY_ISSUED' || !evidence.cashOrders?.length) return null;
  return <section className="space-y-2 border-t border-slate-200 pt-3 text-sm">
    {plannedAmount !== undefined && <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
      <dt>Сумма заявки</dt><dd className="text-right tabular-nums">{rubles.format(plannedAmount)}</dd>
      <dt>Зачтено по 1С</dt><dd className="text-right tabular-nums">{rubles.format(evidence.issuedAmount)}</dd>
    </dl>}
    <ul className="space-y-1 text-slate-600">
      {evidence.cashOrders.map((order, index) => {
        const date = receiptPaymentDate(order.date || '');
        return <li key={order.ref || `${order.number}:${order.date}:${index}`} className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span>Расходник №{order.number || 'без номера'}{date ? ` · ${day.format(new Date(date + 'T12:00:00Z'))}` : ''}</span>
          {typeof order.amount === 'number' && <span className="whitespace-nowrap tabular-nums">{rubles.format(order.amount)}</span>}
        </li>;
      })}
    </ul>
    {evidence.verification === 'last-confirmed' && <p className="text-xs text-slate-500">По последней подтверждённой сверке</p>}
  </section>;
}
