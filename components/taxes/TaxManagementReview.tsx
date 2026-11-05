import React from 'react';
import Link from 'next/link';
import type { PortalReport } from '@/lib/ausn-portal-view';
import { accountingSnapshot, managementTotals, type TaxManagementReview as Review } from '@/lib/tax-management-review';

const rub = (cents: number) => `${(cents / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
const day = (value: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(value)).replace(/ г\.$/, '');
const month = (value: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`${value}-01`));
const documentHref = (id: string) => `/api/admin/taxes/documents/${encodeURIComponent(id)}`;
const withTab = (base: string, tab: string) => `${base}${base.includes('?') ? '&' : '?'}tab=${tab}`;

export function TaxManagementOverview({ review, base, accountingReport, previousReport }: { review: Review; base: string; accountingReport?: PortalReport; previousReport?: PortalReport }) {
  const t = managementTotals(review);
  const accounting = accountingSnapshot(review, accountingReport);
  const previous = accountingSnapshot(review, previousReport);
  const change = accounting && previous && previousReport?.available && previous.sourceName === previousReport.sourceFile ? accounting.cents - previous.cents : undefined;
  return <section className='tax-panel tax-manager' aria-label='Актуальная документальная сверка'>
    <div className='tax-panel-head'><div><h2>{review.accountantConfirmation ? `Лимит превышен ${day(review.accountantConfirmation.exceededOn)}` : t.fns > t.limitCents ? 'По документам годовой лимит превышен' : 'Годовой лимит: требуется завершить сверку'}</h2><p>Сверка ФНС и оплат по {day(review.cutoff)}</p></div>{review.accountantConfirmation && <span className='tax-status' data-tone='ok'>Дата согласована с бухгалтером</span>}</div>
    <div className='tax-body tax-small tax-manager-freshness'><b>Учётный отчёт:</b> {accounting ? <>по {day(accounting.through)}{accounting.runTimeUtc && <> · пересчитан {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(accounting.runTimeUtc))} МСК</>}</> : 'свежий отчёт не подтверждён'}.{change !== undefined && previous && <p>Изменение учётной модели с {day(previous.through)}: <b>{change > 0 ? '+' : ''}{rub(change)}</b>. Это изменение отчёта, включая возможные уточнения, а не подтверждённый новый доход.</p>}<p>Учётный отчёт обновляется автоматически; документальная сверка ФНС обновляется новой выгрузкой. Проверка источников и полнота налоговой базы — разные статусы.</p></div>
    <div className='tax-body tax-small'><b>До перехода на АУСН, январь–март:</b> УСН {rub(review.q1UsnCents)} + ПСН {rub(review.q1PsnCents)} = <b>{rub(t.baseline)}</b>. В годовой итог включены один раз.</div>
    <div className='tax-manager-sources'>
      <article className='tax-manager-source'><span className='tax-status' data-tone={t.fns > t.limitCents ? 'error' : 'muted'}>По сохранённым документам</span><h3>ФНС + УСН и патент</h3><strong>{rub(t.fns)}</strong><p>{t.fns > t.limitCents ? `Выше лимита на ${rub(t.fns - t.limitCents)}` : `Остаток ${rub(t.limitCents - t.fns)}`}</p><small>Срез по {day(review.cutoff)} · выгрузки ФНС + книги УСН и ПСН. Это документальное основание даты превышения; полнота всех доходов проверяется отдельно.</small></article>
      <article className='tax-manager-source'><span className='tax-status' data-tone='warn'>Проверка не завершена</span><h3>Предварительная сверка оплат</h3><strong>{rub(t.payments)}</strong><p>Предварительная сверка банка и ККТ</p><small>Срез по {day(review.cutoff)}. Не окончательная налоговая база. Совпадения оплат ещё проверяются.</small></article>
      <article className='tax-manager-source'><span className='tax-status' data-tone='muted'>Учётная модель · для сравнения</span><h3>Учётный доход 1С + ККТ</h3><strong>{accounting ? rub(accounting.cents) : '—'}</strong><p>{accounting ? `По ${day(accounting.through)}, включая УСН и патент` : 'С начала года, включая УСН и патент'}</p><small>Существующий отчёт по банковским документам 1С и ККТ. Возвраты и повторения этой модели требуют проверки.</small><Link className='tax-link mt-2' href={`${withTab(base, 'reconciliation')}#tax-accounting`}>Ошибки и документы 1С →</Link></article>
    </div>
    {review.regimeStatus ? <TaxRegimeStatus review={review} base={base} /> : <div className='tax-manager-next'>
      <h3>Ближайшее действие</h3><p><b>Проверить с бухгалтером статус уведомлений и сохранить квитанции.</b> Статус отправки и принятия в портале пока не подтверждён. Отсутствие квитанции в портале не означает, что заявление не отправлено.</p>{!review.accountantConfirmation && <p className='tax-small'>Пересечение в сверке ФНС + I квартал — {day(review.fnsCrossing)}. В предварительной сверке оплат — {day(review.paymentsCrossing)}. Это разные источники, а не две даты на выбор.</p>}
      <Link className='tax-link' href={withTab(base, 'documents')}>Открыть документы →</Link>
    </div>}
    <div className='tax-body tax-small tax-muted'><b>Как читать суммы:</b> это три источника, их нельзя складывать. ФНС и сверка оплат — срез по {day(review.cutoff)}; более поздние операции в эти две суммы не включены.{accounting && <> Учётный отчёт — по {day(accounting.through)}{accounting.runTimeUtc && <>, обновлён {new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(accounting.runTimeUtc))} МСК</>}.</>} Принятие УСН «Доходы» проверяется отдельно от снятия с АУСН.</div>
    <details className='tax-manager-method tax-details'><summary>Из чего сложился доход и где документы <span aria-hidden='true'>＋</span></summary><div className='tax-body tax-small'><p>АУСН по ФНС с апреля: <b>{rub(t.fns - t.baseline)}</b>. До перехода: УСН <b>{rub(review.q1UsnCents)}</b> + ПСН <b>{rub(review.q1PsnCents)}</b>. I квартал включён один раз для годового ограничения; повторного налога АУСН с патентной выручки здесь нет.</p>{review.accountantConfirmation && <p className='mt-2'>{review.accountantConfirmation.source}</p>}{accounting && <p className='mt-2'>Учётная модель: {rub(accounting.incomeCents)} с апреля по данным существующего отчёта 1С/банка и ККТ + {rub(t.baseline)} по книгам I квартала. Исходный отчёт не пересчитывался; это отдельное сравнение с тем же началом года.</p>}<p className='mt-2'>В сверке оплат исключены собственные переводы и учтены возвраты. Проверка повторного отражения через банк и ККТ ещё не завершена.</p><div className='tax-manager-links'><Link className='tax-link' href={withTab(base, 'income')}>По месяцам</Link><Link className='tax-link' href={withTab(base, 'documents')}>Подтверждающие документы</Link></div></div></details>
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
    {review.regimeStatus && <TaxRegimeStatus review={review} />}
    <section className='tax-panel' aria-label='Приоритет проверки'><div className='tax-panel-head'><div><h2>{review.accountantConfirmation ? 'Дата превышения согласована с бухгалтером' : 'Первое решение — месяц утраты права'}</h2><p>Для бухгалтера и руководителя</p></div></div><div className='tax-body tax-small'>{review.accountantConfirmation ? <><p><b>{day(review.accountantConfirmation.exceededOn)}</b> — дата превышения по сверке ФНС + I квартал, согласованная с бухгалтером по подтверждению владельца.</p><p className='mt-2'>Следующий шаг — получить отдельное подтверждение УСН «Доходы». Снятие с АУСН отражено отдельно по документам ФНС. Предварительная платёжная модель и ошибки 1С показаны отдельно; по ним остаются вопросы.</p></> : <><p>Нужно установить месяц нарушения по первичным документам. Даты пересечения в сохранённых сверках: ФНС + I квартал — {day(review.fnsCrossing)}, предварительная сверка оплат — {day(review.paymentsCrossing)}.</p><p className='mt-2'>После определения даты — подтвердить дальнейший режим и сохранить квитанции уведомлений. Эта страница ничего не отправляет в ФНС.</p></>}</div></section>
    <section className='tax-panel' aria-label='Выводы и незакрытые вопросы'><div className='tax-panel-head'><div><h2>Контроль незакрытых вопросов</h2><p>Открытых вопросов: {open.length} · внутренние ошибки учёта отделены от налогового признания</p></div></div><div className='tax-body tax-small'><p>Вопросы передать бухгалтеру для налоговой проверки и ответственному за учёт — для связей 1С. Ответственный и срок пока не назначены в портале.</p><p className='mt-2'>Разница источников не равна недоплате. Ошибка 1С сама по себе не доказывает пропуск дохода в ФНС.</p></div>{open.map(f => <details className='tax-details tax-manager-task' key={f.title}><summary><span><b>{f.title}</b><small>{f.status === 'owner_reported' ? 'Есть объяснение владельца; требуется документальная проверка' : 'Не закрыто · влияние на налог требует проверки'}</small></span><span className='tax-link'>Разобрать ＋</span></summary><Finding finding={f} review={review} /></details>)}</section>
    <section className='tax-panel' aria-label='Разница между источниками'><div className='tax-panel-head'><div><h2>Разница ФНС и предварительных оплат: {rub(t.difference)}</h2><p>Оба среза по {day(review.cutoff)}. Это не установленная недоимка. Новая учётная сумма по более позднюю дату здесь не используется.</p></div></div><div className='tax-manager-bridge'>{review.bridge.map(row => <details className='tax-details' key={row.title}><summary><b>{row.title}</b><span>{rub(row.cents)}</span><i aria-hidden='true'>＋</i></summary><p className='tax-small'>{row.note}</p></details>)}</div></section>
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

