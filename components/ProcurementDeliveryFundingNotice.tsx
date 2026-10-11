import React from 'react';
export function ProcurementDeliveryFundingNotice({ beforeCreate = false }: { beforeCreate?: boolean }) {
  return <p className="border-l-2 border-amber-300 pl-3 text-xs leading-relaxed text-amber-900">{beforeCreate
    ? 'Перед созданием уточните источники денег в остальных неуточнённых заявках 1С и повторите проверку. Статус «К оплате» разрешит сотруднику оформить расходник; свободный остаток пока не подтверждён.'
    : 'Проверить заявку можно — деньги не списываются. Перед созданием уточните источники денег в остальных неуточнённых заявках 1С: свободный остаток пока не подтверждён.'}</p>;
}
