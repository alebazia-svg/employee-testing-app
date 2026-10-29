import 'server-only';

import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// Portal-only adapter. The canonical report, shared reminder parser and Telegram
// sender are deliberately independent of this presentation contract.
export type IncomeStructure = { credit?: number; acquiring?: number; cash?: number; wholesale?: number; other?: number };
export type PortalMonth = IncomeStructure & { periodKey: string; label: string; amount: number; partial: boolean };
// Per-month values exactly as printed by the runner's "Помесячная структура" and
// "Помесячная сверка с ФНС" sections. Missing cells stay undefined, never zero.
export type PortalMonthDetail = IncomeStructure & {
  periodKey: string;
  base?: number;
  tax?: number;
  enpPayment?: number;
  enpPaymentState: 'found' | 'not_found' | 'unknown';
  fnsAccepted?: number;
  fnsAssessed?: number;
  fnsAssessedState: 'loaded' | 'not_loaded' | 'unknown';
  fnsDifference?: number;
  fnsStatus?: string;
};
export type PortalReport = {
  available: boolean;
  reason?: string;
  sourceFile: string;
  canonicalText: string;
  kind: 'full' | 'month';
  periodKey?: string;
  year?: string;
  runTimeUtc?: string;
  dataCutoff?: string;
  codeVersion?: string;
  agentApiUser?: string;
  agentApiVersion?: string;
  totalIncome?: number;
  remaining?: number;
  usedPercent?: number;
  usnBaseline?: number;
  ausnIncome?: number;
  estimatedTax?: number;
  monthBase?: number;
  monthTax?: number;
  ensAssessed?: number;
  ensDifference?: number;
  fnsIncome?: number;
  fnsDifference?: number;
  fnsRows?: number;
  controlCoverage?: string;
  monthlyIncome: PortalMonth[];
  monthDetails: PortalMonthDetail[];
  fnsCoverage?: { from: string; to: string };
  incomeStructure?: IncomeStructure;
  sourceCompleteness: Record<string, string>;
  attention: string[];
  missingData: string[];
  modifiedAt?: number;
};

const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const validPeriod = /^20\d{2}-(?:0[1-9]|1[0-2])$/;
const validYear = /^20\d{2}$/;
const maxReportBytes = 256_000;

function section(text: string, title: string) {
  return text.split(`## ${title}\n`)[1]?.split(/\n## /)[0] ?? '';
}

function rows(text: string) {
  return text.split(/\r?\n/).filter((line) => line.startsWith('|')).map((line) => line.split('|').slice(1, -1).map((part) => part.trim()));
}

// Empty cells, unavailable controls and explanatory text are never zeroes.
export function portalNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const match = /^([+−-]?\d[\d \u00a0\u202f]*(?:[,.]\d{1,2})?)\s*(?:₽|%|$)/.exec(value.trim());
  if (!match) return undefined;
  const result = Number(match[1].replace(/[ \u00a0\u202f]/g, '').replace(',', '.').replace('−', '-'));
  return Number.isFinite(result) ? result : undefined;
}

function bullets(text: string) {
  return text.split('\n').filter((line) => line.startsWith('- ')).map((line) => line.slice(2).trim());
}

