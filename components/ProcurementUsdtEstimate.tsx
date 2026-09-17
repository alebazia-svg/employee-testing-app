export function ProcurementUsdtEstimate({ amount, rate, conversionAt }: {amount: number; rate: number | null | undefined; conversionAt?: string}) {
  if (!rate || rate <= 0 || amount <= 0) return <p className="mt-1 text-xs text-slate-500">Ориентировочный курс пока недоступен.</p>;
  const date = conversionAt ? new Date(conversionAt) : null;
  const dateLabel = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('ru-RU', {day:'numeric',month:'long',timeZone:'Europe/Moscow'}) : '';
  return <div className="mt-1.5 text-xs text-slate-500"><p className="font-bold text-slate-700">Ориентировочно ≈ {(amount / rate).toLocaleString('ru-RU',{maximumFractionDigits:2})} USDT</p><p className="mt-1">По последнему курсу {rate.toLocaleString('ru-RU')} ₽{dateLabel ? ` от ${dateLabel}` : ''} в 1С. Фактическая сумма определится после обмена.</p></div>;
}
