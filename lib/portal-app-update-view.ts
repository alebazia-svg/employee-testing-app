import { appStateText, sameRelease, type AppState } from './portal-app-observation';
import type { AppRelease } from './employee-app-update';
export type AppUpdateView = { version: string; builtAt: string; checkedAt: string; state: AppState; command?: { requestedAt: string; receivedAt?: string; completedAt?: string; target: AppRelease } | null };
export function appUpdateStatus(app: AppUpdateView | null | undefined, target: AppRelease | null | undefined, now: Date) {
  const age = app ? now.getTime() - Date.parse(app.checkedAt) : NaN;
  const fresh = Number.isFinite(age) && age >= -300000 && age < 86400000;
  if (!app) return { label: 'Версия ещё не сообщалась', reason: 'Устройство должно открыть обновлённый портал, чтобы сообщить свою сборку.', tone: 'unknown', canRequest: false, needsUpdate: false };
  if (!fresh) return { label: 'Нет свежих данных о версии', reason: 'Показана последняя известная версия. Для проверки сотруднику нужно открыть портал.', tone: 'unknown', canRequest: false, needsUpdate: false };
  if (!target) return { label: 'Не удалось сравнить версии', reason: 'Сведения устройства сохранены, но текущая опубликованная сборка не определена.', tone: 'unknown', canRequest: false, needsUpdate: false };
  if (sameRelease(app, target)) return { ...appStateText.current, tone: 'ok', canRequest: false, needsUpdate: false };
  const command = app.command;
  const pending = command && sameRelease(command.target, target) && !command.completedAt && now.getTime() - Date.parse(command.requestedAt) < 86400000;
  if (pending && !command.receivedAt) return { label: 'Запрос отправлен', reason: 'Ждём ответа выбранного подключения. Другие устройства не перезагружаются.', tone: 'unknown', canRequest: false, needsUpdate: true };
  const state = app.state === 'current' ? { label: 'Доступно обновление', reason: 'После последней проверки опубликована другая сборка. Портал проверит её автоматически.' } : appStateText[app.state];
  const failed = ['reload_failed', 'storage_failed', 'check_failed'].includes(app.state);
  return { ...state, tone: failed ? 'warning' : 'unknown', canRequest: (!pending || app.state === 'reload_failed') && (!command || now.getTime() - Date.parse(command.requestedAt) >= 300000), needsUpdate: true };
}
