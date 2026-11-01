import Link from 'next/link';
import { incomeRecognition, type IncomeEvidenceReview } from '@/lib/tax-income-evidence';
const money = (n: number | null) => n === null ? 'Не подтверждено' : `${(n / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2 })} ₽`;
const labels = { accounted: 'Учтён ФНС', omitted: 'Не учтён ФНС', duplicate: 'Возможное задвоение', unconfirmed: 'Учёт дохода не подтверждён' };
export function IncomeEvidencePanel({ review }: { review?: IncomeEvidenceReview }) {
  const counts = review?.cases.reduce((r, c) => { r[incomeRecognition(c)]++; return r; }, { accounted: 0, omitted: 0, duplicate: 0, unconfirmed: 0 });
  return <section className='tax-panel tax-income-evidence' aria-label='Налоговый учёт и внутренние ошибки'>
    <div className='tax-panel-head'><div><h2>Что ФНС учла в базе</h2><p>Банк и ККТ проверяются как источники одной оплаты. Ошибки оформления показаны отдельно.</p></div></div>
    <div className='tax-income-evidence-body'>
    <p className='tax-small'>Поступления на счёт и чеки одной оплаты не складываются повторно. «Неналоговая база» у банковской строки не означает, что доход исключён: он может быть учтён через ККТ. Отсутствие документа в 1С само по себе не доказывает недоимку.</p>
    {review && counts ? <>
      <p className='tax-small mt-2'>{review.title}</p>
      <p className='tax-small mt-2'>Разбор документов от {review.reviewedAt.slice(0, 10).split('-').reverse().join('.')}: учтено — {counts.accounted}; не учтено — {counts.omitted}; возможное задвоение — {counts.duplicate}; требует подтверждения — {counts.unconfirmed}. Это выводы по разобранным случаям, не полнота сверки всех доходов.</p>
      <details className='tax-details mt-2'><summary className='tax-link'>Показать случаи и доказательства ({review.cases.length})</summary>
        <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Оплата</th><th>База ФНС: банк</th><th>База ФНС: ККТ</th><th>Итог и влияние на налог</th></tr></thead><tbody>{review.cases.map(c => { const status = incomeRecognition(c); return <tr key={c.id}>
          <td>{c.date.split('-').reverse().join('.')} · {c.bank}<br/><b>{money(c.amountCents)}</b></td><td>{money(c.bankBaseCents)}</td><td>{money(c.fiscalBaseCents)}</td>
          <td><b className='tax-income-status' data-recognition={status}>{labels[status]}</b><small>{status === 'accounted' ? 'По проверенной оплате расхождение базы не выявлено.' : status === 'omitted' ? 'Отсутствие в базе подтверждено; требуется адресное исправление.' : status === 'duplicate' ? 'Нужно исключить повторный учёт одной оплаты.' : 'Влияние на налог пока не установлено; это не подтверждённая недоимка.'}</small><p className='tax-small'>{c.finding}</p>{c.sourceDocumentIds.map(id => <Link className='tax-link mr-3' key={id} href={`/api/admin/taxes/documents/${id}`}>Документ</Link>)}</td>
        </tr>; })}</tbody></table></div>
      </details>
      <details className='tax-details mt-3'><summary className='tax-link'>Внутренние ошибки и замечания</summary><p className='tax-small mt-2'>Замечание к 1С или оформлению чека не меняет базу автоматически. Его влияние определяется подтверждением ФНС в таблице выше.</p>{review.cases.filter(c => c.internalNotes.length).map(c => <div className='tax-item' key={c.id}><b>{c.date.split('-').reverse().join('.')} · {money(c.amountCents)}</b>{c.internalNotes.map((n, i) => <p className='tax-small' key={i}>{n}</p>)}</div>)}{!review.cases.some(c => c.internalNotes.length) && <p className='tax-small'>В этом разборе подтверждённые внутренние ошибки отдельно не установлены.</p>}</details>
      {review.documentId && <Link className='tax-link mt-3' href={`/api/admin/taxes/documents/${review.documentId}`}>Полный разбор и источники</Link>}
    </> : <p className='tax-small mt-2'>Пооперационное подтверждение ФНС ещё не загружено. Совпадение месячных сумм или отсутствие замечаний не подтверждает учёт каждой оплаты.</p>}
    <details className='tax-details mt-3'><summary className='tax-link'>ВТБ, 115-ФЗ и лимит АУСН — правовые основания</summary><div className='tax-small mt-2'>
      <p>Ограничение операций по 115-ФЗ не является основанием исключить выручку из дохода. Причину и дату ограничения устанавливают по уведомлению банка; связь с неналоговой разметкой без документа не подтверждена.</p>
      <p className='mt-2'>Деньги банка за товар, купленный покупателем в кредит, являются оплатой продажи, а не кредитом, полученным самим продавцом. Доход от продажи учитывается в лимите один раз. Нельзя повторно прибавлять его к уже учтённой сумме; спорные операции не исключаются из контроля лимита только из-за разметки банка.</p>
      <p className='mt-2'>Ошибочную банковскую разметку прошлых периодов исправляют через передавший сведения уполномоченный банк: ч. 5 ст. 15 № 17-ФЗ. Перерасчёт ФНС — не более 36 предшествующих налоговых периодов: ч. 9 ст. 12. Фактическое ограничение доступа к ВТБ не равно прекращению деятельности банка.</p>
      <ul className='mt-2'><li><a className='tax-link' href='https://www.consultant.ru/document/cons_doc_LAW_410240/93715427f8c023d79064a39f156911310ad3faaa/'>№ 17-ФЗ, ст. 6: состав доходов</a></li><li><a className='tax-link' href='https://www.consultant.ru/document/cons_doc_LAW_410240/14633248c2c8cfc1af165506357416836ee1add4/'>Ст. 7: даты признания, включая ККТ</a></li><li><a className='tax-link' href='https://www.consultant.ru/document/cons_doc_LAW_410240/c27893d3683f66ba8bc5788c7372c424744f083f/'>Ст. 3 ч. 2 п. 23: лимит 60 млн ₽</a></li><li><a className='tax-link' href='https://www.consultant.ru/document/cons_doc_LAW_410240/d66bb7a4364eb5322f721c3ef882dfef9d5d12de/'>Ст. 15: передача и исправление банковских сведений</a></li><li><a className='tax-link' href='https://www.consultant.ru/document/cons_doc_LAW_410240/36ef4793b289257f504d38eafa7ce531e84fe9d2/'>Ст. 12: расчёт и перерасчёт налога</a></li><li><a className='tax-link' href='https://www.nalog.gov.ru/html/sites/www.rn62.nalog.ru/obschee/2026/meth_ausn.pdf'>ФНС: методические рекомендации, раздел 4.4 «Эквайринг»</a></li><li><a className='tax-link' href='https://www.cbr.ru/protection_rights/recomendation/'>Банк России: ограничения операций по счёту</a></li></ul>
    </div></details>
    <p className='tax-small mt-3'>Этот разбор не пересчитывает общий отчёт, не исправляет ФНС и не изменяет Telegram.</p>
    </div>
  </section>;
}