export function parsePortalReport(text: string, sourceFile = 'report.md'): PortalReport {
  const normalized = text.replace(/\r\n/g, '\n');
  const table = rows(normalized);
  const cell = (...labels: string[]) => table.find((row) => labels.includes(row[0]))?.[1];
  const title = normalized.match(/^# (.+)$/m)?.[1] ?? '';
  const periodKey = title.match(/^Отчёт АУСН за (20\d{2}-\d{2})$/)?.[1];
  const kind = periodKey ? 'month' : 'full';
  const recognized = Boolean(periodKey && validPeriod.test(periodKey)) || /^АУСН: лимит и оборот на \d{2}\.\d{2}\.20\d{2}$/.test(title);
  const runTimeUtc = cell('UTC run time');
  const dataCutoff = cell('Data cutoff');
  const year = dataCutoff?.slice(0, 4) || periodKey?.slice(0, 4);
  const sourceCompleteness: Record<string, string> = Object.fromEntries(rows(section(normalized, 'Полнота источников')).filter((row) => row.length === 2 && !['Показатель', '---'].includes(row[0]) && !row[0].startsWith('-')));
  const failures: string[] = [];
  const number = (...labels: string[]) => portalNumber(cell(...labels));
  const codeVersion = cell('Версия кода отчёта');
  const agentApiUser = cell('AgentAPI пользователь');
  const agentApiVersion = cell('AgentAPI версия');
  const totalIncome = number('Всего доходов года для лимита');
  const remainingCell = cell('Остаток до лимита', 'Остаток до лимита 60 млн');
  const remaining = remainingCell?.startsWith('превышение на ') ? -Math.abs(portalNumber(remainingCell.slice('превышение на '.length)) ?? NaN) : portalNumber(remainingCell);
  const usedPercent = number('Использовано лимита');
  if (!recognized) failures.push('Формат отчёта не распознан.');
  if (!text.endsWith('\n')) failures.push('Текст отчёта может быть оборван.');
  if (!runTimeUtc || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(runTimeUtc) || !Number.isFinite(Date.parse(runTimeUtc)) || !dataCutoff || !/^20\d{2}-\d{2}-\d{2}$/.test(dataCutoff) || !Number.isFinite(Date.parse(`${dataCutoff}T00:00:00Z`)) || new Date(`${dataCutoff}T00:00:00Z`).toISOString().slice(0, 10) !== dataCutoff) failures.push('Не подтверждены дата запуска и дата данных.');
  if (!codeVersion || !/^[a-f0-9]{40}$/i.test(codeVersion) || !agentApiUser || !agentApiVersion || [agentApiUser, agentApiVersion].some((value) => /^(unknown|не указан)/i.test(value))) failures.push('Не подтверждены версия расчёта и пользователь 1С.');
  const oneC = sourceCompleteness['1С AgentAPI'] || '';
  const bank = sourceCompleteness['Банк 1С'] || '';
  const ofd = Object.entries(sourceCompleteness).find(([name]) => name.startsWith('OFD'))?.[1] || '';
  if (!/^(полный|пользователь .+; версия .+)/i.test(oneC) || /ошиб|непол|недоступ/i.test(oneC)) failures.push('Нет подтверждения источника 1С.');
  if (!/^\d+ (?:банковских )?документов(?: за месяц)?$/.test(bank)) failures.push('Нет подтверждения банковских документов.');
  if (!/полнота: да(?:$|[;\s])/i.test(ofd) || /ошиб|непол|недоступ/i.test(ofd)) failures.push('Нет подтверждения полноты OFD.');
  if (totalIncome === undefined || !Number.isFinite(remaining) || usedPercent === undefined) failures.push('Годовые показатели отсутствуют или повреждены.');
  if (periodKey && dataCutoff && periodKey.slice(0, 4) !== dataCutoff.slice(0, 4)) failures.push('Годовые показатели и месяц относятся к разным годам.');
  if (periodKey && dataCutoff && periodKey > dataCutoff.slice(0, 7)) failures.push('Период отчёта выходит за дату данных.');
  if (runTimeUtc && Number.isFinite(Date.parse(runTimeUtc)) && dataCutoff) {
    const runDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(new Date(runTimeUtc));
    if (dataCutoff > runDay) failures.push('Дата данных позже даты запуска отчёта.');
  }
  const requestedPeriod = cell('Запрошенный период');
  if ((kind === 'full' && requestedPeriod !== 'full') || (kind === 'month' && requestedPeriod !== periodKey && requestedPeriod !== 'current')) failures.push('Не подтверждён запрошенный период.');
  if (requestedPeriod === 'current' && periodKey !== dataCutoff?.slice(0, 7)) failures.push('Текущий месяц не совпадает с датой данных.');
  const monthlyIncome: PortalMonth[] = [];
  for (const row of table) {
    const match = new RegExp(`^(${months.join('|')}) (20\\d{2})(?: по (\\d{2}\\.\\d{2}\\.20\\d{2}))?$`, 'i').exec(row[0]);
    if (!match) continue;
    const amount = portalNumber(row[1]);
    if (amount === undefined) continue;
    const key = `${match[2]}-${String(months.indexOf(match[1].toLowerCase()) + 1).padStart(2, '0')}`;
    // Full reports from older runners do not explicitly mark the open month.
    const partial = Boolean(match[3]) || key === runTimeUtc?.slice(0, 7) || Boolean(dataCutoff && key === dataCutoff.slice(0, 7) && dataCutoff !== new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 0)).toISOString().slice(0, 10));
    monthlyIncome.push({ periodKey: key, label: `${match[1]} ${match[2]}`, amount, partial, ...(row.length >= 7 ? { credit: portalNumber(row[2]), acquiring: portalNumber(row[3]), cash: portalNumber(row[4]), wholesale: portalNumber(row[5]), other: portalNumber(row[6]) } : {}) });
  }
  if (kind === 'full' && monthlyIncome.some((month) => month.periodKey.slice(0, 4) !== year)) failures.push('В годовом отчёте смешаны месяцы разных лет.');
  const structure: IncomeStructure = { credit: number('Кредиты/рассрочки'), acquiring: number('Эквайринг AQSI', 'Эквайринг'), cash: number('Наличные AQSI', 'Наличные'), wholesale: number('Оптовые поступления', 'Оптовые продажи'), other: number('Неклассифицированные и прочие') };
  const monthDetails = parseMonthDetails([...rows(section(normalized, 'Помесячная структура')), ...rows(section(normalized, 'Помесячная сверка с ФНС'))]);
  const coverageMatch = /покрытие (20\d{2}-\d{2})–(20\d{2}-\d{2})/.exec(sourceCompleteness['ЛК ФНС'] || '');
  const available = failures.length === 0;
  const ensLoaded = /^загружен/i.test(sourceCompleteness['ЕНС'] || '');
  const fnsLoaded = /^загружен/i.test(sourceCompleteness['ЛК ФНС'] || '');
  const ausnCell = table.find(([label]) => /^АУСН с /.test(label))?.[1];
  return {
    available, reason: failures.length ? failures.join(' ') : undefined, sourceFile, canonicalText: text, kind, periodKey, year,
    runTimeUtc, dataCutoff, codeVersion, agentApiUser, agentApiVersion, sourceCompleteness,
    // A failed required source never exposes partial totals through this adapter.
    ...(available ? {
      totalIncome, remaining, usedPercent, usnBaseline: number('УСН до 31.03.2026'), ausnIncome: portalNumber(ausnCell),
      estimatedTax: number('Расчётный налог АУСН 8% за период'), monthBase: number('Налоговая база'), monthTax: number('Расчётный налог 8%'),
      ensAssessed: ensLoaded ? number('Начислено в ЕНС за доступные периоды', 'Начислено в ЕНС за период') : undefined, ensDifference: ensLoaded ? number('Разница: наш расчёт - ЕНС') : undefined,
      fnsIncome: fnsLoaded ? number('База по выгрузке ЛК ФНС') : undefined, fnsDifference: fnsLoaded ? number('Разница: наш расчёт - ЛК ФНС') : undefined, fnsRows: fnsLoaded ? number('Строк в выгрузке ЛК ФНС') : undefined,
      controlCoverage: sourceCompleteness['ЛК ФНС']?.match(/покрытие (.+)$/)?.[1],
      monthlyIncome, monthDetails: monthDetails.map((detail) => ({ ...detail, ...(!fnsLoaded ? { fnsAccepted: undefined, fnsDifference: undefined, fnsStatus: undefined } : {}), ...(!ensLoaded ? { fnsAssessed: undefined, fnsAssessedState: 'not_loaded' as const } : {}) })), fnsCoverage: fnsLoaded && coverageMatch ? { from: coverageMatch[1], to: coverageMatch[2] } : undefined, incomeStructure: Object.values(structure).some((value) => value !== undefined) ? structure : undefined,
    } : { monthlyIncome: [], monthDetails: [] }),
    attention: available ? bullets(section(normalized, 'Что требует внимания')) : [],
    missingData: bullets(section(normalized, 'Каких данных не хватает')),
  };
}

