import Link from 'next/link';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, Clock3, Download, FileText, Info } from 'lucide-react';
import { AdminDisclosureAction } from '@/components/admin/AdminDisclosureAction';
import type { PortalReport, PortalRisk } from '@/lib/ausn-portal-view';
import type { MonthReview, ReviewIssue, CheckState } from '@/lib/ausn-month-review';
import type { HealthIssue } from '@/lib/tax-health';
import type { TaxPeriodPlan } from '@/lib/tax-document-plan';
import { taxDocumentHelp } from '@/lib/tax-document-plan';
import { LimitScenario } from './LimitScenario';
import type { LimitOutlook } from '@/lib/ausn-limit-outlook';
import './taxes.css';

export type TaxTab = 'overview' | 'income' | 'reconciliation' | 'documents';
export const taxTabs: Array<[TaxTab, string]> = [['overview', 'Обзор'], ['income', 'Доходы'], ['reconciliation', 'Сверка с налоговой'], ['documents', 'Документы']];
export type TaxDocumentRow = { id: string; documentType: string; status: string; originalName: string; periodKey: string; coverageFrom?: string | null; coverageTo?: string | null; createdAt: Date; uploadedBy?: string };
export type Forecast = { days: number; withinYear: boolean; months: string[]; average: number; remaining: number; cutoff: string; date?: string };

