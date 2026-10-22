import { workdayNotificationThreadKey, type WorkdayNotificationThreadTarget } from './workday-notification-thread';

export type EmployeeInboxState = WorkdayNotificationThreadTarget & {
  readAt?: string | null;
  active?: boolean;
  sentAt?: string | null;
};

export function isNewEmployeeNotification(item: EmployeeInboxState) {
  return !item.readAt && item.active !== false;
}

export function employeeInboxSections<T extends EmployeeInboxState>(items: readonly T[]) {
  return {
    fresh: items.filter(isNewEmployeeNotification),
    history: items.filter(item => !isNewEmployeeNotification(item)),
  };
}

/** Apply only after the server acknowledges reading. Never pre-read newer reminders. */
export function acknowledgeEmployeeNotification<T extends EmployeeInboxState>(items: readonly T[], target: EmployeeInboxState, readAt: string): T[] {
  const key = workdayNotificationThreadKey(target);
  const cutoff = Date.parse(target.sentAt ?? '');
  return items.map(item => {
    const same = workdayNotificationThreadKey(item) === key;
    const sent = Date.parse(item.sentAt ?? '');
    const covered = item.id === target.id || (Number.isFinite(cutoff) && Number.isFinite(sent) && sent <= cutoff);
    return same && covered ? { ...item, readAt: item.readAt || readAt } : item;
  });
}