const detailFields: Record<string, (detail: PortalMonthDetail, value: string) => void> = {
  'База': (detail, value) => { detail.base = portalNumber(value); },
  'Кредиты/рассрочки': (detail, value) => { detail.credit = portalNumber(value); },
  'Эквайринг': (detail, value) => { detail.acquiring = portalNumber(value); },
  'Наличные': (detail, value) => { detail.cash = portalNumber(value); },
  'Оптовые продажи': (detail, value) => { detail.wholesale = portalNumber(value); },
  'Расчётный налог 8%': (detail, value) => { detail.tax = portalNumber(value); },
  'Платёж ЕНП из банка': (detail, value) => { detail.enpPayment = portalNumber(value); detail.enpPaymentState = detail.enpPayment !== undefined ? 'found' : /не найден/i.test(value) ? 'not_found' : 'unknown'; },
  'Принято ФНС': (detail, value) => { detail.fnsAccepted = portalNumber(value); },
  'Начислено ФНС': (detail, value) => { detail.fnsAssessed = portalNumber(value); detail.fnsAssessedState = detail.fnsAssessed !== undefined ? 'loaded' : /не загружено/i.test(value) ? 'not_loaded' : 'unknown'; },
  'Разница с ФНС': (detail, value) => { detail.fnsDifference = portalNumber(value); },
  'Статус сверки': (detail, value) => { detail.fnsStatus = value; },
};