export const rub = (value?: number) => value === undefined || !Number.isFinite(value) ? '—' : `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
export const mln = (value?: number, digits = 2) => value === undefined || !Number.isFinite(value) ? '—' : `${(value / 1_000_000).toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits })} млн ₽`;
const dayNum = (value?: string) => value ? String(Number(value.slice(8, 10))) : '';
const monthPrepositional = (key: string) => ({ '01': 'январе', '02': 'феврале', '03': 'марте', '04': 'апреле', '05': 'мае', '06': 'июне', '07': 'июле', '08': 'августе', '09': 'сентябре', '10': 'октябре', '11': 'ноябре', '12': 'декабре' } as Record<string, string>)[key.slice(5, 7)] || key;
const monthName = (key: string) => new Intl.DateTimeFormat('ru-RU', { month: 'long', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`));
const monthYear = (key: string) => { const text = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)).replace(/ г\.$/, ''); return text.charAt(0).toUpperCase() + text.slice(1); };
const dayMonth = (value?: string) => value ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`)) : '—';
const moscowTime = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(value)) : '—';
const plural = (count: number, one: string, few: string, many: string) => `${count} ${count % 10 === 1 && count % 100 !== 11 ? one : [2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100) ? few : many}`;
const withTab = (base: string) => `${base}${base.includes('?') ? '&' : '?'}tab=`;

// Plain names for sales channels; the exact category is in the tooltip.
const channels = [
  { key: 'credit', label: 'Кредиты и рассрочки', term: 'Поступления от банков по кредитам и рассрочкам покупателей', color: '#8a5a36' },
  { key: 'acquiring', label: 'Оплата картой', term: 'Эквайринг: оплаты картой и QR в магазине', color: '#c28a57' },
  { key: 'cash', label: 'Наличные', term: 'Наличные по чекам кассы', color: '#dcc6ae' },
  { key: 'wholesale', label: 'Оптовые покупатели', term: 'Оплаты оптовых покупателей на расчётный счёт', color: '#4c5560' },
] as const;
type ChannelKey = typeof channels[number]['key'];

// Plain term on screen, the official name on hover.
// Compact explanation: a small (i) that opens a bubble on click or tap.
const More = ({ children, label }: { children: React.ReactNode; label?: string }) => <details className='tax-hint'><summary aria-label={label || 'Пояснение'}>{label ? <span className='tax-hint-label'>{label}</span> : null}<Info className='h-4 w-4' /></summary><div className='tax-hint-pop'>{children}</div></details>;

const T = ({ children, title }: { children: React.ReactNode; title: string }) => <span className='tax-term' title={title}>{children}</span>;

export type TaxesWorkspaceProps = {
  tab: TaxTab;
  base: string;
  full?: PortalReport;
  current?: PortalReport;
  risk: PortalRisk;
  forecast?: Forecast;
  outlook?: LimitOutlook;
  months: MonthReview[];
  issues: ReviewIssue[];
  health: HealthIssue[];
  plan: TaxPeriodPlan[];
  documents: TaxDocumentRow[];
  upload: (input: { documentType: string; periodKey: string }) => React.ReactNode;
  generalUpload: React.ReactNode;
  notice?: React.ReactNode;
  afterUpload?: React.ReactNode;
  refresh?: React.ReactNode;
};

type MissingType = { type: string; title: string; short: string; periods: string[]; source: string; instruction: string };
const docTitle: Record<string, string> = { AUSN_INCOME: 'Доходы АУСН из налоговой', ENS_OPERATIONS: 'Выгрузка начислений (ЕНС)', AUSN_CALCULATION: 'Справка о доходах АУСН' };
const docShort: Record<string, string> = { AUSN_INCOME: 'Нужны доходы из налоговой', ENS_OPERATIONS: 'Нужна выгрузка начислений', AUSN_CALCULATION: 'Нужна справка о доходах' };
const documentNames: Record<string, string> = { USN_DECLARATION: 'Декларация УСН', USN_DECLARATION_RECEIPT: 'Квитанция о приёме декларации', AUSN_TRANSITION_NOTICE: 'Подтверждение перехода на АУСН', AUSN_KKT: 'Детализация по кассе (ККТ)', CORRECTION_EVIDENCE: 'Исправления и возвраты' };
const documentName = (type: string) => docTitle[type] || documentNames[type] || type;

export function groupMissing(plan: TaxPeriodPlan[]): MissingType[] {
  const result = new Map<string, MissingType>();
  for (const period of plan) for (const type of period.missing) {
    const item = result.get(type) || { type, title: docTitle[type] || type, short: docShort[type] || docTitle[type] || type, periods: [], source: taxDocumentHelp[type].source, instruction: taxDocumentHelp[type].instruction };
    item.periods.push(period.periodKey);
    result.set(type, item);
  }
  return [...result.values()];
}

export function TaxesWorkspace(props: TaxesWorkspaceProps) {
  const { tab, base, issues, plan, health } = props;
  const missingTypes = groupMissing(plan);
  const highIssues = issues.filter((issue) => issue.severity === 'high').length;
  const errors = health.filter((item) => item.level === 'error').length;
  const tabHref = (key: TaxTab) => key === 'overview' ? base : `${withTab(base)}${key}`;
  return <div className='tax-ws'>
    {props.notice}
    <nav aria-label='Разделы налогов' className='admin-section-tabs'>
      {taxTabs.map(([key, label]) => <Link key={key} href={tabHref(key)} aria-current={tab === key ? 'page' : undefined} className='admin-section-tab'>{label}{key === 'reconciliation' && highIssues > 0 ? <span className='needs-decision'>{highIssues}</span> : null}{key === 'documents' && missingTypes.length + errors > 0 ? <span className='needs-decision'>{missingTypes.length + errors}</span> : null}</Link>)}
    </nav>
    {health.length > 0 && (tab === 'overview' || tab === 'documents') && <HealthPanel health={health} refresh={props.refresh} />}
    {tab === 'overview' && <Overview {...props} missingTypes={missingTypes} />}
    {tab === 'income' && <Income {...props} />}
    {tab === 'reconciliation' && <Reconciliation {...props} />}
    {tab === 'documents' && <Documents {...props} missingTypes={missingTypes} />}
    <Footer {...props} />
  </div>;
}

function HealthPanel({ health, refresh }: { health: HealthIssue[]; refresh?: React.ReactNode }) {
  const tone = health.some((item) => item.level === 'error') ? 'error' : 'warn';
  return <section className='tax-panel tax-queue' data-tone={tone} aria-label='Что не работает'>
    <header><AlertTriangle className={`h-4 w-4 ${tone === 'error' ? 'text-[#b63636]' : 'text-[#a8771c]'}`} /><h2>Что не работает</h2><span>{health.length}</span></header>
    {health.map((item) => <div key={item.id} className='tax-item'><b className='inline-flex items-center gap-1.5'>{item.title}<More><p>{item.text}</p>{item.action && <p className='mt-1.5'>{item.action}</p>}</More></b>{item.id === 'stale' && refresh}</div>)}
  </section>;
}

const limitReport = (full?: PortalReport, current?: PortalReport) => full?.available ? full : current?.available ? current : undefined;

function Overview(props: TaxesWorkspaceProps & { missingTypes: MissingType[] }) {
  const { full, current, risk, forecast, outlook, months, base, missingTypes } = props;
  const report = limitReport(full, current);
  if (!report) return <section className='tax-panel'><div className='tax-body'><p className='text-[14px] font-semibold'>Цифры по налогам сейчас недоступны.</p><p className='tax-small tax-muted mt-1'>Причина и что делать — в блоке «Что не работает» выше.</p></div></section>;
  const used = report.usedPercent ?? 0;
  const year = report.year || report.dataCutoff?.slice(0, 4) || '';
  const closed = months.filter((month) => !month.partial);
  const reconciled = closed.filter((month) => month.checks.find((check) => check.key === 'fns')?.state === 'ok').length;
  const diffs = closed.filter((month) => month.checks.some((check) => check.state === 'diff')).length;
  const paid = months.reduce((sum, month) => sum + (month.detail?.enpPaymentState === 'found' ? month.detail.enpPayment ?? 0 : 0), 0);
  const unpaidDue = months.filter((month) => month.checks.find((check) => check.key === 'payment')?.state === 'missing');
  const underpaid = months.filter((month) => month.checks.find((check) => check.key === 'payment')?.state === 'diff' && (month.detail?.enpPayment ?? 0) < (month.detail?.tax ?? 0));
  const status: readonly [string, string] = !outlook ? ['muted', 'Нет прогноза'] : outlook.state === 'exceeded' ? ['error', 'Лимит превышен'] : outlook.state === 'decide_now' ? ['error', 'Решение нужно сейчас'] : outlook.state === 'decide_by' ? ['warn', `Решить до ${dayMonth(outlook.decisionDate)}`] : ['ok', 'Хватит до конца года'];
  const range = outlook && outlook.state !== 'exceeded' && outlook.cautious.withinYear ? (outlook.usual.withinYear && outlook.cautious.date !== outlook.usual.date ? `${dayNum(outlook.cautious.date)}–${dayMonth(outlook.usual.date)}` : dayMonth(outlook.cautious.date)) : undefined;
  const barLevel = risk.level !== 'unknown' ? risk.level : used >= 95 ? 'urgent' : used >= 90 ? 'plan' : used >= 80 ? 'early' : 'normal';
  return <>
    <section className='tax-panel' aria-label='Годовой лимит дохода'>
      <div className='tax-panel-head'><div><h2 className='inline-flex items-center gap-1.5'>Годовой лимит дохода — 60 млн ₽<More><p>Считается весь доход за год с 1 января, включая январь–март до перехода на АУСН.</p><p className='mt-1.5'>Если доход превысит 60 млн ₽, АУСН перестаёт действовать с 1 числа месяца превышения. До 15 числа следующего месяца нужно уведомить налоговую и выбрать режим (обычно УСН), иначе — общий режим с НДС.</p></More></h2><p>Данные по {dayMonth(report.dataCutoff)}</p></div><span className='tax-status' data-tone={status[0]}>{status[1]}</span></div>
      <div className='tax-kpis'>
        <div className='tax-kpi' data-accent='true'><small>Осталось до лимита</small><strong>{mln(report.remaining)}</strong><span>из 60 млн ₽</span></div>
        <div className='tax-kpi'><small>Получено за год</small><strong>{mln(report.totalIncome)}</strong><span>использовано {used.toLocaleString('ru-RU')}%</span></div>
        <div className='tax-kpi'><small>Лимит закончится</small><strong>{outlook?.state === 'exceeded' ? 'уже превышен' : range ? `≈ ${range}` : outlook ? 'не в этом году' : '—'}</strong><span>{range ? 'при нынешних продажах' : outlook ? 'даже при сильных продажах' : 'нужно 3 полных месяца'}</span></div>
      </div>
      <div className='tax-body pt-1'>
        <div className='tax-limit-bar' data-level={barLevel} role='meter' aria-label='Использовано лимита' aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, used)}><i style={{ width: `${Math.min(100, Math.max(0, used))}%` }} />{[80, 90, 95].map((mark) => <b key={mark} style={{ left: `${mark}%` }} data-label={`${mark}%`} />)}</div>
        {outlook && <DecisionCallout outlook={outlook} />}
        {forecast && <details className='tax-details group mt-3 border-t border-[#eee7df] pt-2'><summary className='flex items-center justify-between gap-3 py-1'><span className='text-[13px] font-semibold'>Посчитать свой вариант продаж</span><AdminDisclosureAction /></summary><div className='mt-3'><LimitScenario remaining={forecast.remaining} cutoff={forecast.cutoff} year={year} average={forecast.average} /></div></details>}
      </div>
    </section>

    <section className='tax-panel' aria-label='Налоги коротко'>
      <SummaryRow title='Налог' tone={unpaidDue.length ? 'error' : underpaid.length ? 'warn' : paid > 0 ? 'ok' : 'muted'} status={unpaidDue.length ? 'Не оплачен' : underpaid.length ? 'Недоплата' : paid > 0 ? 'Оплачивается' : 'Оплаты не сверялись'} href={`${withTab(base)}reconciliation`}>
        {full?.available ? <>С апреля {mln(full.estimatedTax)}{paid > 0 ? `, оплачено ${mln(paid)}` : ' (8% от дохода)'}{underpaid.length ? ` · недоплата за ${underpaid.map((month) => monthName(month.periodKey)).join(', ')}` : ''}{unpaidDue.length ? ` · не найдена оплата за ${unpaidDue.map((month) => monthName(month.periodKey)).join(', ')}` : ''}</> : 'Появится после пересчёта'}
      </SummaryRow>
      <SummaryRow title='Сверка с налоговой' tone={diffs ? 'error' : closed.length && reconciled === closed.length ? 'ok' : 'warn'} status={diffs ? `Расхождения: ${diffs}` : closed.length && reconciled === closed.length ? 'Совпадает' : 'Не всё проверено'} href={`${withTab(base)}reconciliation`}>
        {closed.length ? `Совпадает ${reconciled} из ${closed.length} месяцев` : 'Нет данных'}
      </SummaryRow>
      <SummaryRow title='Документы' tone={missingTypes.length ? 'warn' : 'ok'} status={missingTypes.length ? `Загрузить: ${missingTypes.length}` : 'Всё есть'} href={`${withTab(base)}documents`}>
        {missingTypes.length ? missingTypes.map((item) => `${item.short} за ${item.periods.map(monthName).join(', ')}`).join('; ') : 'Все выгрузки за прошлые месяцы загружены'}
      </SummaryRow>
    </section>

    <IncomeStructurePanel {...props} compact />
  </>;
}

function DecisionCallout({ outlook }: { outlook: LimitOutlook }) {
  if (outlook.state === 'exceeded') return <div className='tax-callout' data-tone='error'><strong>Лимит превышен.</strong> Срочно к бухгалтеру: уведомить налоговую и выбрать режим до 15 числа следующего месяца.</div>;
  if (outlook.state === 'enough') return <div className='tax-callout' data-tone='ok'><strong>Лимита хватит до конца года</strong>, даже при самых сильных продажах.</div>;
  return <div className='tax-callout' data-tone={outlook.state === 'decide_now' ? 'error' : 'warn'}>
    <strong>{outlook.state === 'decide_now' ? 'Решение по лимиту нужно сейчас.' : `Решить по лимиту до ${dayMonth(outlook.decisionDate)}.`}</strong>{outlook.safeMonthly !== undefined && <> Чтобы дотянуть до 31 декабря — не больше {mln(outlook.safeMonthly)} дохода в месяц.</>}
    <More><p>Если продажи будут {mln(outlook.cautious.monthly)} в месяц{outlook.cautious.month ? ` (как в ${monthPrepositional(outlook.cautious.month)})` : ''}, лимит закончится около {dayMonth(outlook.cautious.date)}{outlook.usual.withinYear && outlook.usual.date !== outlook.cautious.date ? `; при среднем темпе ${mln(outlook.usual.monthly)} (${outlook.usual.months.map(monthName).join(', ')}) — около ${dayMonth(outlook.usual.date)}` : ''}. Перед праздниками продажи растут, поэтому берём более раннюю дату. Срок решения — за 45 дней до неё.</p></More>
  </div>;
}

function SummaryRow({ title, tone, status, href, children }: { title: string; tone: string; status: string; href: string; children: React.ReactNode }) {
  return <Link href={href} className='tax-summary-row'><b>{title}</b><p className='tax-muted'>{children}</p><span className='flex items-center gap-3'><span className='tax-status' data-tone={tone}>{status}</span><ArrowRight className='h-4 w-4 text-[#754725]' /></span></Link>;
}

function IncomeStructurePanel({ full, base, compact }: TaxesWorkspaceProps & { compact?: boolean }) {
  if (!full?.available) return null;
  const structure = full.incomeStructure || {};
  const total = full.ausnIncome;
  return <section className='tax-panel' aria-label='Доход по видам поступлений'>
    <div className='tax-panel-head'><div><h2>Доход с апреля по видам поступлений</h2><p>Всего {mln(total)}</p></div>{compact && <Link href={`${withTab(base)}income`} className='tax-link'>По месяцам <ArrowRight /></Link>}</div>
    <div className='tax-body'>
      <div className='tax-stack'>{channels.map((channel) => { const value = structure[channel.key]; return value && total ? <i key={channel.key} title={`${channel.label}: ${rub(value)}`} style={{ width: `${(value / total) * 100}%`, background: channel.color }} /> : null; })}</div>
      <div className='tax-channels'>{channels.map((channel) => { const value = structure[channel.key]; return <div key={channel.key} className='tax-channel'><span><i style={{ background: channel.color }} /><T title={channel.term}>{channel.label}</T></span><strong>{mln(value)}</strong><span>{value !== undefined && total ? `${(Math.round((value / total) * 1000) / 10).toLocaleString('ru-RU')}% дохода` : 'нет разбивки'}</span></div>; })}</div>
    </div>
  </section>;
}

function Income(props: TaxesWorkspaceProps) {
  const { full, months } = props;
  if (!full?.available) return <section className='tax-panel'><div className='tax-body tax-small'>Расчёт по месяцам пока не получен — см. «Что не работает» на вкладке «Обзор».</div></section>;
  const rows = months.filter((month) => month.detail?.base !== undefined);
  return <>
    <IncomeStructurePanel {...props} />
    <section className='tax-panel' aria-label='Доход по месяцам'>
      <div className='tax-panel-head'><div><h2>Доход и налог по месяцам</h2><p>Налог — 8% от дохода</p></div></div>
      <div className='tax-table-wrap'><table className='tax-table'>
        <thead><tr><th>Месяц</th>{channels.map((channel) => <th key={channel.key} className='num'>{channel.label}</th>)}<th className='num'>Доход</th><th className='num'>Налог 8%</th></tr></thead>
        <tbody>{rows.map((month) => <tr key={month.periodKey}><td className='font-semibold'><span className='capitalize'>{monthName(month.periodKey)}</span>{month.partial && <small>по {dayMonth(full.dataCutoff)}</small>}</td>{channels.map((channel) => <td key={channel.key} className='num'>{mln(month.detail?.[channel.key as ChannelKey])}</td>)}<td className='num font-semibold'>{mln(month.detail?.base)}</td><td className='num'>{rub(month.detail?.tax)}</td></tr>)}</tbody>
        <tfoot><tr><td>С апреля</td>{channels.map((channel) => <td key={channel.key} className='num'>{mln(full.incomeStructure?.[channel.key as ChannelKey])}</td>)}<td className='num'>{mln(full.ausnIncome)}</td><td className='num'>{rub(full.estimatedTax)}</td></tr></tfoot>
      </table></div>
    </section>
  </>;
}

const checkMeta: Record<CheckState, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: 'text-[#267a45]', label: 'совпадает' },
  diff: { icon: AlertTriangle, className: 'text-[#b63636]', label: 'не совпадает' },
  missing: { icon: CircleDashed, className: 'text-[#a8771c]', label: 'нет данных' },
  not_due: { icon: Clock3, className: 'text-[#9aa3a9]', label: 'ещё рано' },
  unknown: { icon: CircleDashed, className: 'text-[#9aa3a9]', label: '—' },
};

function Cell({ state, value, note }: { state: CheckState; value?: string; note?: string }) {
  const meta = checkMeta[state];
  const Icon = meta.icon;
  return <td><span className='flex items-start gap-1.5'><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} aria-label={meta.label} /><span className='tabular-nums'>{value || meta.label}{note && <small data-tone={state === 'diff' ? 'error' : undefined}>{note}</small>}</span></span></td>;
}

function Reconciliation({ months, issues, full, base }: TaxesWorkspaceProps) {
  const groups = [
    { tone: 'error', title: 'Нужно разобраться', items: issues.filter((issue) => issue.severity === 'high') },
    { tone: 'warn', title: 'Не хватает данных из налоговой', items: issues.filter((issue) => issue.severity === 'medium') },
    { tone: 'info', title: 'К сведению', items: issues.filter((issue) => issue.severity === 'low') },
  ].filter((group) => group.items.length);
  return <>
    {groups.map((group) => <section key={group.title} className='tax-panel tax-queue' data-tone={group.tone}><header><h2>{group.title}</h2><span>{group.items.length}</span></header>{group.items.map((issue, index) => <div key={index} className='tax-item flex flex-wrap items-center justify-between gap-x-4 gap-y-1'><b>{issue.title}</b>{issue.uploadHint ? <Link href={`${withTab(base)}documents`} className='tax-link'>Загрузить <ArrowRight /></Link> : <More label='что делать'><p>{issue.text}</p>{issue.action && <p className='mt-1.5'>{issue.action}</p>}</More>}</div>)}</section>)}
    {!groups.length && full?.available && <div className='tax-callout' data-tone='ok'><strong>Расхождений нет.</strong></div>}
    {months.length > 0 && <section className='tax-panel' aria-label='Сверка по месяцам'>
      <div className='tax-panel-head'><div><h2 className='inline-flex items-center gap-1.5'>По месяцам<More><p>Сравниваем наш учёт (1С, банк, касса) с данными налоговой.</p><p className='mt-1.5'>«Налоговая учла» — личный кабинет → АУСН → Доходы. «Налоговая начислила» — единый налоговый счёт. «Оплачено» — платёж из банка.</p><p className='mt-1.5'>Часы — срок ещё не наступил.</p></More></h2></div></div>
      <div className='tax-table-wrap'><table className='tax-table'>
        <thead><tr><th>Месяц</th><th className='num'>Наш доход</th><th><T title='Личный кабинет налоговой → АУСН → Доходы'>Налоговая учла</T></th><th className='num'>Наш налог</th><th><T title='Единый налоговый счёт (ЕНС): начисление налога'>Налоговая начислила</T></th><th><T title='Единый налоговый платёж (ЕНП) по выписке банка'>Оплачено</T></th></tr></thead>
        <tbody>{[...months].reverse().map((month) => { const [fns, ens, payment] = month.checks; return <tr key={month.periodKey} data-tone={month.state === 'attention' ? 'error' : undefined}>
          <td className='font-semibold'><span className='capitalize'>{monthName(month.periodKey)}</span>{month.partial && <small>месяц идёт</small>}</td>
          <td className='num'>{rub(month.detail?.base)}</td>
          <Cell state={fns.state} value={month.detail?.fnsAccepted !== undefined ? rub(month.detail.fnsAccepted) : undefined} note={fns.note} />
          <td className='num'>{rub(month.detail?.tax)}</td>
          <Cell state={ens.state} value={month.detail?.fnsAssessed !== undefined ? rub(month.detail.fnsAssessed) : undefined} note={ens.state === 'diff' ? 'не совпадает с нашим налогом' : undefined} />
          <Cell state={payment.state} value={month.detail?.enpPayment !== undefined ? rub(month.detail.enpPayment) : undefined} note={payment.note} />
        </tr>; })}</tbody>
      </table></div>
    </section>}
  </>;
}

function Documents({ missingTypes, documents, upload, generalUpload, plan, afterUpload }: TaxesWorkspaceProps & { missingTypes: MissingType[] }) {
  const declaration = documents.find((document) => document.documentType === 'USN_DECLARATION');
  const transition = documents.find((document) => document.documentType === 'AUSN_TRANSITION_NOTICE');
  const statusLabel = (status: string) => status === 'PROCESSED' ? ['ok', 'Учтён в сверке'] : status === 'PROCESSING_FAILED' ? ['error', 'Не обработан'] : ['muted', 'В архиве'];
  return <>
    <section className='tax-panel tax-queue' data-tone={missingTypes.length ? 'warn' : 'info'} aria-label='Что загрузить'>
      <header><h2>{missingTypes.length ? 'Что загрузить' : 'Все документы загружены'}</h2>{missingTypes.length > 0 && <span>{missingTypes.length}</span>}</header>
      {missingTypes.map((item) => <div key={item.type} className='tax-item'>
        <b>{item.title} — за {item.periods.map(monthName).join(', ')}</b>
        <p className='tax-muted inline-flex items-center gap-1.5'>{item.source}<More><p>{item.instruction}</p></More></p>
        <details className='tax-details group mt-2'><summary className='inline-flex'><span className='admin-material-primary inline-flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-white'>Загрузить файл</span></summary><div className='tax-upload'>{upload({ documentType: item.type, periodKey: item.periods.at(-1)! })}</div></details>
      </div>)}
      {!missingTypes.length && <div className='tax-item'><p className='tax-muted'>Следующие — после 16 числа</p></div>}
    </section>
    {afterUpload}

    <details className='tax-panel tax-details group'>
      <summary className='tax-panel-head' style={{ borderBottom: 0 }}><div><h2>Загрузить другой документ</h2><p>Касса, возвраты, повторная загрузка</p></div><AdminDisclosureAction /></summary>
      <div className='tax-body' style={{ borderTop: '1px solid #eee7df' }}>{generalUpload}</div>
    </details>

    <section className='tax-panel' aria-label='Постоянные документы'>
      <div className='tax-panel-head'><div><h2>Постоянные документы</h2><p>Загружаются один раз</p></div></div>
      <div className='tax-table-wrap'><table className='tax-table'><tbody>
        <PermanentRow title='Декларация УСН за январь–март 2026' document={declaration} help={taxDocumentHelp.USN_DECLARATION.source} />
        <PermanentRow title='Подтверждение перехода на АУСН' document={transition} help={taxDocumentHelp.AUSN_TRANSITION_NOTICE.source} />
      </tbody></table></div>
    </section>

    <section className='tax-panel' aria-label='История загрузок'>
      <div className='tax-panel-head'><div><h2>История загрузок</h2><p>{plural(documents.length, 'файл', 'файла', 'файлов')}</p></div></div>
      <div className='tax-table-wrap'><table className='tax-table'>
        <thead><tr><th>Документ</th><th>Период</th><th>Статус</th><th>Загружен</th><th /></tr></thead>
        <tbody>{documents.map((document) => { const [tone, label] = statusLabel(document.status); return <tr key={document.id}>
          <td><span className='font-semibold'>{documentName(document.documentType)}</span><small className='max-w-[320px] truncate'>{document.originalName}</small></td>
          <td className='whitespace-nowrap'>{coverage(document)}</td>
          <td><span className='tax-status' data-tone={tone}>{label}</span></td>
          <td className='whitespace-nowrap'>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'Europe/Moscow' }).format(document.createdAt)}{document.uploadedBy && <small>{document.uploadedBy}</small>}</td>
          <td className='whitespace-nowrap text-right'><a className='tax-link' href={`/api/admin/taxes/documents/${document.id}`} target='_blank'>Открыть</a> <a className='tax-link ml-3' href={`/api/admin/taxes/documents/${document.id}?download=1`} aria-label='Скачать'><Download /></a></td>
        </tr>; })}</tbody>
      </table></div>
    </section>
  </>;
}

function PermanentRow({ title, document, help }: { title: string; document?: TaxDocumentRow; help: string }) {
  return <tr><td className='font-semibold'>{title}{!document && <small>Где взять: {help}</small>}</td><td>{document ? <span className='tax-status' data-tone='ok'>Сохранена</span> : <span className='tax-status' data-tone='warn'>Не загружена</span>}</td><td className='text-right'>{document && <a className='tax-link' href={`/api/admin/taxes/documents/${document.id}`} target='_blank'>Открыть</a>}</td></tr>;
}

function coverage(document: TaxDocumentRow) {
  const from = document.coverageFrom;
  const to = document.coverageTo || document.periodKey;
  if (!/^20\d{2}-\d{2}$/.test(to)) return to;
  return from && from !== to ? `${monthName(from)} – ${monthYear(to).toLowerCase()}` : monthYear(to);
}

function Footer({ full, current, refresh }: TaxesWorkspaceProps) {
  const reports = [full, current].filter((report): report is PortalReport => Boolean(report?.available)).sort((a, b) => Date.parse(b.runTimeUtc!) - Date.parse(a.runTimeUtc!));
  const latest = reports[0];
  return <details className='tax-details group'>
    <summary className='tax-footer'><span>{latest ? `Данные по ${dayMonth(latest.dataCutoff)} · пересчитано ${moscowTime(latest.runTimeUtc)}` : 'Расчёт не получен'}</span><span className='tax-link'>Подробности для проверки</span></summary>
    {latest && <div className='tax-panel mt-2'><div className='tax-body tax-small space-y-1.5'>
      {refresh}
      <p className='font-semibold pt-2'>Откуда данные</p>
      {Object.entries(latest.sourceCompleteness).map(([name, value]) => <p key={name}><span className='tax-muted'>{name}:</span> {value}</p>)}
      <p className='tax-muted pt-1'>Цифры пересчитываются каждое утро и после каждой загрузки документа. Версия расчёта {latest.codeVersion?.slice(0, 12) || '—'} · 1С {latest.agentApiUser || '—'} / {latest.agentApiVersion || '—'}</p>
      <p className='flex flex-wrap gap-4 pt-1'>{reports.map((report) => <a key={report.sourceFile} className='tax-link' href={`/api/admin/taxes/report?file=${encodeURIComponent(report.sourceFile)}`}><FileText /> {report.kind === 'full' ? 'Полный отчёт за год' : 'Отчёт за текущий месяц'}</a>)}</p>
    </div></div>}
  </details>;
}
