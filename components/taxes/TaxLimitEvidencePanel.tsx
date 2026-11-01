import Link from 'next/link';
import type { PortalReport } from '@/lib/ausn-portal-view';
import type { IncomeEvidenceReview } from '@/lib/tax-income-evidence';
import { taxLimitEvidence } from '@/lib/tax-limit-evidence';
const rub = (n: number) => `${(n / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const day = (s: string) => s.slice(0, 10).split('-').reverse().join('.');
const balance = (n: number) => n < 0 ? `Превышение ${rub(-n)}` : rub(n);
export function TaxLimitEvidencePanel({ report, review, reconciliationHref }: { report?: PortalReport; review?: IncomeEvidenceReview; reconciliationHref: string }) {
  const v = taxLimitEvidence(report, review);
  return <section className='tax-panel' aria-label='Лимит по данным ФНС и спорным доходам'>
    <div className='tax-panel-head'><div><h2>ФНС и запас до лимита</h2><p>Доход под риском неучёта показан отдельно от подтверждённых данных.</p></div></div>
    <div className='tax-body'>
      {!v ? <p className='tax-small'>Для двух сценариев нужны проверенная выгрузка ФНС с начала АУСН и доход до перехода за тот же год. Остаток по неполным источникам не рассчитывается.</p> : <>
        <p className='tax-small'>Данные ФНС по {day(v.snapshot.through)} · выгрузка от {day(v.snapshot.exportedAt)}. В обоих вариантах учтены {rub(v.baselineCents)} за январь–март до перехода на АУСН.</p>
        <div className='tax-table-wrap mt-3'><table className='tax-table'><thead><tr><th>Вариант</th><th>Доход за год</th><th>Запас до 60 млн ₽</th></tr></thead><tbody>
          <tr><td><b>По данным ФНС</b><small>База АУСН из выгрузки + доход до перехода</small></td><td>{rub(v.knownCents)}</td><td><b>{balance(v.knownRemainingCents)}</b></td></tr>
          <tr><td><b>Если добавить спорные поступления ВТБ</b><small>Сценарий: все {v.count} оплат ещё не учтены через ККТ</small></td><td>{rub(v.cautiousCents)}</td><td><b>{balance(v.cautiousRemainingCents)}</b></td></tr>
        </tbody></table></div>
        <p className='tax-small mt-3'><b>Доход под риском неучёта: {rub(v.riskCents)}.</b> ВТБ передал банковские строки как «Эквайринг / Неналоговая база». Чеки оплаты этих сумм не установлены. Это не подтверждённая недоимка.</p>
        {v.planningRemainingCents !== undefined && <p className='tax-small mt-3'><b>Для планирования: {balance(v.planningRemainingCents)}.</b> Берём меньший запас из действующего расчёта по банку и ККТ выше и сценария ВТБ.</p>}
        <p className='tax-small mt-2'> Это сценарий только по разобранным поступлениям ВТБ: он не охватывает все расхождения и не подтверждает полный доход года. Если сумма уже учтена через ККТ, прибавлять её повторно нельзя. Сам доход от продажи входит в лимит независимо от разметки банка.</p>
        <div className='tax-limit-evidence-links'><Link className='tax-link' href={reconciliationHref}>Разбор поступлений</Link><Link className='tax-link' href={`/api/admin/taxes/documents/${review!.documentId || v.snapshot.sourceDocumentId}`}>Расчёт и документы</Link></div>
      </>}
    </div>
  </section>;
}
