import Link from 'next/link';
import type { PortalReport } from '@/lib/ausn-portal-view';
import type { IncomeEvidenceReview } from '@/lib/tax-income-evidence';
import { taxLimitEvidence } from '@/lib/tax-limit-evidence';
const rub = (n: number) => `${(n / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const day = (s: string) => s.slice(0, 10).split('-').reverse().join('.');
const balance = (n: number) => n < 0 ? `Превышение ${rub(-n)}` : rub(n);
export function TaxLimitEvidencePanel({ report, review, reconciliationHref, legacy = false }: { report?: PortalReport; review?: IncomeEvidenceReview; reconciliationHref: string; legacy?: boolean }) {
  const v = taxLimitEvidence(report, review);
  return <section className='tax-panel tax-source-evidence' aria-label='ФНС, фактические оплаты и учёт 1С'>
    <div className='tax-panel-head'><div><h2>{legacy ? 'Прежняя сводка без ПСН — для сравнения' : 'Доход и остаток: три источника'}</h2><p>{legacy ? 'Сохранены прежние значения. Остаток ниже не учитывает ПСН; актуальная документальная сверка показана выше.' : 'Рабочий остаток определяется по фактическим оплатам. Разметка ФНС и ошибки 1С показаны отдельно.'}</p></div><span className='tax-status' data-tone='warn'>{legacy ? 'Не использовать для планирования' : 'Фактический остаток не подтверждён'}</span></div>
    <div className='tax-body'>
      <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Источник</th><th>Доход за год</th><th>Остаток до 60 млн ₽</th></tr></thead><tbody>
        <tr><td><b>ФНС</b><small>Что уже учла налоговая; это не подтверждение полноты дохода</small></td><td>{v ? rub(v.knownCents) : 'Нет проверенной выгрузки'}</td><td>{v ? balance(v.knownRemainingCents) : 'Не рассчитан'}</td></tr>
        <tr><td><b>Фактические оплаты — основной показатель</b><small>Банковские оплаты продаж и ККТ, за вычетом возвратов; каждая оплата один раз</small></td><td>Проверка не завершена</td><td><b>Не подтверждён</b></td></tr>
        <tr><td><b>Учёт 1С</b><small>Документы и ошибки учёта сверяются с банковскими оплатами и ККТ</small></td><td>Отдельный итог 1С не выделен</td><td>Не подтверждён</td></tr>
      </tbody></table></div>
      <p className='tax-small mt-3'><b>Для подтверждения фактического остатка:</b> нужны полные выписки всех расчётных счетов, проверка возвратов и совпадений банковских оплат с чеками. Существующий общий отчёт использует банковские документы из 1С и ККТ; он показан ниже отдельно и не заменяет проверку банковских выписок.</p>
      {v ? <>
        <p className='tax-small mt-3'>ФНС: данные по {day(v.snapshot.through)}, выгрузка от {day(v.snapshot.exportedAt)}. К базе АУСН добавлены {rub(v.baselineCents)} за январь–март до перехода. Это сохранённый срез, не остаток на текущую минуту.</p>
        <div className='tax-callout mt-3' data-tone='warn'><b>Дополнительный сценарий ВТБ, не фактический остаток.</b><p>Если все {v.count} ранее разобранных оплат на {rub(v.riskCents)} ещё не учтены через ККТ, остаток по данным ФНС составил бы {balance(v.cautiousRemainingCents)}. Сценарий охватывает только эти оплаты, а не все расхождения. Повторно добавлять уже учтённую оплату нельзя.</p></div>
      </> : <p className='tax-small mt-3'>Для остатка по ФНС нужны проверенная выгрузка с начала АУСН и подтверждённый доход до перехода за тот же год. Отсутствующие данные не заменяются нулём.</p>}
      <div className='tax-limit-evidence-links'><Link className='tax-link' href={reconciliationHref}>Сверка и ошибки учёта</Link>{v && <Link className='tax-link' href={`/api/admin/taxes/documents/${review!.documentId || v.snapshot.sourceDocumentId}`}>Источники расчёта ФНС</Link>}</div>
    </div>
  </section>;
}
