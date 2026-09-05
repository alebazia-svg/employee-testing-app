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

export function resolveAdminWorkdayControlCategory(input: {
  hasError: boolean;
  needsAttention: boolean;
  cannotVerify: boolean;
  isPending: boolean;
}): AdminWorkdayControlCategory {
  if (input.hasError) return 'error';
  if (input.needsAttention || input.cannotVerify) return 'attention';
  if (input.isPending) return 'pending';
  return 'normal';
}

export function isActiveWorkdayTimingViolation(kind: string) {
  return kind === 'task_overdue' || kind === 'missing_checkout' || kind === 'workday_not_started';
}

export function isAdminTaskOverviewProblem(tone: 'error' | 'attention' | 'pending' | 'normal') {
  return tone === 'error' || tone === 'attention';
}