export function TaxManagementDocuments({ review, preview = false, accountingReport }: { review: Review; preview?: boolean; accountingReport?: PortalReport }) {
  return <section className='tax-panel' aria-label='Документы актуальной сверки'>
    <div className='tax-panel-head'><div><h2>Основания расчёта и подтверждения действий</h2><p>Срез по {day(review.cutoff)}. Архивы содержат первичные файлы и результаты сверки.</p></div></div>
    {review.regimeStatus && <TaxRegimeStatus review={review} />}
    <div className='tax-body tax-small'><p><b>Для подтверждения дальнейших действий:</b> отдельная квитанция о переходе на УСН «Доходы». Справка о снятии с АУСН подтверждает окончание прежнего режима, но не принятие нового. Добавить их можно ниже через «Загрузить другой документ».</p><p className='mt-2'>Документ «В архиве» сохранён для проверки и не означает, что его данные включены в общий расчёт. Полная история загрузок остаётся ниже.</p>{review.documentId && <a className='tax-link mt-2' href={`${documentHref(review.documentId)}?download=1`}>Скачать сводку и расчёт по месяцам</a>}</div>
    {accountingReport?.available && <div className='tax-body border-t border-[#eee7df]'><h3 className='font-semibold text-[14px]'>Свежий исходный учётный отчёт</h3><p className='tax-small tax-muted mt-1'>Данные по {day(accountingReport.dataCutoff!)}. Полнота источников подтверждена обработчиком; это не подтверждение полноты налоговой базы.</p><p className='tax-small break-words mt-1'>{accountingReport.sourceFile}</p>{preview ? <span className='tax-status mt-2' data-tone='muted'>Предпросмотр: ссылка выключена</span> : <a className='tax-link mt-2' href={`/api/admin/taxes/report?file=${encodeURIComponent(accountingReport.sourceFile)}`}>Открыть исходный отчёт</a>}</div>}
    {review.sources.map(source => <div key={source.originalName} className='tax-body border-t border-[#eee7df]'><div className='flex flex-wrap justify-between gap-2'><h3 className='font-semibold text-[14px]'>{source.title}</h3>{source.documentId ? <a className='tax-link' href={documentHref(source.documentId)} target='_blank' rel='noreferrer'>Открыть документ</a> : <span className='tax-status' data-tone={preview ? 'muted' : 'warn'}>{preview ? 'Предпросмотр: ссылки выключены' : 'Не найден в архиве'}</span>}</div><p className='tax-small tax-muted mt-1'>{source.purpose}</p><p className='tax-small break-words mt-1'>{source.originalName}</p></div>)}
    <div className='tax-body border-t border-[#eee7df] tax-small'><b>Основание для годового ограничения:</b> п. 23 ч. 2 ст. 3 закона №17-ФЗ; <a className='tax-link' href='https://www.nalog.gov.ru/rn19/news/seminar/16606142/' target='_blank' rel='noreferrer'>ФНС о совокупном доходе</a>, <a className='tax-link' href='https://www.nalog.gov.ru/rn25/news/activities_fts/16622417/' target='_blank' rel='noreferrer'>ФНС о переходе в течение года</a>.</div>
  </section>;
}


