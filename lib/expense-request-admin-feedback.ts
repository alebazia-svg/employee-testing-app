export const EXPENSE_REQUEST_FEEDBACK_DECISIONS = [
  'normal',
  'clarification_required',
  'hint_unnecessary',
  'rule_change_required',
] as const;

export type ExpenseRequestFeedbackDecision = typeof EXPENSE_REQUEST_FEEDBACK_DECISIONS[number];
export type ExpenseRequestFeedbackScope = 'overall' | 'reason';

export function validateExpenseRequestFeedback(input: {
  decision: string;
  scope: string;
  reasonCode: string | null;
  comment: string;
}) {
  if (!EXPENSE_REQUEST_FEEDBACK_DECISIONS.includes(input.decision as ExpenseRequestFeedbackDecision)) return 'Некорректное решение.';
  if (input.scope !== 'overall' && input.scope !== 'reason') return 'Некорректное решение.';
  if (input.decision === 'rule_change_required' && !input.comment.trim()) return 'Опишите, как нужно изменить правило.';
  if (input.comment.length > 1000) return 'Комментарий должен быть не длиннее 1000 символов.';
  if (input.scope === 'reason' && !input.reasonCode) return 'Выберите конкретную подсказку.';
  if (input.scope === 'overall' && input.reasonCode) return 'Общий feedback не должен содержать reasonCode.';
  return null;
}
