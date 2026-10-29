'use client';

import { useMemo, useState } from 'react';
import { limitScenario } from '@/lib/ausn-limit-scenario';

const mln = (value: number) => `${(value / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 2 })} млн ₽`;
const day = (value?: string) => value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)) : '—';
const month = (key: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`));

// "What if" for the annual limit: the same pace convention as the forecast,
// recalculated on the device. It never changes a tax figure or a notification.
export function LimitScenario({ remaining, cutoff, year, average }: { remaining: number; cutoff: string; year: string; average: number }) {
  const [monthly, setMonthly] = useState(average);
  const base = useMemo(() => limitScenario({ remaining, cutoff, year, monthly: average }), [remaining, cutoff, year, average]);
  const scenario = useMemo(() => limitScenario({ remaining, cutoff, year, monthly }), [remaining, cutoff, year, monthly]);
  const max = Math.max(Math.ceil((average * 1.6) / 1_000_000) * 1_000_000, 2_000_000);
  const presets: Array<[string, number]> = [['−30%', average * 0.7], ['−15%', average * 0.85], ['как сейчас', average], ['+15%', average * 1.15]];
  if (base.safeMonthly !== undefined && base.safeMonthly < average) presets.push(['уложиться до 31 декабря', Math.floor(base.safeMonthly / 100_000) * 100_000]);
  return <div>
    <div className='flex flex-wrap gap-2'>{presets.map(([label, value]) => <button key={label} type='button' data-portal-secondary={Math.abs(monthly - value) > 1 ? 'true' : undefined} aria-pressed={Math.abs(monthly - value) <= 1} onClick={() => setMonthly(value)} className='rounded-lg border px-3 py-1.5 text-[13px] font-semibold'>{label}</button>)}</div>
    <label className='mt-4 block text-[13px] font-semibold'>Доход в месяц: <span className='text-[17px] font-bold tabular-nums'>{mln(monthly)}</span>
      <input type='range' min={0} max={max} step={100_000} value={Math.round(monthly)} onChange={(event) => setMonthly(Number(event.target.value))} className='mt-2 block w-full accent-[#996135]' aria-label='Ожидаемый доход в месяц' />
    </label>
    <div className='tax-callout mt-3' data-tone={scenario.withinYear ? 'warn' : 'ok'}><strong>{scenario.withinYear ? `Лимит закончится примерно ${day(scenario.date)}` : `До конца ${year} года лимит не закончится`}</strong></div>
    <div className='tax-table-wrap mt-3 rounded-[10px] border border-[#eee7df]'><table className='tax-table'><thead><tr><th>Месяц</th><th className='num'>Получим</th><th className='num'>Останется до лимита</th></tr></thead><tbody>{scenario.months.map((item) => <tr key={item.periodKey} data-tone={item.leftAfter < 0 ? 'error' : undefined}><td className='capitalize'>{month(item.periodKey)}{item.partial && <small>до конца месяца</small>}</td><td className='num'>{mln(item.income)}</td><td className='num'>{item.leftAfter < 0 ? <span className='font-semibold text-[#a3342d]'>превышение {mln(-item.leftAfter)}</span> : mln(item.leftAfter)}</td></tr>)}</tbody></table></div>
  </div>;
}
