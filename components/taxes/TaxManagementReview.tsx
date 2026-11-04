import React from 'react';
import Link from 'next/link';
import { managementTotals, type TaxManagementReview as Review } from '@/lib/tax-management-review';

const rub = (cents: number) => `${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const day = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)).replace(/ г\.$/, '');
const month = (value: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`${value}-01`));
const documentHref = (id: string) => `/api/admin/taxes/documents/${encodeURIComponent(id)}`;
const withTab = (base: string, tab: string) => `${base}${base.includes('?') ? '&' : '?'}tab=${tab}`;

export function TaxManagementOverview({ review, base }: { review: Review; base: string }) {
  const t = managementTotals(review);
  return <section className='tax-panel tax-manager' aria-label='Актуальная документальная сверка'>
    <div className='tax-panel-head'><div><h2>{review.accountantConfirmation ? `Лимит превышен ${day(review.accountantConfirmation.exceededOn)}` : t.fns > t.limitCents ? 'По документам годовой лимит превышен' : 'Годовой лимит: требуется завершить сверку'}</h2><p>Данные по {day(review.cutoff)} · проверены {day(review.reviewedAt)}</p></div>{review.accountantConfirmation && <span className='tax-status' data-tone='ok'>Дата согласована с бухгалтером</span>}</div>
    <div className='tax-manager-sources'>
      <article className='tax-manager-source'><span className='tax-status' data-tone={t.fns > t.limitCents ? 'error' : 'muted'}>По сохранённым документам</span><h3>ФНС + УСН и патент</h3><strong>{rub(t.fns)}</strong><p>{t.fns > t.limitCents ? `Выше лимита на ${rub(t.fns - t.limitCents)}` : `Остаток ${rub(t.limitCents - t.fns)}`}</p><small>Доход с начала года по выгрузкам ФНС и книгам I квартала.</small></article>
      <article className='tax-manager-source'><span className='tax-status' data-tone='warn'>Проверка не завершена</span><h3>Фактические оплаты</h3><strong>{rub(t.payments)}</strong><p>Предварительная сверка банка и ККТ</p><small>Не окончательная налоговая база. Совпадения оплат ещё проверяются.</small></article>
      <article className='tax-manager-source'><span className='tax-status' data-tone='muted'>Учётная модель · для сравнения</span><h3>Учётный доход 1С + ККТ</h3><strong>{t.accounting === undefined ? '—' : rub(t.accounting)}</strong><p>С начала года, включая УСН и патент</p><small>Существующий отчёт по банковским документам 1С и ККТ. Возвраты и повторения этой модели требуют проверки.</small><Link className='tax-link mt-2' href={`${withTab(base, 'reconciliation')}#tax-accounting`}>Ошибки и документы 1С →</Link></article>
    </div>
    <div className='tax-manager-next'>
      <h3>Что делать сейчас</h3>{review.accountantConfirmation ? <p><b>Проверить статус уведомлений об утрате права и переходе.</b> Сохранить квитанции в «Документах».</p> : <p><b>С бухгалтером подтвердить месяц утраты права и дальнейший режим.</b> Затем сохранить подтверждение отправленного уведомления и перехода.</p>}
      <p className='tax-small tax-muted'>{review.accountantConfirmation ? <>Дата {day(review.accountantConfirmation.exceededOn)} уже согласована с бухгалтером. Предварительная сверка оплат разбирается отдельно.</> : <>Пересечение в сверке ФНС + I квартал — {day(review.fnsCrossing)}. В предварительной сверке оплат — {day(review.paymentsCrossing)}. Это разные источники, а не две даты на выбор.</>}</p>
      <Link className='tax-link' href={withTab(base, 'reconciliation')}>Открыть сверку и ошибки 1С →</Link>
    </div>
    <div className='tax-body tax-small tax-muted'>Операции после {day(review.cutoff)} в сводку не входят. Подтверждение перехода на другой режим к сводке не приложено.</div>
    <details className='tax-manager-method tax-details'><summary>Из чего сложился доход и где документы <span aria-hidden='true'>＋</span></summary><div className='tax-body tax-small'><p>АУСН по ФНС с апреля: <b>{rub(t.fns - t.baseline)}</b>. До перехода: УСН <b>{rub(review.q1UsnCents)}</b> + ПСН <b>{rub(review.q1PsnCents)}</b>. I квартал включён один раз для годового ограничения; повторного налога АУСН с патентной выручки здесь нет.</p>{review.accountantConfirmation && <p className='mt-2'>{review.accountantConfirmation.source}</p>}{review.accountingIncome && <p className='mt-2'>Учётная модель: {rub(review.accountingIncome.incomeCents)} с апреля по данным существующего отчёта 1С/банка и ККТ + {rub(t.baseline)} по книгам I квартала. Исходный отчёт не пересчитывался; это отдельное сравнение с тем же началом года.</p>}<p className='mt-2'>В сверке оплат исключены собственные переводы и учтены возвраты. Проверка повторного отражения через банк и ККТ ещё не завершена.</p><div className='tax-manager-links'><Link className='tax-link' href={withTab(base, 'income')}>По месяцам</Link><Link className='tax-link' href={withTab(base, 'documents')}>Подтверждающие документы</Link></div></div></details>
  </section>;
}

