import { readAppRelease, type AppRelease } from './employee-app-update';

export const appStates = ['checking', 'current', 'idle_wait', 'operation', 'form', 'upload', 'saving', 'unsent', 'safe_screen', 'check_failed', 'storage_failed', 'reloading', 'retry_wait', 'reload_failed'] as const;
export type AppState = typeof appStates[number];
export type AppObservation = AppRelease & { clientId: string; state: AppState; commandId?: string };
export type AppUpdateCommand = { id: string; clientId: string; target: AppRelease; requestedAt: string; requestedBy: number; receivedAt?: string; completedAt?: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function parseAppObservation(value: unknown): AppObservation | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (Object.keys(p).some(k => !['version', 'builtAt', 'clientId', 'state', 'commandId'].includes(k))) return null;
  const release = readAppRelease(p);
  if (!release || release.version.length > 50 || release.builtAt.length > 40 || typeof p.clientId !== 'string' || !uuid.test(p.clientId)
    || typeof p.state !== 'string' || !(appStates as readonly string[]).includes(p.state)
    || (p.commandId !== undefined && (typeof p.commandId !== 'string' || !uuid.test(p.commandId)))) return null;
  return { ...release, clientId: p.clientId, state: p.state as AppState, ...(p.commandId ? { commandId: p.commandId as string } : {}) };
}
export const sameRelease = (a: AppRelease, b: AppRelease) => a.version === b.version && a.builtAt === b.builtAt;
export function parseUpdateCommand(value: unknown): AppUpdateCommand | null {
  if (!value || typeof value !== 'object') return null;
  const p = value as AppUpdateCommand;
  return typeof p.id === 'string' && uuid.test(p.id) && typeof p.clientId === 'string' && uuid.test(p.clientId)
    && readAppRelease(p.target) && Number.isFinite(Date.parse(p.requestedAt)) && Number.isSafeInteger(p.requestedBy) ? p : null;
}
export function commandActive(command: AppUpdateCommand, now: Date) {
  return !command.completedAt && now.getTime() - Date.parse(command.requestedAt) < 86400000;
}
export const appStateText: Record<AppState, { label: string; reason: string }> = {
  checking: { label: 'Проверяем обновление', reason: 'Устройство проверяет доступную версию.' },
  current: { label: 'Актуальная версия', reason: 'Устройство сообщило текущую сборку портала.' },
  idle_wait: { label: 'Ждёт паузы в работе', reason: 'Обновление начнётся после короткой паузы без действий.' },
  operation: { label: 'Ждёт завершения операции', reason: 'На рабочем экране есть незавершённая операция. Безопасная перезагрузка пока отложена.' },
  form: { label: 'Открыта форма', reason: 'Сотрудник работает с формой. Обновление не прервёт ввод данных.' },
  upload: { label: 'Идёт загрузка файла', reason: 'Обновление ждёт завершения загрузки или выбора файла.' },
  saving: { label: 'Идёт сохранение', reason: 'Обновление ждёт завершения сохранения данных.' },
  unsent: { label: 'Есть неотправленные данные', reason: 'Сначала портал должен отправить сохранённые на устройстве операции.' },
  safe_screen: { label: 'Ждёт рабочего экрана', reason: 'В этом разделе безопасная перезагрузка не подключена. Нужно перейти на главный экран рабочего дня. Открытые формы не будут прерваны.' },
  check_failed: { label: 'Не удалось проверить обновление', reason: 'Проверка версии не завершилась. Портал повторит её автоматически; точная причина пока не подтверждена.' },
  storage_failed: { label: 'Обновление отложено', reason: 'Не удалось сохранить отметку попытки в браузере. Автоперезагрузка остановлена, чтобы избежать повторов.' },
  reloading: { label: 'Ожидаем новую версию', reason: 'Устройство начало обновление. Успех будет подтверждён только после обращения новой сборки.' },
  retry_wait: { label: 'Повторим проверку позже', reason: 'После предыдущей попытки выдерживается пауза, чтобы не перезагружать приложение постоянно.' },
  reload_failed: { label: 'Обновление не завершилось', reason: 'После ограниченных попыток устройство снова сообщает старую сборку. Автоперезапуски остановлены. Можно запросить повторную проверку.' },
};
