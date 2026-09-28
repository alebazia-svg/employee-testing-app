import React from 'react';

/** Personal accountable cash, never the QR cashbox or a supplier reserve. */
export type DeliveryCashSnapshot = {
  balance: number | null;
  checkedAt: string;
  lastIssue: { amount: number; date: string } | null;
  reserveAdvice?: { target: number; warnAt: number };
};

const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 2, minimumFractionDigits: 0 });
const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Europe/Moscow' });
const updated = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' });
const validDate = (value: string) => Boolean(value) && Number.isFinite(Date.parse(value));

export function deliveryReserveWarning(snapshot: DeliveryCashSnapshot, now = Date.now()) {
  const advice = snapshot.reserveAdvice;
  const age = now - Date.parse(snapshot.checkedAt);
  // Never derive an actionable warning from missing/stale data or a malformed policy.
  if (!advice || !Number.isFinite(advice.target) || !Number.isFinite(advice.warnAt)
    || advice.warnAt <= 0 || advice.target <= advice.warnAt
    || snapshot.balance === null || !Number.isFinite(snapshot.balance)
    || !Number.isFinite(age) || age < -300_000 || age > 86_400_000) return false;
  return snapshot.balance <= advice.warnAt;
}

export function ProcurementDeliveryCash({ snapshot, children, reserveDetails = true, showLastIssue = true }: { snapshot: DeliveryCashSnapshot; children?: React.ReactNode; reserveDetails?: boolean; showLastIssue?: boolean }) {
  const available = snapshot.balance !== null && Number.isFinite(snapshot.balance) && validDate(snapshot.checkedAt);
  const overrun = available && snapshot.balance! < 0;
  const issue = snapshot.lastIssue;
  const needsRefill = deliveryReserveWarning(snapshot);
  return <section id="delivery" aria-label="Подотчёт на доставку" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
    <h2 className="text-lg font-black text-slate-900">Подотчёт на доставку</h2>
    <p className="mt-3 text-xs font-semibold text-slate-500">{overrun ? 'Перерасход по 1С' : 'Остаток подотчёта'}</p>
    <p className={`mt-1 text-2xl font-black tabular-nums ${overrun ? 'text-amber-800' : 'text-slate-950'}`}>
      {available ? money.format(Math.abs(snapshot.balance!)) : '—'}
    </p>
    {needsRefill ? <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950 ring-1 ring-amber-200">
      <p className="text-sm font-bold">Низкий остаток</p>
      {reserveDetails ? <><p className="mt-1 text-xs leading-5">Рекомендуемый запас: {money.format(snapshot.reserveAdvice!.target)}.</p>
      <p className="mt-1 text-xs leading-5">Выдача из кассы — только по согласованной заявке.</p></> : null}
    </div> : null}
    {children}
    {showLastIssue && available && issue && Number.isFinite(issue.amount) && issue.amount > 0 && validDate(issue.date) ?
      <p className="mt-3 text-sm text-slate-600">Выдано {date.format(new Date(issue.date))}: <span className="font-bold text-slate-800">{money.format(issue.amount)}</span></p> : null}
    <p className="mt-3 text-xs text-slate-500">{available ? `Данные на ${updated.format(new Date(snapshot.checkedAt))}` : 'Остаток из 1С недоступен'}</p>
  </section>;
}
