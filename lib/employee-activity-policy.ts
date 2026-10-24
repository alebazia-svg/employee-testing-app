export const activitySections = {
  day: 'Рабочий день', schedule: 'График', payroll: 'Моя зарплата', notifications: 'Уведомления',
  cash: 'Заявки и выдача денег', receipts: 'Проверка чеков', learning: 'Обучение',
  procurement: 'Закупки',
} as const;
export type ActivitySection = keyof typeof activitySections;
export type ActivityInput = { key: string; kind: 'visit'; section: ActivitySection } |
  { key: string; kind: 'notification_open'; notificationId: number };
export const ACTIVITY_RETENTION_DAYS = 90;
export const ACTIVITY_DAILY_LIMIT = 600;
export function parseActivityInput(value: unknown): ActivityInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.key !== 'string' || !/^[a-zA-Z0-9_-]{8,80}$/.test(p.key)) return null;
  if (p.kind === 'visit' && Object.keys(p).every(k => ['key','kind','section'].includes(k)) && typeof p.section === 'string' && Object.hasOwn(activitySections, p.section)) return p as ActivityInput;
  if (p.kind === 'notification_open' && Object.keys(p).every(k => ['key','kind','notificationId'].includes(k)) && typeof p.notificationId === 'number' && Number.isSafeInteger(p.notificationId) && p.notificationId > 0) return p as ActivityInput;
  return null;
}
export function activityDayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00+03:00`);
  if (!Number.isFinite(+start) || new Date(+start + 3 * 3600000).toISOString().slice(0,10) !== date) return null;
  return { start, end: new Date(+start + 86400000) };
}
export function activityRoute(path: string): ActivitySection | null {
  if (path === '/employee') return null; // Internal tabs own the root view.
  if (path === '/employee/payroll') return 'payroll';
  if (path.startsWith('/employee/cash-issue')) return 'cash';
  if (path.startsWith('/employee/issues/') || path.startsWith('/employee/payment-checks/')) return 'receipts';
  if (path.startsWith('/employee/attestations') || path.startsWith('/employee/learning')) return 'learning';
  if (path === '/procurement' || path.startsWith('/procurement/')) return 'procurement';
  return null;
}
