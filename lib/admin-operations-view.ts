import { terminalFiscalSourceIncomplete } from './terminal-fiscal-reason-view';
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
  'expense_request.cash_issue': { category: 'requests', typeLabel: 'Выдача денег', actionLabel: 'Открыть' },
  'procurement.receipt_added': {
    category: 'messages', typeLabel: 'Чек оплаты', actionLabel: 'Открыть чеки',
  },
  'procurement.delivery_manual_requested': {
    category: 'requests', typeLabel: 'Запрос подотчёта', actionLabel: 'Открыть подотчёт',
  },
  'workday_issue.employee_action': { category: 'messages', typeLabel: 'Ответ сотрудника', actionLabel: 'Открыть обсуждение' },
  'terminal_fiscal_review.help_requested': { category: 'messages', typeLabel: 'Просьба о помощи', actionLabel: 'Помочь сотруднику' },
  'terminal_fiscal_review.employee_action': { category: 'messages', typeLabel: 'Ответ по продаже', actionLabel: 'Открыть обсуждение' },
  'procurement.delivery_requested': {
    category: 'requests', typeLabel: 'Пополнение подотчёта', actionLabel: 'Открыть подотчёт',
  },
  'procurement.delivery_covered': {
    category: 'system', typeLabel: 'Подотчёт', actionLabel: 'Открыть подотчёт',
  },
  'procurement.payment_submitted': {
    category: 'requests',
    typeLabel: 'Оплата поставщику',
    actionLabel: 'Открыть закупки',
  },
  'procurement.payment_updated': {
    category: 'requests',
    typeLabel: 'Оплата поставщику',
    actionLabel: 'Открыть закупки',
  },
  'expense_request.created': {
    category: 'requests',
    typeLabel: 'Заявка на расход',
    actionLabel: 'Открыть заявку',
  },
  'tax.document_missing': {
    category: 'decisions',
    typeLabel: 'Документы ФНС',
    actionLabel: 'Открыть налоги',
  },
  'tax.limit_attention': {
    category: 'decisions',
    typeLabel: 'Лимит АУСН',
    actionLabel: 'Открыть налоги',
  },
  'workday_issue.employee_message': {
    category: 'messages',
    typeLabel: 'Сообщение сотрудника',
    actionLabel: 'Открыть обсуждение',
  },
  'workday.issue_carried': {
    category: 'system',
    typeLabel: 'Открытая ошибка сотрудника',
    actionLabel: 'Открыть ошибку',
  },
  'terminal_fiscal_review.employee_message': {
    category: 'messages',
    typeLabel: 'Сообщение по продаже',
    actionLabel: 'Открыть обсуждение',
  },
  'terminal_fiscal_review.created': {
    category: 'decisions',
    typeLabel: 'Проверка чека',
    actionLabel: 'Открыть проверку',
  },
  'terminal_fiscal_review.archived_unresolved': {
    category: 'decisions',
    typeLabel: 'Проверка чека',
    actionLabel: 'Открыть историю',
  },
  'workday.kkm_shift_close_attention': { category: 'decisions', typeLabel: 'Закрытие кассовой смены', actionLabel: 'Открыть контроль' },
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
  'work_schedule.coverage_gap': {
    category: 'requests',
    typeLabel: 'График отдела',
    actionLabel: 'Открыть график',
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
  eventType?: string | null;
  businessStatus?: string | null;
  reasonCode?: string | null;
  current?: boolean;
  employeeActionRequired?: boolean;
  sourceCompleted?: boolean;
  sourceDate?: string;
  today?: string;
}): AdminInboxSourceState {
  if (input.sourceType === 'supplier_payment_plan') {
    return input.businessStatus === 'SUBMITTED'
      ? { active: true, label: 'Ожидает решения', tone: 'attention' }
      : { active: false, label: 'Решение принято', tone: 'history' };
  }
  if (['procurement_delivery', 'procurement_delivery_request'].includes(input.sourceType)) {
    return input.current
      ? { active: true, label: 'Пополнение на контроле', tone: 'attention' }
      : { active: false, label: 'В истории', tone: 'history' };
  }
  if (input.sourceType === 'dependency') {
    return input.eventType === 'dependency.down'
      ? { active: true, label: 'Связь потеряна', tone: 'attention' }
      : input.eventType === 'dependency.recovered'
        ? { active: false, label: 'Работа восстановлена', tone: 'resolved' }
        : { active: false, label: 'Системное событие', tone: 'neutral' };
  }
  if (input.sourceType === 'infrastructure') {
    return input.eventType === 'infrastructure.down'
      ? { active: true, label: 'Сервис недоступен', tone: 'attention' }
      : input.eventType === 'infrastructure.recovered'
        ? { active: false, label: 'Работа восстановлена', tone: 'resolved' }
        : { active: false, label: 'Системное событие', tone: 'neutral' };
  }
  if (['expense_request', 'expense_cash_issue'].includes(input.sourceType)) {
    return input.current
      ? { active: true, label: 'Текущая заявка', tone: 'active' }
      : { active: false, label: 'В истории', tone: 'history' };
  }
  if (input.sourceType === 'work_schedule_coverage') return input.current ? {active:true,label:'Уточнить график',tone:'attention'} : {active:false,label:'Больше не актуально',tone:'resolved'};
  if (input.sourceType === 'tax_control') {
    return input.current
      ? { active: true, label: 'Документы ожидаются', tone: 'attention' }
      : { active: false, label: 'Период обновлён', tone: 'resolved' };
  }
  if (input.sourceType === 'tax_limit') {
    return input.current
      ? { active: true, label: 'Требует внимания', tone: 'attention' }
      : { active: false, label: 'Уровень риска изменился', tone: 'resolved' };
  }
  if (input.sourceType === 'workday_control_issue') {
    const active = input.businessStatus === 'open' && input.employeeActionRequired === true;
    return active
      ? { active: true, label: 'Проблема активна', tone: 'attention' }
      : { active: false, label: 'Исправлено', tone: 'resolved' };
  }
  if (input.sourceType === 'terminal_fiscal_review') {
    // Legacy outage-generated cases remain inspectable, without posing as an
    // unresolved business decision. Actual employee replies still need attention.
    if (['open', 'admin_review'].includes(input.businessStatus ?? '')
      && terminalFiscalSourceIncomplete(input.reasonCode ?? '')
      && !['terminal_fiscal_review.help_requested', 'terminal_fiscal_review.employee_action', 'terminal_fiscal_review.employee_message'].includes(input.eventType ?? '')) {
      return { active: false, label: 'Ожидаются данные источника', tone: 'neutral' };
    }
    if (input.businessStatus === 'open') return { active: true, label: 'Проверка активна', tone: 'attention' };
    if (input.businessStatus === 'admin_review') return { active: true, label: 'На контроле администратора', tone: 'active' };
    if (input.reasonCode === 'OWNER_ARCHIVED_UNRESOLVED') return { active: false, label: 'В истории · не исправлено', tone: 'history' };
    return { active: false, label: 'Закрыто', tone: 'resolved' };
  }
  if (input.sourceType === 'workday_close_exception') {
    if (input.sourceCompleted) return { active: false, label: 'Завершено', tone: 'resolved' };
    if (input.businessStatus === 'pending' && input.reasonCode?.startsWith('cash_encashment_') && input.sourceDate && input.today && input.sourceDate < input.today) return { active: false, label: 'Прошлая смена · без решения', tone: 'history' };
    if (input.businessStatus === 'pending') return { active: true, label: 'Ожидает решения', tone: 'attention' };
    if (input.businessStatus === 'approved') return { active: false, label: 'Разрешено администратором', tone: 'resolved' };
    if (input.businessStatus === 'rejected') return { active: false, label: 'Отклонено администратором', tone: 'history' };
  }
  if (input.sourceType === 'cash_operation') {
    if (input.businessStatus === 'one_c_error') return { active: true, label: 'Требуется ручное проведение', tone: 'attention' };
    if (input.businessStatus === 'manual_in_progress') return { active: true, label: 'Взято в ручную', tone: 'active' };
    if (input.businessStatus === 'retrying_1c') return { active: true, label: 'Проводится повторно', tone: 'active' };
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
