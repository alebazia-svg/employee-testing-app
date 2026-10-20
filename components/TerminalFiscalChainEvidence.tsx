import React from 'react';
import type { FiscalChainEvidence } from '@/lib/terminal-fiscal-chain-review';
const money = (amount: number) => `${(amount / 100).toLocaleString('ru-RU')} ₽`;
const time = (at: string) => new Intl.DateTimeFormat('ru-RU', {timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(at));
export function TerminalFiscalChainEvidence({chain}: {chain: FiscalChainEvidence}) {
  if (chain.alternatives !== 1) return <p className='mt-4 text-sm'>Найдено вариантов: {chain.alternatives}. Однозначная связь не установлена.</p>;
  return <section className='mt-4 rounded-lg border border-stone-200 bg-white/80 p-3' aria-label='Документы цепочки'>
    <h2 className='text-sm font-semibold'>Состав цепочки</h2>
    <div className='mt-2 overflow-x-auto'><table className='w-full text-left text-sm'>
      <thead><tr className='border-b border-stone-200 text-xs text-stone-500'><th className='py-2 font-medium'>Операция</th><th className='px-3 py-2 font-medium'>Время</th><th className='py-2 text-right font-medium'>Сумма</th></tr></thead>
      <tbody>{chain.payments.map((p,i)=><tr key={`payment-${i}`} className='border-b border-stone-100'><td className='py-2'>Оплата · терминал</td><td className='px-3 py-2 whitespace-nowrap'>{time(p.at)}</td><td className='py-2 text-right whitespace-nowrap'>{money(p.amountKopecks)}</td></tr>)}
      {chain.checks.map(c=><tr key={c.ref} className='border-b border-stone-100 last:border-0'><td className='py-2'><span>{c.refund?'Возврат':'Чек'} № {c.fiscalDocumentNumber}</span><span className='block text-xs text-stone-500'>{c.cashierName || 'Менеджер не определён'} · ОФД подтверждён</span></td><td className='px-3 py-2 whitespace-nowrap'>{time(c.at)}</td><td className='py-2 text-right whitespace-nowrap'>{money(c.refund?-c.amountKopecks:c.amountKopecks)}</td></tr>)}</tbody>
    </table></div>
    <p className='mt-2 text-xs text-stone-500'>Суммы согласуются. Связь документов требует проверки.</p>
  </section>;
}
