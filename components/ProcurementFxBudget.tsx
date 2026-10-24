type Props = { method: string; foreignAmount: number; rubles: number; rate: number };
const number = (value: number) => value.toLocaleString('ru-RU', {maximumFractionDigits: 4});

/** Saved request budget, not a claim about the actual exchange/transfer. */
export function ProcurementFxBudget({method, foreignAmount, rubles, rate}: Props) {
  if (!['USDT', 'CNY'].includes(method) || !(foreignAmount > 0) || !Number.isFinite(rubles) || rubles <= 0) return null;
  return <p className="mt-1 text-sm text-slate-600">
    Ориентир: <span className="font-semibold tabular-nums">{rubles.toLocaleString('ru-RU', {maximumFractionDigits: 2})} ₽</span>
    {Number.isFinite(rate) && rate > 0 ? <span className="block text-xs">Курс заявки: {number(rate)} ₽ / {method}</span> : null}
  </p>;
}
