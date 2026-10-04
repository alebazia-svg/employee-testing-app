// Use the completed handover audit, not the transient active-request snapshot.
export function completedWithoutEncashment(task: { status: string; handoverData?: unknown } | null | undefined) {
  if (task?.status !== 'done') return false;
  const data = task.handoverData;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const cash = (data as Record<string, unknown>).personalCash;
  if (!cash || typeof cash !== 'object' || Array.isArray(cash)) return false;
  const requestId = (cash as Record<string, unknown>).encashmentExceptionRequestId;
  return typeof requestId === 'string' && requestId.trim().length > 0;
}

// Current and historical system audit markers. A cross-midnight timestamp alone
// does not prove technical closure because a real shift may cross midnight.
export function hasTechnicalWorkdayClose(
  workDay: { comment?: string | null } | null | undefined,
  run?: { closingComment?: string | null } | null,
) {
  const text = `${workDay?.comment ?? ''}\n${run?.closingComment ?? ''}`.toLowerCase();
  return text.includes('предыдущий рабочий день закрыт позже. обязательные шаги пропущены.')
    || text.includes('закрыт без сдачи смены')
    || text.includes('закрыт позже без сдачи смены');
}

export function technicalWorkdayCloseTime(value: string | null) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'не указано';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function belongsInOperationalTaskOverview(taskStatus: string, technicalClose: boolean) {
  return !(technicalClose && taskStatus === 'missed');
}

export function workdayTaskProgressLabel(input: {
  completed: number;
  missed: number;
  total: number;
  technicalClose: boolean;
}) {
  if (input.technicalClose && input.missed > 0) return `Пропущено шагов: ${input.missed}`;
  return input.total > 0 ? `Выполнено ${input.completed} из ${input.total}` : 'Проверок пока нет';
}
