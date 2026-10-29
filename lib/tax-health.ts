import type { PortalReport } from './ausn-portal-view';
import { taxDocumentTypes } from './tax-document-types';

// "Что не работает": operational problems of the tax section in plain language.
// Each item says what is wrong and what to do; nothing here changes data.
export type HealthIssue = { id: string; level: 'error' | 'warning'; title: string; text: string; action?: string; documentId?: string };
export type HealthDocument = { id: string; documentType: string; status: string; originalName: string; createdAt: Date; coverageFrom?: string | null; coverageTo?: string | null; periodKey: string };

const processable = new Set(['AUSN_INCOME', 'ENS_OPERATIONS', 'AUSN_CALCULATION']);
const staleHours = 26; // daily refresh at 07:40 plus two hours of slack
const stuckMinutes = 20;
const moscowDate = (value?: string) => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow' }).format(new Date(value)) : 'неизвестно когда';

// Adapter failure strings are precise but technical; translate the common ones.
export function plainReportReason(reason?: string) {
  if (!reason) return 'Сервер не прислал расчёт.';
  if (/OFD/.test(reason)) return 'Не все чеки кассы получены из OFD, поэтому сервер не выдал суммы, чтобы не показать неполные цифры.';
  if (/1С/.test(reason)) return 'Не удалось получить данные из 1С.';
  if (/банковских/.test(reason)) return 'Не удалось получить банковские документы из 1С.';
  if (/оборван|не распознан|повреждены|запуска/.test(reason)) return 'Файл расчёта пришёл неполным или в неожиданном виде.';
  if (/будущем|позже даты/.test(reason)) return 'В расчёте неверная дата — нужна проверка сервера.';
  if (/не получен|не найден/.test(reason)) return 'Расчёт на сервере ещё не формировался.';
  return 'Расчёт не прошёл проверку полноты.';
}

export function taxHealth(input: { full?: PortalReport; current?: PortalReport; documents: HealthDocument[]; now: Date }): HealthIssue[] {
  const { full, current, documents, now } = input;
  const issues: HealthIssue[] = [];
  const latest = [full, current].filter((report): report is PortalReport => Boolean(report?.available)).sort((a, b) => Date.parse(b.runTimeUtc!) - Date.parse(a.runTimeUtc!))[0];
  if (!full?.available && !current?.available) {
    issues.push({ id: 'report-missing', level: 'error', title: 'Расчёт АУСН сейчас недоступен', text: plainReportReason(full?.reason || current?.reason), action: 'Цифры на странице не показываются, чтобы не ввести в заблуждение. Сообщите разработчику — нужна проверка сервера расчёта.' });
  } else {
    if (!full?.available) issues.push({ id: 'full-missing', level: 'warning', title: 'Нет годового расчёта по месяцам', text: full ? plainReportReason(full.reason) : 'Сервер ещё не сохранял расчёт за весь год.', action: 'Разбивка по месяцам и сверка с налоговой появятся после следующей обработки документа. Если не появились — сообщите разработчику.' });
    if (latest && now.getTime() - Date.parse(latest.runTimeUtc!) > staleHours * 3_600_000) issues.push({ id: 'stale', level: 'warning', title: `Цифры не обновлялись с ${moscowDate(latest.runTimeUtc)}`, text: `Данные по ${latest.dataCutoff?.split('-').reverse().join('.')}. Обычно цифры обновляются каждое утро — значит, последнее обновление не сработало, и лимит может быть ближе, чем показано.`, action: 'Нажмите «Обновить цифры сейчас». Если не получится — сообщите разработчику.' });
  }
  const processedTo = new Map<string, string>();
  for (const document of documents) if (document.status === 'PROCESSED') { const to = document.coverageTo || document.periodKey; if (to > (processedTo.get(document.documentType) || '')) processedTo.set(document.documentType, to); }
  for (const document of documents) {
    const name = taxDocumentTypes[document.documentType as keyof typeof taxDocumentTypes] || document.documentType;
    const to = document.coverageTo || document.periodKey;
    const superseded = (processedTo.get(document.documentType) || '') >= to;
    if (document.status === 'PROCESSING_FAILED' && !superseded) issues.push({ id: `failed-${document.id}`, documentId: document.id, level: 'error', title: `${name}: файл не обработан — загрузите ещё раз`, text: `«${document.originalName}» не обновил расчёт — данные из него не учтены в сверке.`, action: 'Загрузите этот файл ещё раз. Если ошибка повторится — проверьте, что выгрузка нужного вида (подсказка «Где взять» в списке документов).' });
    if (document.status === 'UPLOADED' && processable.has(document.documentType) && !superseded && now.getTime() - document.createdAt.getTime() > stuckMinutes * 60_000) issues.push({ id: `stuck-${document.id}`, documentId: document.id, level: 'warning', title: `${name}: обработка не завершилась — загрузите ещё раз`, text: `«${document.originalName}» загружен, но сервер не подтвердил пересчёт.`, action: 'Загрузите файл ещё раз — копия не создастся.' });
  }
  if (!documents.some((document) => document.documentType === 'USN_DECLARATION')) issues.push({ id: 'declaration', level: 'warning', title: 'Нет декларации УСН за период до перехода', text: 'Доход до 31.03.2026 входит в годовой лимит; декларация его подтверждает.', action: 'Загрузите декларацию один раз в разделе «Документы».' });
  if (!documents.some((document) => document.documentType === 'AUSN_TRANSITION_NOTICE')) issues.push({ id: 'transition', level: 'warning', title: 'Нет подтверждения перехода на АУСН', text: 'Документ хранится один раз и нужен при проверках.', action: 'Загрузите его в разделе «Документы».' });
  return issues.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1));
}
