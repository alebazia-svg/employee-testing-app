import React from 'react';

type CancelledPlan = {
  id: string;
  status: string;
  supplierPartner: string;
  planCode?: string;
  orderNumbers?: string[];
  updatedAt?: string;
  events?: {action: string; createdAt: string; snapshot: unknown}[];
};

export function ProcurementCancelledHistory({plans, query = ''}: {plans: CancelledPlan[]; query?: string}) {
  const search = query.trim().toLocaleLowerCase('ru');
  const rows = plans.filter(plan => plan.status === 'CANCELLED').map(plan => {
    const numbers = Array.isArray(plan.orderNumbers) ? plan.orderNumbers.filter(Boolean) : [];
    const event = plan.events?.find(event => event.action === 'CANCELLED');
    return {plan, numbers, event};
  }).filter(({plan, numbers}) =>
    [plan.supplierPartner, plan.planCode, ...numbers].join(' ').toLocaleLowerCase('ru').includes(search)
  ).sort((a, b) => (b.event?.createdAt || '').localeCompare(a.event?.createdAt || ''));

  if (!rows.length) return null;
  return <details className="mt-3 rounded-xl border p-3">
    <summary className="cursor-pointer text-sm font-semibold">Отменённые заявки · {rows.length}</summary>
    <ul className="mt-2 divide-y">{rows.map(({plan, numbers, event}) => {
      const actor = (event?.snapshot as {actorName?: string} | null)?.actorName;
      const date = event?.createdAt || plan.updatedAt;
      return <li key={plan.id} className="py-2 text-sm">
        <strong>{plan.supplierPartner}</strong> · {plan.planCode}
        {numbers.length > 0 && <div>{numbers.length === 1 ? 'Заказ № ' : 'Заказы № '}{numbers.join(', ')}</div>}
        <div className="text-slate-600">
          {[date && new Date(date).toLocaleString('ru-RU', {timeZone:'Europe/Moscow'}), actor].filter(Boolean).join(' · ')}
        </div>
      </li>;
    })}</ul>
  </details>;
}
