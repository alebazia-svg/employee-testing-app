import React from 'react';

type OrderOwner = {
  planCode: string;
  status: string;
  supplierPartner: string;
  orderRefs: string[];
  orderNumbers: string[];
};

export function ProcurementMissingOrderWarning({ refs, plans }: { refs: string[]; plans: OrderOwner[] }) {
  const items = refs.flatMap(ref => {
    const owners = plans.filter(plan => Array.isArray(plan.orderRefs) && plan.orderRefs.includes(ref));
    if (!owners.length) return [{ key: ref, label: ref }];

    return owners.filter(plan => plan.status !== 'CANCELLED').map(plan => {
      const number = plan.orderNumbers?.[plan.orderRefs.indexOf(ref)] || ref;
      return { key: ref + '/' + plan.planCode, label: `${plan.supplierPartner} · заказ ${number} · заявка ${plan.planCode}` };
    });
  });

  if (!items.length) return null;
  return <aside className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
    <strong>Заказ не найден в 1С</strong>
    <ul>{items.map(item => <li key={item.key}>{item.label}</li>)}</ul>
  </aside>;
}