function parseMonthDetails(table: string[][]) {
  const result = new Map<string, PortalMonthDetail>();
  for (const [label, value] of table) {
    const match = /^(20\d{2}-(?:0[1-9]|1[0-2])) · (.+)$/.exec(label || '');
    const apply = match && detailFields[match[2]];
    if (!match || !apply || value === undefined) continue;
    const detail = result.get(match[1]) || { periodKey: match[1], enpPaymentState: 'unknown', fnsAssessedState: 'unknown' };
    apply(detail, value);
    result.set(match[1], detail);
  }
  return [...result.values()].sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

export async function loadPortalReports(directory = process.env.AUSN_REPORT_CACHE_DIR || '/app/runtime/ausn-reports'): Promise<PortalReport[]> {
  try {
    const names = (await readdir(directory)).filter((name) => /^ausn-executive-(?:full|current|20\d{2}-\d{2})-\d{8}T\d{6}\.md$/.test(name));
    const results = await Promise.all(names.map(async (name) => {
      try {
        const file = path.join(directory, name);
        const metadata = await lstat(file);
        if (!metadata.isFile()) return null;
        const report = parsePortalReport(metadata.size <= maxReportBytes ? await readFile(file, 'utf8').catch(() => '') : '', name);
        // A truncated newer report still supersedes older successes of its scope.
        const scope = /^ausn-executive-(full|current|20\d{2}-\d{2})-/.exec(name)?.[1];
        if (!report.year) report.year = /-(20\d{2})\d{4}T/.exec(name)?.[1];
        if (scope === 'full') report.kind = 'full';
        else {
          report.kind = 'month';
          report.periodKey ||= scope === 'current' ? /-(20\d{2})(\d{2})\d{2}T/.exec(name)?.slice(1).join('-') : scope;
        }
        report.modifiedAt = metadata.mtimeMs;
        return report;
      } catch { return null; }
    }));
    return results.filter((report): report is PortalReport => report !== null).sort((a, b) => {
      const stamp = (report: PortalReport) => report.sourceFile.match(/(\d{8}T\d{6})\.md$/)?.[1] || '';
      return stamp(b).localeCompare(stamp(a)) || a.sourceFile.localeCompare(b.sourceFile);
    });
  } catch { return []; }
}

export function portalFreshness(report: PortalReport | undefined, now = new Date()): { state: 'fresh' | 'saved' | 'blocked'; label: string } {
  if (!report?.available) return { state: 'blocked', label: report?.reason || 'Серверный отчёт пока не получен.' };
  const run = Date.parse(report.runTimeUtc!);
  const cutoff = Date.parse(`${report.dataCutoff}T00:00:00Z`);
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now);
  const lag = Date.parse(`${today}T00:00:00Z`) - cutoff;
  if (run > now.getTime() + 300_000 || lag < 0) return { state: 'blocked', label: 'Дата отчёта находится в будущем. Нужна проверка источника.' };
  if (now.getTime() - run > 36 * 3_600_000 || lag > 2 * 86_400_000) return { state: 'saved', label: 'Сохранённый расчёт. Для текущего контроля нужны свежие данные.' };
  return { state: 'fresh', label: 'Свежий серверный расчёт' };
}

