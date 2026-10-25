/** Bounded event vocabulary: never persist form values or arbitrary error text. */
export const handoverClientStages = {
  form_open: 'Открыта форма сдачи смены',
  submit: 'Запущена сдача смены',
  waiting: 'На экране показано: «Проверяем кассу…»',
  waiting_end: 'Ожидание проверки в приложении закончилось',
  save_error: 'На экране показана ошибка сдачи смены',
  network_error: 'На экране: «Нет связи с порталом. Когда связь появится, нажмите „Сдать смену“ ещё раз»',
  kkm_question: 'На экране открыт вопрос о закрытии кассы',
} as const;
export const handoverServerStages = {
  check_open: 'Проверка 1С: кассовая смена не закрыта',
  check_missing: 'Проверка: закрытие в 1С есть, подтверждения OFD пока нет',
  check_unavailable: 'Проверке не хватило данных — результат неизвестен',
  check_confirmed: 'Закрытие ККМ подтверждено системой',
} as const;
export type HandoverClientStage = keyof typeof handoverClientStages;
export type HandoverServerStage = keyof typeof handoverServerStages;
export type HandoverContext = { taskId: number; attemptId: string; stage: HandoverClientStage | HandoverServerStage; durationMs?: number };
export function readHandoverContext(value: unknown, server = false): HandoverContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (!Object.keys(p).every(k => ['taskId','attemptId','stage','durationMs'].includes(k))) return null;
  if (!Number.isSafeInteger(p.taskId) || Number(p.taskId) <= 0 || typeof p.attemptId !== 'string' || !/^[a-zA-Z0-9_-]{8,60}$/.test(p.attemptId)) return null;
  if (typeof p.stage !== 'string' || !Object.hasOwn(server ? handoverServerStages : handoverClientStages, p.stage)) return null;
  if (p.durationMs !== undefined && (p.stage !== 'waiting_end' || !Number.isSafeInteger(p.durationMs) || Number(p.durationMs) < 0 || Number(p.durationMs) > 21600000)) return null;
  return p as HandoverContext;
}
export function handoverEventTitle(stage: string) {
  return ({ ...handoverClientStages, ...handoverServerStages } as Record<string, string>)[stage] || 'Событие сдачи смены';
}