export function TaxAccountingMonths({ review, report }: { review: Review; report?: PortalReport }) {
  const snapshot = accountingSnapshot(review, report);
  if (!report?.available || report.kind !== 'full' || !snapshot || snapshot.sourceName !== report.sourceFile) return <section className='tax-panel'><div className='tax-body tax-small'><b>Свежая помесячная учётная модель недоступна.</b> Документальная сверка ниже сохранена со своей датой; отсутствующие данные не заменены нулями.</div></section>;
  let cumulative = review.q1UsnCents + review.q1PsnCents;
  const rows = report.monthlyIncome.map(row => ({ ...row, cumulative: cumulative += Math.round(row.amount * 100) }));
  return <section className='tax-panel tax-manager-income' aria-label='Свежие учётные доходы по месяцам'>
    <div className='tax-panel-head'><div><h2>Учётная модель по месяцам</h2><p>По {day(snapshot.through)} · сначала новые месяцы · 1С/банк и ККТ</p></div><span className='tax-status' data-tone='muted'>Обновляется из общего отчёта</span></div>
    <div className='tax-body tax-small'>Начало года: УСН + ПСН за январь–март <b>{rub(review.q1UsnCents + review.q1PsnCents)}</b>. Далее прибавлены месяцы из исходного отчёта. Возвраты и возможные повторения учётной модели ещё проверяются.</div>
    <div className='tax-table-wrap'><table className='tax-table'><thead><tr><th>Месяц</th><th className='num'>Учётный доход за месяц</th><th className='num'>С начала года с УСН и ПСН</th><th>Сверка ФНС</th></tr></thead><tbody>{[...rows].reverse().map(row => <tr key={row.periodKey}><td className='capitalize'>{month(row.periodKey)}{row.partial && <small>По {day(snapshot.through)} · неполный месяц</small>}</td><td className='num' data-label='Учётная модель за месяц'>{rub(Math.round(row.amount * 100))}</td><td className='num' data-label='С начала года с УСН и ПСН'>{rub(row.cumulative)}</td><td data-label='Сверка ФНС'>{review.months.some(m => m.periodKey === row.periodKey) ? 'Есть в документальной сверке ниже' : 'Ещё нет выгрузки в этой сверке'}</td></tr>)}</tbody></table></div>
    <div className='tax-body tax-small'><b>Итого учётная модель с начала года: {rub(snapshot.cents)}.</b> Эту сумму нельзя складывать с ФНС или предварительными оплатами.</div>
  </section>;
}

export function TaxRegimeStatus({ review, base }: { review: Review; base?: string }) {
  const r = review.regimeStatus;
  if (!r) return null;
  const source = review.sources.find(s => s.originalName === r.sourceName);
  return <section className='tax-manager-next' aria-label='Переход с АУСН на УСН'>
    <h3>Снятие с АУСН подтверждено ФНС</h3>
    <p><span className='tax-status' data-tone='ok'>АУСН завершена с {day(r.ausnEndedOn)}</span></p>
    <p>Заявление подано владельцем. Справка ФНС №{r.certificateNumber} и уведомление об окончании режима проверены {day(r.checkedAt)}.</p>
    <p><b>УСН «Доходы» с 1 октября — ожидает отдельного подтверждения.</b> Квитанция о принятии перехода не найдена; это не означает отказ.</p>
    <p className='tax-small'><b>Что сделать:</b> передать справку бухгалтеру и получить подтверждение регистрации УСН. Повторно подавать заявление без проверки не нужно.</p>
    {source?.documentId && <a className='tax-link' href={documentHref(source.documentId)}>Скачать подтверждения ФНС →</a>}
    {base && <Link className='tax-link' href={withTab(base, 'documents')}>Документы и квитанции →</Link>}
  </section>;
}
