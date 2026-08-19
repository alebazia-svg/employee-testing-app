export type AdminWorkdayControlFilter = 'active' | 'all' | 'error' | 'attention' | 'pending' | 'normal';
export type AdminWorkdayControlCategory = 'error' | 'attention' | 'pending' | 'normal';

export function adminWorkdayControlFilter(value: string | undefined, fallback: AdminWorkdayControlFilter): AdminWorkdayControlFilter {
  if (value === 'active' || value === 'all' || value === 'error' || value === 'attention' || value === 'pending' || value === 'normal') return value;
  return fallback;
}

export function matchesAdminWorkdayControlFilter(category: AdminWorkdayControlCategory, filter: AdminWorkdayControlFilter) {
  if (filter === 'all') return true;
  if (filter === 'active') return category === 'error' || category === 'attention';
  return category === filter;
}

export function isActiveWorkdayTimingViolation(kind: string) {
  return kind === 'task_overdue' || kind === 'missing_checkout' || kind === 'workday_not_started';
}
