export type AdminInboxCategory = 'requests' | 'messages' | 'decisions' | 'system';

export type AdminInboxEventMeta = {
  category: AdminInboxCategory;
  typeLabel: string;
  actionLabel: string;
};

export type AdminInboxSourceState = {
  active: boolean;
  label: string;
  tone: 'attention' | 'active' | 'resolved' | 'history' | 'neutral';
};

const eventMeta: Record<string, AdminInboxEventMeta> = {
  'expense_request.created': {
    category: 'requests',
    typeLabel: 'Заявка на расход',
    actionLabel: 'Открыть заявку',
  },
  'workday_issue.employee_message': {
    category: 'messages',
    typeLabel: 'Сообщение сотрудника',
    actionLabel: 'Открыть обсуждение',
  },
  'terminal_fiscal_review.employee_message': {
    category: 'messages',
    typeLabel: 'Сообщение по продаже',
    actionLabel: 'Открыть обсуждение',
  },
  'workday.close_exception_requested': {
    category: 'decisions',
    typeLabel: 'Требуется решение администратора',
    actionLabel: 'Принять решение',
  },
  'workday.cash_encashment_exception_requested': {
    category: 'decisions',
    typeLabel: 'Инкассация',
    actionLabel: 'Принять решение',
  },
  'workday.cash_operation_failed': {
    category: 'decisions',
    typeLabel: 'Ошибка инкассации',
    actionLabel: 'Открыть контроль дня',
  },
};

export function adminInboxEventMeta(type: string): AdminInboxEventMeta {
  return eventMeta[type] ?? {
    category: 'system',
    typeLabel: 'Системное событие',
    actionLabel: 'Открыть',
  };
}

export function adminInboxSourceState(input: {
  sourceType: string;
  businessStatus?: string | null;
  reasonCode?: string | null;
  current?: boolean;
  employeeActionRequired?: boolean;
  sourceCompleted?: boolean;
}): AdminInboxSourceState {
  if (input.sourceType === 'expense_request') {
    return input.current
      ? { active: true, label: 'Текущая заявка', tone: 'active' }
      : { active: false, label: 'В истории', tone: 'history' };
  }
  if (input.sourceType === 'workday_control_issue') {
    const active = input.businessStatus === 'open' && input.employeeActionRequired === true;
    return active
      ? { active: true, label: 'Проблема активна', tone: 'attention' }
      : { active: false, label: 'Исправлено', tone: 'resolved' };
  }
  if (input.sourceType === 'terminal_fiscal_review') {
    if (input.businessStatus === 'open') return { active: true, label: 'Проверка активна', tone: 'attention' };
    if (input.businessStatus === 'admin_review') return { active: true, label: 'На контроле администратора', tone: 'active' };
    return { active: false, label: 'Закрыто', tone: 'resolved' };
  }
  if (input.sourceType === 'workday_close_exception') {
    if (input.sourceCompleted) return { active: false, label: 'Завершено', tone: 'resolved' };
    if (input.businessStatus === 'pending') return { active: true, label: 'Ожидает решения', tone: 'attention' };
    if (input.businessStatus === 'approved' && input.reasonCode?.startsWith('cash_encashment_')) return { active: true, label: 'Инкассация на контроле', tone: 'attention' };
    if (input.businessStatus === 'approved') return { active: false, label: 'Разрешено администратором', tone: 'resolved' };
    if (input.businessStatus === 'rejected') return { active: false, label: 'Отклонено администратором', tone: 'history' };
  }
  if (input.sourceType === 'cash_operation') {
    if (input.businessStatus === 'one_c_error') return { active: true, label: 'Требуется ручное проведение', tone: 'attention' };
    if (input.businessStatus === 'resolved_manual') return { active: false, label: 'Подтверждено вручную', tone: 'resolved' };
    return { active: false, label: 'Проведено в 1С', tone: 'resolved' };
  }
  return { active: false, label: 'Событие', tone: 'neutral' };
}

export function adminInboxActionLabel(input: {
  sourceType: string;
  defaultLabel: string;
  sourceState: AdminInboxSourceState;
}) {
  if (input.sourceType === 'workday_close_exception' && !input.sourceState.active) return 'Открыть решение';
  if ((input.sourceType === 'workday_control_issue' || input.sourceType === 'terminal_fiscal_review') && !input.sourceState.active) return 'Открыть историю';
  return input.defaultLabel;
}

export type TodayEmployee = { id: number };
export type TodaySchedule = { userId: number; status: string };
export type TodayWorkday = { userId: number; endedAt: Date | null; status: string };

export function summarizeAdminToday(input: {
  employees: TodayEmployee[];
  schedules: TodaySchedule[];
  workdays: TodayWorkday[];
}) {
  const scheduleByUser = new Map(input.schedules.map((entry) => [entry.userId, entry]));
  const workdayByUser = new Map(input.workdays.map((entry) => [entry.userId, entry]));
  const result = { working: 0, completed: 0, notStarted: 0, off: 0, unscheduled: 0 };

  for (const employee of input.employees) {
    const workday = workdayByUser.get(employee.id);
    const schedule = scheduleByUser.get(employee.id);
    if (workday?.endedAt || workday?.status === 'completed') result.completed += 1;
    else if (workday) result.working += 1;
    else if (schedule?.status === 'working') result.notStarted += 1;
    else if (schedule?.status === 'off') result.off += 1;
    else result.unscheduled += 1;
  }

  return result;
}

export function adminInboxCategoryLabel(category: AdminInboxCategory) {
  return ({
    requests: 'Заявки',
    messages: 'Сообщения',
    decisions: 'Мои решения',
    system: 'Система',
  } as const)[category];
}
