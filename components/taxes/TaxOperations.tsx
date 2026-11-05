import React from 'react';
import Link from 'next/link';
import type { PortalReport } from '@/lib/ausn-portal-view';
import type { TaxManagementReview } from '@/lib/tax-management-review';
import { taxManagerBrief, taxPaymentHistory } from '@/lib/tax-manager-brief';
import { TaxBriefCopy } from './TaxBriefCopy';

const rub = (value: number) => `${value.toLocaleString('ru-RU', {minimumFractionDigits:2, maximumFractionDigits:2})} ₽`;
const title = (period: string) => new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${period}-01`)).replace(/ г\.$/,'');
const href = (base:string,tab:string) => `${base}${base.includes('?')?'&':'?'}tab=${tab}`;

export function TaxOperations({ review, report, base }: {review:TaxManagementReview;report?:PortalReport;base:string}) {
  const rows = taxPaymentHistory(report);
  const latest = rows.find(row => row.assessed !== undefined);
  const open = review.findings.filter(f => f.status !== 'verified');
  return <div className='tax-operations'>
    <section className='tax-panel' aria-label='Налоги и платежи'>
      <div className='tax-panel-head'><div><h2>Налоги и платежи</h2><p>Начисления ФНС отделены от расчётной модели</p></div><span className='tax-status' data-tone='warn'>Сальдо ЕНС не сверено</span></div>
      <div className='tax-payment-summary'><span>Последнее начисление в загруженных данных</span><strong>{latest?.assessed !== undefined ? rub(latest.assessed) : 'Нет подтверждённых данных'}</strong><small>{latest ? `АУСН · ${title(latest.periodKey)}` : 'Нужны сведения о начислениях ФНС'}</small></div>
      <div className='tax-body tax-small'><b>Остаток к уплате и ближайший срок не подтверждены.</b> Сумма начисления выше — не требование оплатить её сейчас.</div>
      <details className='tax-command-proof'><summary>Начисления и найденные платежи по месяцам <span aria-hidden='true'>＋</span></summary>
        {rows.length ? <div className='tax-table-wrap tax-payment-table'><table className='tax-table'><thead><tr><th>Месяц</th><th className='num'>Начислено ФНС</th><th className='num'>Платёж ЕНП из банка</th></tr></thead><tbody>{rows.map(row=><tr key={row.periodKey}><td className='capitalize'>{title(row.periodKey)}</td><td className='num' data-label='Начислено ФНС'>{row.assessed === undefined ? 'Не загружено' : rub(row.assessed)}</td><td className='num' data-label='Платёж ЕНП из банка'>{row.bankPayment === undefined ? 'Не подтверждён' : rub(row.bankPayment)}</td></tr>)}</tbody></table></div> : <p className='tax-body tax-small'>Полный исходный отчёт недоступен. Отсутствующие суммы не заменены нулями.</p>}
        <p className='tax-body tax-small tax-muted'>Платёж ЕНП сам по себе не подтверждает погашение конкретного налога. После окончания АУСН обязательства нового режима необходимо проверить отдельно.</p>
      </details>
      <div className='tax-body'><Link className='tax-link' href={href(base,'documents')}>Документы для сверки ЕНС →</Link></div>
    </section>
    <section className='tax-panel' aria-label='Следующие действия'>
      <div className='tax-panel-head'><div><h2>Следующие действия</h2><p>Факты сохранены; открыты только незакрытые вопросы</p></div><span className='tax-status' data-tone='muted'>{open.length}</span></div>
      <div className='tax-task-list'>{open.map(f=><details className='tax-source-row' key={f.title}><summary><span><b>{f.title}</b><small>{f.status === 'owner_reported' ? 'Нужно документальное подтверждение' : 'Требуется действие'}</small></span><span aria-hidden='true'>＋</span></summary><div className='tax-source-detail'><p><b>Что сделать:</b> {f.action}</p><p>Ответственный и срок ещё не назначены.</p></div></details>)}</div>
      {!open.length && <p className='tax-body tax-small'>В этой документальной сводке нет открытых вопросов. Это не подтверждает полноту ещё не загруженных периодов.</p>}
      <div className='tax-body tax-operations-actions'><Link className='tax-link' href={href(base,'reconciliation')}>Открыть факты и документы →</Link><TaxBriefCopy text={taxManagerBrief(review)} /></div>
    </section>
  </div>;
}