export function TaxManagementIncome({ review }: { review: Review }) {
  const totals = managementTotals(review);
  return <section className='tax-panel tax-manager-income' aria-label='Сопоставление дохода по источникам'>
    <div className='tax-panel-head'><div><h2>Доход для годового ограничения — по источникам</h2><p>Срез по {day(review.cutoff)}. Оплаты — предварительная сверка, ФНС — сохранённые выгрузки.</p></div></div>
    <div className='tax-body tax-small'>Январь–март: УСН {rub(review.q1UsnCents)} + ПСН {rub(review.q1PsnCents)} = <b>{rub(totals.baseline)}</b>. Эта сумма включена один раз в оба накопительных итога.</div>
    <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Месяц</th><th className='num'>АУСН по ФНС за месяц</th><th className='num'>Оплаты за месяц</th><th className='num'>ФНС + I квартал с начала года</th><th className='num'>Оплаты с начала года</th></tr></thead><tbody>{totals.months.map(row => <tr key={row.periodKey}><td className='capitalize'>{month(row.periodKey)}</td><td className='num' data-label='ФНС за месяц'>{rub(row.fnsCents)}</td><td className='num' data-label='Оплаты за месяц'>{rub(row.paymentsCents)}</td><td className='num' data-label='ФНС + I квартал с начала года'>{rub(row.fnsYearCents)}{row.periodKey === review.fnsCrossing.slice(0, 7) && <small>Первый месяц выше 60 млн ₽ в этой сверке</small>}</td><td className='num' data-label='Оплаты с начала года'>{rub(row.paymentsYearCents)}{row.periodKey === review.paymentsCrossing.slice(0, 7) && <small>Первое пересечение в предварительной модели</small>}</td></tr>)}</tbody></table></div>
    <div className='tax-body tax-small tax-muted'>Возвраты включены в чистые суммы. Банковский эквайринг и соответствующие чеки нельзя складывать повторно; передача в кредит без оплаты не является денежным поступлением. Общий отчёт ниже использует прежнюю учётную модель и не заменяет эту сверку.</div>
  </section>;
}

function Finding({ finding: f, review }: { finding: Review['findings'][number]; review: Review }) {
  const source = review.sources.find(s => s.originalName === f.sourceName);
  return <article className='tax-manager-finding'><div className='tax-manager-finding-head'><h3>{f.title}</h3><span className='tax-status' data-tone={f.status === 'verified' ? 'ok' : 'warn'}>{f.status === 'verified' ? 'Проверено в указанном объёме' : f.status === 'owner_reported' ? 'Объяснение владельца' : 'Открытый вопрос'}</span></div><p className='tax-small'><b>Следующий шаг:</b> {f.action}</p><details className='tax-details tax-manager-detail'><summary>Факты и подтверждение <span aria-hidden='true'>＋</span></summary><p className='tax-small'>{f.detail}</p>{source?.documentId && <a className='tax-link mt-2' href={documentHref(source.documentId)} target='_blank' rel='noreferrer'>{source.title}</a>}</details></article>;
}

export function TaxManagementReconciliation({ review }: { review: Review }) {
  const t = managementTotals(review);
  const open = review.findings.filter(f => f.status !== 'verified');
  const verified = review.findings.filter(f => f.status === 'verified');
  return <>
    <section className='tax-panel' aria-label='Приоритет проверки'><div className='tax-panel-head'><div><h2>{review.accountantConfirmation ? 'Дата превышения согласована с бухгалтером' : 'Первое решение — месяц утраты права'}</h2><p>Для бухгалтера и руководителя</p></div></div><div className='tax-body tax-small'>{review.accountantConfirmation ? <><p><b>{day(review.accountantConfirmation.exceededOn)}</b> — дата превышения по сверке ФНС + I квартал, согласованная с бухгалтером по подтверждению владельца.</p><p className='mt-2'>Следующий шаг — проверить статус уведомлений и сохранить квитанции. Предварительная платёжная модель и ошибки 1С показаны отдельно; по ним остаются вопросы.</p></> : <><p>Нужно установить месяц нарушения по первичным документам. Даты пересечения в сохранённых сверках: ФНС + I квартал — {day(review.fnsCrossing)}, предварительная сверка оплат — {day(review.paymentsCrossing)}.</p><p className='mt-2'>После определения даты — подтвердить дальнейший режим и сохранить квитанции уведомлений. Эта страница ничего не отправляет в ФНС.</p></>}</div></section>
    <section className='tax-panel' aria-label='Выводы и незакрытые вопросы'><div className='tax-panel-head'><div><h2>Вопросы, которые нужно закрыть</h2><p>Открытых вопросов: {open.length} · внутренние ошибки учёта отделены от налогового признания</p></div></div>{open.map(f => <Finding key={f.title} finding={f} review={review} />)}</section>
    <section className='tax-panel' aria-label='Разница между источниками'><div className='tax-panel-head'><div><h2>Разница между источниками: {rub(t.difference)}</h2><p>Это не установленная недоимка. Ниже — состав разницы.</p></div></div><div className='tax-manager-bridge'>{review.bridge.map(row => <details className='tax-details' key={row.title}><summary><b>{row.title}</b><span>{rub(row.cents)}</span><i aria-hidden='true'>＋</i></summary><p className='tax-small'>{row.note}</p></details>)}</div></section>
    {review.accounting && <TaxManagementAccounting review={review} />}
    <details className='tax-panel tax-details tax-manager-verified'><summary className='tax-panel-head'><div><h2>Что уже проверено</h2><p>Подтверждённых выводов: {verified.length} · с документами</p></div><span className='tax-link'>Открыть</span></summary>{verified.map(f => <Finding key={f.title} finding={f} review={review} />)}</details>
  </>;
}

