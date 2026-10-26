/** Presentation only. Never derives task priority, unread state or lifecycle. */
export type EmployeeNoticeKind = 'receipt' | 'checklist' | 'money' | 'encashment' | 'closing' | 'message' | 'schedule' | 'delivery' | 'notice';

export function employeeAttentionIconKind(kind: string): EmployeeNoticeKind {
  if (kind === 'schedule' || kind === 'receipt' || kind === 'encashment' || kind === 'closing' || kind === 'checklist') return kind;
  if (kind === 'cash' || kind === 'cash_issue') return 'money';
  return 'notice';
}

export function employeeReminderIconKind(action: { target: string; href: string }): EmployeeNoticeKind {
  if (action.target === 'schedule') return 'schedule';
  if (action.target === 'checklist') return 'checklist';
  if (action.target === 'cash_issue') return 'money';
  return employeeAttentionIconKind(new URL(action.href, 'https://employee.invalid').searchParams.get('attention') ?? '');
}

export function employeeInboxIconKind(item: { kind: string; taskId?: number | null; reviewId?: string | null; attentionKind?: string }): EmployeeNoticeKind {
  if (item.kind.endsWith('_reply')) return 'message';
  if (item.attentionKind) return employeeAttentionIconKind(item.attentionKind);
  if (item.reviewId || item.kind.startsWith('terminal_fiscal_review')) return 'receipt';
  if (['procurement_cash_issue', 'employee_expense_payable', 'procurement_collection_ready'].includes(item.kind)) return 'money';
  if (item.kind === 'cash_operation_created') return 'encashment';
  if (item.kind === 'procurement_delivery_ready') return 'delivery';
  if (item.kind.startsWith('schedule_')) return 'schedule';
  if (['workday_close_exception_decision', 'workday_closed_by_admin', 'early_finish_reminder'].includes(item.kind)) return 'closing';
  if (item.taskId || ['planned', 'overdue', 'overdue_repeat'].includes(item.kind)) return 'checklist';
  return 'notice';
}
