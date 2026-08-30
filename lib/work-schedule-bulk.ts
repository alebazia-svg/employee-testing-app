export type BulkScheduleStatus = 'working' | 'off';

export type BulkScheduleChange = {
  date: string;
  status: BulkScheduleStatus;
};

export function buildBulkScheduleChanges(missingDates: string[], selectedWorkingDates: ReadonlySet<string>): BulkScheduleChange[] {
  return [...missingDates]
    .sort((left, right) => left.localeCompare(right))
    .map((date) => ({ date, status: selectedWorkingDates.has(date) ? 'working' : 'off' }));
}

export function bulkScheduleCounts(changes: BulkScheduleChange[]) {
  const workingDays = changes.filter((change) => change.status === 'working').length;
  return { workingDays, offDays: changes.length - workingDays, totalDays: changes.length };
}
