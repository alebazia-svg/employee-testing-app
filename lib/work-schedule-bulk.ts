export type BulkScheduleStatus = 'working' | 'off';

export type BulkScheduleChange = {
  date: string;
  status: BulkScheduleStatus;
  previousStatus?: BulkScheduleStatus | null;
};

// A snapshot taken when the editor opens protects saved days from background
// refreshes and lets the server reject concurrent changes instead of overwriting.
export function buildSchedulePlanChanges(original: Record<string, BulkScheduleStatus | null>, working: ReadonlySet<string>): BulkScheduleChange[] {
  return Object.entries(original).sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, previousStatus]) => {
    const status: BulkScheduleStatus = working.has(date) ? 'working' : 'off';
    return status === previousStatus ? [] : [{ date, status, previousStatus }];
  });
}

export function buildBulkScheduleChanges(missingDates: string[], selectedWorkingDates: ReadonlySet<string>): BulkScheduleChange[] {
  return [...missingDates]
    .sort((left, right) => left.localeCompare(right))
    .map((date) => ({ date, status: selectedWorkingDates.has(date) ? 'working' : 'off' }));
}

export function buildBulkScheduleEditChanges(
  editableDates: string[],
  selectedWorkingDates: ReadonlySet<string>,
  previousStatuses: ReadonlyMap<string, BulkScheduleStatus>,
): BulkScheduleChange[] {
  return [...editableDates]
    .sort((left, right) => left.localeCompare(right))
    .flatMap((date) => {
      const previousStatus = previousStatuses.get(date);
      if (!previousStatus) return [];
      const status: BulkScheduleStatus = selectedWorkingDates.has(date) ? 'working' : 'off';
      return status === previousStatus ? [] : [{ date, status, previousStatus }];
    });
}

export function bulkScheduleCounts(changes: BulkScheduleChange[]) {
  const workingDays = changes.filter((change) => change.status === 'working').length;
  return { workingDays, offDays: changes.length - workingDays, totalDays: changes.length };
}