export function TaxManagementAccounting({ review }: { review: Review }) {
  const a = review.accounting;
  if (!a) return null;
  const source = review.sources.find(s => s.originalName === a.sourceName);
  return <section id='tax-accounting' className='tax-panel tax-manager-accounting' aria-label='Документы и ошибки 1С'>
    <div className='tax-panel-head'><div><h2>1С: документы, оплаты и ошибки связей</h2><p>Проверенная выборка: {a.rows.length} проведённых реализаций · {day(a.checkedAt)}</p></div></div>
    <div className='tax-body tax-small'>Данные 1С показаны даже при ошибках. Ниже указано, что оформлено и какая связь не найдена. Банковские суммы сопоставляются с продажами; не все договорные связи подтверждены. Отсутствие связи в 1С не доказывает отсутствие чека в ОФД или дохода в ФНС.</div>
    {a.rows.map(r => <article className='tax-manager-finding' key={r.saleNumber}><div className='tax-manager-finding-head'><h3>Реализация {r.saleNumber} · {rub(r.saleCents)}</h3><span className='tax-status' data-tone='ok'>Проведена</span></div><p className='tax-small tax-muted'>Поступление для сопоставления: {rub(r.bankCents)} · Наличные по ПКО/чеку: {r.cashCents === null ? 'не подтверждены' : rub(r.cashCents)}</p><p className='tax-small mt-2'><b>Что найдено:</b> {r.finding}</p><details className='tax-details tax-manager-detail'><summary>Что исправить или проверить <span aria-hidden='true'>＋</span></summary><p className='tax-small'>{r.action}</p></details></article>)}
    {source?.documentId && <div className='tax-body'><a className='tax-link' href={documentHref(source.documentId)} target='_blank' rel='noreferrer'>Документы проверки 1С</a></div>}
  </section>;
}

export function TaxManagementDocuments({ review, preview = false }: { review: Review; preview?: boolean }) {
  return <section className='tax-panel' aria-label='Документы актуальной сверки'>
    <div className='tax-panel-head'><div><h2>Документы, на которых основаны выводы</h2><p>Срез по {day(review.cutoff)}. Архивы содержат первичные файлы и результаты сверки.</p></div></div>
    <div className='tax-body tax-small'><p><b>Что ещё сохранить:</b> квитанции уведомления об утрате права и перехода на другой режим после их отправки. Добавить их можно ниже через «Загрузить другой документ».</p><p className='mt-2'>Документ «В архиве» сохранён для проверки и не означает, что его данные включены в общий расчёт. Полная история загрузок остаётся ниже.</p>{review.documentId && <a className='tax-link mt-2' href={`${documentHref(review.documentId)}?download=1`}>Скачать сводку и расчёт по месяцам</a>}</div>
    {review.sources.map(source => <div key={source.originalName} className='tax-body border-t border-[#eee7df]'><div className='flex flex-wrap justify-between gap-2'><h3 className='font-semibold text-[14px]'>{source.title}</h3>{source.documentId ? <a className='tax-link' href={documentHref(source.documentId)} target='_blank' rel='noreferrer'>Открыть документ</a> : <span className='tax-status' data-tone={preview ? 'muted' : 'warn'}>{preview ? 'Предпросмотр: ссылки выключены' : 'Не найден в архиве'}</span>}</div><p className='tax-small tax-muted mt-1'>{source.purpose}</p><p className='tax-small break-words mt-1'>{source.originalName}</p></div>)}
    <div className='tax-body border-t border-[#eee7df] tax-small'><b>Основание для годового ограничения:</b> п. 23 ч. 2 ст. 3 закона №17-ФЗ; <a className='tax-link' href='https://www.nalog.gov.ru/rn19/news/seminar/16606142/' target='_blank' rel='noreferrer'>ФНС о совокупном доходе</a>, <a className='tax-link' href='https://www.nalog.gov.ru/rn25/news/activities_fts/16622417/' target='_blank' rel='noreferrer'>ФНС о переходе в течение года</a>.</div>
  </section>;
}