export function portalForecast(report: PortalReport | undefined) {
  if (!report?.available || report.remaining === undefined || report.remaining <= 0) return undefined;
  const complete = report.monthlyIncome.filter((month) => !month.partial && month.periodKey.startsWith(`${report.year}-`)).sort((a, b) => a.periodKey.localeCompare(b.periodKey)).slice(-3);
  // The estimate is a labelled operational projection, never a tax total.
  // Require three consecutive closed months so gaps cannot masquerade as pace.
  if (complete.length !== 3) return undefined;
  const indexes = complete.map((month) => Number(month.periodKey.slice(0, 4)) * 12 + Number(month.periodKey.slice(5, 7)));
  if (indexes[1] !== indexes[0] + 1 || indexes[2] !== indexes[1] + 1) return undefined;
  const average = complete.reduce((sum, month) => sum + month.amount, 0) / complete.length;
  if (average <= 0) return undefined;
  const days = Math.ceil(report.remaining / (average / 30));
  const date = new Date(Date.parse(`${report.dataCutoff}T00:00:00Z`) + days * 86_400_000);
  const withinYear = Number.isFinite(date.getTime()) && String(date.getUTCFullYear()) === report.year;
  return { days, withinYear, months: complete.map((month) => month.periodKey), average, remaining: report.remaining, cutoff: report.dataCutoff!, date: Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : undefined };
}

export type PortalRisk = { level: 'unknown' | 'normal' | 'early' | 'plan' | 'urgent'; label: string };
export function portalRisk(report: PortalReport | undefined, now = new Date()): PortalRisk {
  if (portalFreshness(report, now).state !== 'fresh' || report?.usedPercent === undefined) return { level: 'unknown', label: 'Текущий риск не подтверждён' };
  const value = report.usedPercent;
  const forecast = portalForecast(report);
  const days = forecast?.withinYear ? forecast.days : undefined;
  if (value >= 100 || (report.remaining !== undefined && report.remaining < 0)) return { level: 'urgent', label: 'Лимит достигнут или превышен' };
  if (value >= 95 || (days !== undefined && days <= 30)) return { level: 'urgent', label: 'Срочно проверить лимит' };
  if (value >= 90 || (days !== undefined && days <= 45)) return { level: 'plan', label: 'Нужен план действий' };
  if (value >= 80 || (days !== undefined && days <= 60)) return { level: 'early', label: 'Заранее проверить лимит' };
  return { level: 'normal', label: 'Запас по лимиту есть' };
}

export type PortalSelection = ReturnType<typeof selectPortalReport>;
export function selectPortalReport(reports: PortalReport[], requested: { year?: string; period?: string }, now = new Date()) {
  const currentYear = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now).slice(0, 4);
  const years = [...new Set(reports.map((report) => report.year).filter((year): year is string => Boolean(year && validYear.test(year))))].sort().reverse();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  const year = requested.year && validYear.test(requested.year) ? requested.year : currentYear;
  const period = requested.period && validPeriod.test(requested.period) && requested.period.startsWith(`${year}-`) ? requested.period : 'year';
  const annualReport = reports.find((report) => report.year === year && report.kind === 'full');
  const exactMonth = period !== 'year' ? reports.find((report) => report.kind === 'month' && report.periodKey === period) : undefined;
  const summaryMonth = period !== 'year' && !exactMonth ? annualReport?.monthlyIncome.find((month) => month.periodKey === period) : undefined;
  const report = period === 'year' ? annualReport : exactMonth || (summaryMonth ? annualReport : undefined);
  const month = summaryMonth;
  const freshness = portalFreshness(report, now);
  const canShow = report?.available && freshness.state !== 'blocked';
  return { year, period, years, report, annualReport, month, freshness,
    base: canShow ? (period === 'year' ? report.ausnIncome : month?.amount ?? report.monthBase) : undefined,
    tax: canShow ? (period === 'year' ? report.estimatedTax : month ? undefined : report.monthTax) : undefined,
    structure: canShow ? (month || report.incomeStructure) : undefined,
    summaryOnly: Boolean(month),
    annualFreshness: portalFreshness(annualReport, now), risk: portalRisk(annualReport, now), forecast: portalForecast(annualReport),
  };
}

export function taxViewHref(view: string, year: string, period: string, basePath = '/admin/taxes') {
  const params = new URLSearchParams({ view, year, period });
  return `${basePath}?${params}`;
}
