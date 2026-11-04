import React from 'react';
import Link from 'next/link';
import { managementTotals, type TaxManagementReview as Review } from '@/lib/tax-management-review';

const rub = (cents: number) => `${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const day = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)).replace(/ г\.$/, '');
const month = (value: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`${value}-01`));
const documentHref = (id: string) => `/api/admin/taxes/documents/${encodeURIComponent(id)}`;
const withTab = (base: string, tab: string) => `${base}${base.includes('?') ? '&' : '?'}tab=${tab}`;

export function TaxManagementOverview({ review, base }: { review: Review; base: string }) {
  const totals = managementTotals(review);
  return <section className='tax-panel' aria-label='Актуальная документальная сверка'>
    <div className='tax-panel-head'><div><h2>Что известно руководителю</h2><p>Документы по {day(review.cutoff)} · проверка {day(review.reviewedAt)}</p></div><span className='tax-status' data-tone={totals.fns > totals.limitCents ? 'error' : 'warn'}>{totals.fns > totals.limitCents ? 'По документам запас исчерпан' : 'Есть незакрытые вопросы'}</span></div>
    <div className='tax-body'>
      <p className='tax-small'>Для годового ограничения отдельно складываем доходы января–марта: УСН <b>{rub(review.q1UsnCents)}</b> и ПСН <b>{rub(review.q1PsnCents)}</b>. Это контроль лимита, а не повторный налог АУСН с патентной выручки.</p>
    </div>
    <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Источник</th><th className='num'>Доход с начала года</th><th className='num'>До 60 млн ₽</th></tr></thead><tbody>
      <tr><td><b>Выгрузки ФНС + УСН и ПСН</b><small>АУСН за апрель–октябрь: {rub(totals.fns - totals.baseline)}. Сам кабинет АУСН не показывает здесь сумму всех режимов.</small></td><td className='num'>{rub(totals.fns)}</td><td className='num'><b>{totals.fns > totals.limitCents ? `Превышение ${rub(totals.fns - totals.limitCents)}` : rub(totals.limitCents - totals.fns)}</b></td></tr>
      <tr><td><b>Сверка фактических оплат</b><small>Предварительный итог: банковские оплаты продаж и денежные части ККТ, без собственных переводов, с возвратами. Полная проверка совпадений не завершена.</small></td><td className='num'>{rub(totals.payments)}<small>Не окончательная налоговая база</small></td><td className='num'>{totals.payments > totals.limitCents ? `Превышение в модели ${rub(totals.payments - totals.limitCents)}` : `В модели ${rub(totals.limitCents - totals.payments)}`}<small>Для юридического вывода требуется сверка</small></td></tr>
      <tr><td><b>Учёт 1С</b><small>Проверяем связи оплат, реализаций и чеков. Ошибка учёта сама по себе не доказывает пропущенный доход ФНС.</small></td><td className='num'>Отдельный итог не подтверждён</td><td className='num'>Не использовать как запас</td></tr>
    </tbody></table></div>
    <div className='tax-body'>
      <div className='tax-callout' data-tone='warn'><strong>Месяц нарушения ещё требует окончательного подтверждения.</strong> По выгрузкам ФНС с добавлением I квартала первое пересечение — {day(review.fnsCrossing)}; в сверке оплат — {day(review.paymentsCrossing)}. Это разные источники, а не две даты на выбор. Передайте бухгалтеру обе сверки для определения даты утраты права.</div>
      <p className='tax-small tax-muted mt-3'>Ноябрь в эти суммы не входит. Подтверждение отправки уведомления и перехода на другой режим не приложено к этой сводке. Ставка 8% в прежнем отчёте ниже не подтверждает право продолжать АУСН.</p>
      <div className='flex flex-wrap gap-4 mt-3'><Link className='tax-link' href={withTab(base, 'income')}>Суммы по месяцам</Link><Link className='tax-link' href={withTab(base, 'reconciliation')}>Что осталось проверить</Link><Link className='tax-link' href={withTab(base, 'documents')}>Документы и расчёт</Link></div>
    </div>
  </section>;
}

export function TaxManagementIncome({ review }: { review: Review }) {
  const totals = managementTotals(review);
  return <section className='tax-panel' aria-label='Сопоставление дохода по источникам'>
    <div className='tax-panel-head'><div><h2>Доход для годового ограничения — по источникам</h2><p>Срез по {day(review.cutoff)}. Оплаты — предварительная сверка, ФНС — сохранённые выгрузки.</p></div></div>
    <div className='tax-body tax-small'>Январь–март: УСН {rub(review.q1UsnCents)} + ПСН {rub(review.q1PsnCents)} = <b>{rub(totals.baseline)}</b>. Эта сумма включена один раз в оба накопительных итога.</div>
    <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Месяц</th><th className='num'>АУСН по ФНС за месяц</th><th className='num'>Оплаты за месяц</th><th className='num'>ФНС + I квартал с начала года</th><th className='num'>Оплаты с начала года</th></tr></thead><tbody>{totals.months.map(row => <tr key={row.periodKey}><td className='capitalize'>{month(row.periodKey)}</td><td className='num'>{rub(row.fnsCents)}</td><td className='num'>{rub(row.paymentsCents)}</td><td className='num'>{rub(row.fnsYearCents)}{row.periodKey === review.fnsCrossing.slice(0, 7) && <small>Первый месяц выше 60 млн ₽ в этой сверке</small>}</td><td className='num'>{rub(row.paymentsYearCents)}{row.periodKey === review.paymentsCrossing.slice(0, 7) && <small>Первое пересечение в предварительной модели</small>}</td></tr>)}</tbody></table></div>
    <div className='tax-body tax-small tax-muted'>Возвраты включены в чистые суммы. Банковский эквайринг и соответствующие чеки нельзя складывать повторно; передача в кредит без оплаты не является денежным поступлением. Общий отчёт ниже использует прежнюю учётную модель и не заменяет эту сверку.</div>
  </section>;
}

export function TaxManagementReconciliation({ review }: { review: Review }) {
  const totals = managementTotals(review);
  return <>
    <section className='tax-panel' aria-label='Разница между источниками'>
      <div className='tax-panel-head'><div><h2>Из чего состоит разница {rub(totals.difference)}</h2><p>Между сверкой оплат и выгрузками ФНС с I кварталом. Это не установленная недоимка.</p></div></div>
      <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Составляющая</th><th className='num'>Разница</th><th>Что означает</th></tr></thead><tbody>{review.bridge.map(row => <tr key={row.title}><td className='font-semibold'>{row.title}</td><td className='num'>{rub(row.cents)}</td><td>{row.note}</td></tr>)}</tbody><tfoot><tr><td>Всего</td><td className='num'>{rub(totals.difference)}</td><td>Проверить признание каждой оплаты один раз</td></tr></tfoot></table></div>
    </section>
    <section className='tax-panel' aria-label='Выводы и незакрытые вопросы'>
      <div className='tax-panel-head'><div><h2>Что подтверждено и что нужно сделать</h2><p>Налоговое признание и внутренние ошибки учёта рассматриваются отдельно.</p></div></div>
      {review.findings.map(f => { const source = review.sources.find(s => s.originalName === f.sourceName); return <div className='tax-body border-b border-[#eee7df] last:border-0' key={f.title}><div className='flex flex-wrap gap-2 items-start justify-between'><h3 className='font-semibold text-[14px]'>{f.title}</h3><span className='tax-status' data-tone={f.status === 'verified' ? 'ok' : 'warn'}>{f.status === 'verified' ? 'Подтверждено в указанном объёме' : f.status === 'owner_reported' ? 'Со слов владельца' : 'Проверка не завершена'}</span></div><p className='tax-small mt-2'>{f.detail}</p><p className='tax-small mt-2'><b>Действие:</b> {f.action}</p>{source?.documentId && <a className='tax-link mt-2' href={documentHref(source.documentId)} target='_blank' rel='noreferrer'>{source.title}</a>}</div>; })}
    </section>
  </>;
}

export function TaxManagementDocuments({ review, preview = false }: { review: Review; preview?: boolean }) {
  return <section className='tax-panel' aria-label='Документы актуальной сверки'>
    <div className='tax-panel-head'><div><h2>Документы, на которых основаны выводы</h2><p>Срез по {day(review.cutoff)}. Архивы содержат первичные файлы и результаты сверки.</p></div></div>
    <div className='tax-body tax-small'><p>Документ «В архиве» сохранён для проверки и не означает, что его данные включены в общий расчёт. Полная история загрузок остаётся ниже.</p>{review.documentId && <a className='tax-link mt-2' href={`${documentHref(review.documentId)}?download=1`}>Скачать сводку и расчёт по месяцам</a>}</div>
    {review.sources.map(source => <div key={source.originalName} className='tax-body border-t border-[#eee7df]'><div className='flex flex-wrap justify-between gap-2'><h3 className='font-semibold text-[14px]'>{source.title}</h3>{source.documentId ? <a className='tax-link' href={documentHref(source.documentId)} target='_blank' rel='noreferrer'>Открыть документ</a> : <span className='tax-status' data-tone={preview ? 'muted' : 'warn'}>{preview ? 'Предпросмотр: ссылки выключены' : 'Не найден в архиве'}</span>}</div><p className='tax-small tax-muted mt-1'>{source.purpose}</p><p className='tax-small break-words mt-1'>{source.originalName}</p></div>)}
    <div className='tax-body border-t border-[#eee7df] tax-small'><b>Основание для годового ограничения:</b> п. 23 ч. 2 ст. 3 закона №17-ФЗ; <a className='tax-link' href='https://www.nalog.gov.ru/rn19/news/seminar/16606142/' target='_blank' rel='noreferrer'>ФНС о совокупном доходе</a>, <a className='tax-link' href='https://www.nalog.gov.ru/rn25/news/activities_fts/16622417/' target='_blank' rel='noreferrer'>ФНС о переходе в течение года</a>.</div>
  </section>;
}
