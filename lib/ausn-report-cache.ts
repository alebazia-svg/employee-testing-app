import 'server-only';

import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export type AusnReportView = {
  available: boolean;
  reason?: string;
  sourceFile?: string;
  reportTitle?: string;
  periodKey?: string;
  codeVersion?: string;
  runTimeUtc?: string;
  dataCutoff?: string;
  agentApiUser?: string;
  agentApiVersion?: string;
  totalIncome?: number;
  remaining?: number;
  usedPercent?: number;
  monthlyIncome: Array<{ label: string; amount: number; partial: boolean }>;
  forecastDaysToLimit?: number;
  usnBaseline?: number;
  usnBaselineSource?: string;
  sourceCompleteness: Record<string, string>;
  attention: string[];
};

const moneyNumber = (value: string) => Number(value.replace(/[^\d,.-]/g, '').replace(/\s/g, '').replace(',', '.'));

function cell(markdown: string, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return markdown.match(new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([^|]+)\\|`, 'i'))?.[1]?.trim();
}

export function parseAusnReport(markdown: string, sourceFile = 'report.md'): AusnReportView {
  const reportTitle = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const periodKey = reportTitle?.match(/20\d{2}-\d{2}/)?.[0];
  const total = cell(markdown, 'Всего доходов года для лимита');
  const remaining = cell(markdown, 'Остаток до лимита');
  const percent = cell(markdown, 'Использовано лимита');
  const completenessBlock = markdown.split('## Полнота источников')[1]?.split('\n## ')[0] ?? '';
  const sourceCompleteness: Record<string, string> = {};
  for (const match of completenessBlock.matchAll(/^\|\s*([^|-][^|]*)\s*\|\s*([^|]+)\|$/gm)) {
    const key = match[1].trim();
    if (key !== 'Показатель' && !key.startsWith('---')) sourceCompleteness[key] = match[2].trim();
  }
  const attentionBlock = markdown.split('## Что требует внимания')[1]?.split('\n## ')[0] ?? '';
  const attention = [...attentionBlock.matchAll(/^-\s+(.+)$/gm)].map((match) => match[1].trim());
  const monthNames = 'январь|февраль|март|апрель|май|июнь|июль|август|сентябрь|октябрь|ноябрь|декабрь';
  const monthlyIncome = [...markdown.matchAll(new RegExp(`^\\|\\s*(${monthNames})\\s+20\\d{2}(\\s+по\\s+\\d{2}\\.\\d{2}\\.20\\d{2})?\\s*\\|\\s*([^|]+)\\|$`, 'gmi'))]
    .map((match) => ({ label: match[1], partial: Boolean(match[2]), amount: moneyNumber(match[3]) }))
    .filter((row) => Number.isFinite(row.amount));
  const recentComplete = monthlyIncome.filter((row) => !row.partial).slice(-3);
  const averageMonth = recentComplete.length ? recentComplete.reduce((sum, row) => sum + row.amount, 0) / recentComplete.length : 0;
  const remainingNumber = remaining ? moneyNumber(remaining) : undefined;
  const forecastDaysToLimit = remainingNumber !== undefined && remainingNumber > 0 && averageMonth > 0 ? Math.ceil(remainingNumber / (averageMonth / 30)) : undefined;
  const usnBaselineCell = cell(markdown, 'УСН до 31.03.2026');
  return {
    available: Boolean(reportTitle && total && remaining && percent), sourceFile, reportTitle, periodKey,
    codeVersion: cell(markdown, 'Версия кода отчёта'), runTimeUtc: cell(markdown, 'UTC run time'),
    dataCutoff: cell(markdown, 'Data cutoff'), agentApiUser: cell(markdown, 'AgentAPI пользователь'),
    agentApiVersion: cell(markdown, 'AgentAPI версия'), totalIncome: total ? moneyNumber(total) : undefined,
    remaining: remainingNumber, usedPercent: percent ? moneyNumber(percent) : undefined, monthlyIncome, forecastDaysToLimit,
    usnBaseline: usnBaselineCell ? moneyNumber(usnBaselineCell) : undefined,
    usnBaselineSource: /УСН до 31\.03\.2026[^\n]*по декларации/i.test(markdown) ? 'Декларация учтена production runner' : undefined,
    sourceCompleteness, attention,
    reason: reportTitle && total && remaining && percent ? undefined : 'Кэш найден, но не соответствует контракту исполнительного отчёта.',
  };
}

export async function loadAusnReportCatalog(): Promise<AusnReportView[]> {
  const directory = process.env.AUSN_REPORT_CACHE_DIR || '/app/runtime/ausn-reports';
  try {
    const names = await readdir(directory);
    const reports = await Promise.all(names.filter((name) => /\.(?:md|txt)$/i.test(name)).map(async (name) => parseAusnReport(await readFile(path.join(directory, name), 'utf8'), name)));
    return reports.filter((report) => report.reportTitle);
  } catch { return []; }
}

export async function loadCurrentAusnReport(): Promise<AusnReportView> {
  const directory = process.env.AUSN_REPORT_CACHE_DIR || '/app/runtime/ausn-reports';
  try {
    const names = await readdir(directory);
    const candidates = await Promise.all(names.filter((name) => /\.(?:md|txt)$/i.test(name)).map(async (name) => ({ name, modified: (await stat(path.join(directory, name))).mtimeMs })));
    candidates.sort((left, right) => right.modified - left.modified);
    for (const candidate of candidates) {
      const text = await readFile(path.join(directory, candidate.name), 'utf8');
      if (/Запрошенный период\s*\|\s*current/i.test(text) || /# Отчёт АУСН за 20\d{2}-\d{2}/.test(text)) return parseAusnReport(text, candidate.name);
    }
    return { available: false, reason: 'Свежий текущий отчёт production runner не найден.', sourceCompleteness: {}, attention: [], monthlyIncome: [] };
  } catch {
    return { available: false, reason: 'Кэш production runner пока не подключён к порталу.', sourceCompleteness: {}, attention: [], monthlyIncome: [] };
  }
}

export type TaxRisk = { level: 'unknown' | 'normal' | 'early' | 'plan' | 'urgent'; label: string; explanation: string };

export function assessTaxLimitRisk(report: AusnReportView): TaxRisk {
  if (!report.available || report.usedPercent === undefined) return { level: 'unknown', label: 'Нет достоверного прогноза', explanation: report.reason || 'Нет полного отчёта.' };
  if (report.usedPercent >= 95 || (report.forecastDaysToLimit !== undefined && report.forecastDaysToLimit <= 30)) return { level: 'urgent', label: 'Срочно проверить лимит', explanation: report.forecastDaysToLimit !== undefined && report.forecastDaysToLimit <= 30 ? `При среднем темпе трёх полных месяцев лимит может быть достигнут примерно через ${report.forecastDaysToLimit} дн.` : 'Использовано не менее 95% годового лимита.' };
  if (report.usedPercent >= 90 || (report.forecastDaysToLimit !== undefined && report.forecastDaysToLimit <= 45)) return { level: 'plan', label: 'Нужен план действий', explanation: report.forecastDaysToLimit !== undefined && report.forecastDaysToLimit <= 45 ? `При среднем темпе трёх полных месяцев лимит может быть достигнут примерно через ${report.forecastDaysToLimit} дн.` : 'Использовано не менее 90% годового лимита.' };
  if (report.usedPercent >= 80 || (report.forecastDaysToLimit !== undefined && report.forecastDaysToLimit <= 60)) return { level: 'early', label: 'Заранее проверить лимит', explanation: report.forecastDaysToLimit !== undefined && report.forecastDaysToLimit <= 60 ? `При среднем темпе трёх полных месяцев лимит может быть достигнут примерно через ${report.forecastDaysToLimit} дн.` : 'Использовано не менее 80% годового лимита.' };
  return { level: 'normal', label: 'Запас по лимиту есть', explanation: 'Использовано менее 80% годового лимита.' };
}
