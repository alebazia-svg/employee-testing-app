import type { PortalReport } from './ausn-portal-view';

// Both scopes must be valid; a fresh current-month result cannot hide a stale year.
export function ausnRefreshState(reports: PortalReport[], now = new Date()) {
  const period = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Moscow' }).format(now).slice(0, 7);
  const full = reports.find(r => r.kind === 'full' && r.year === period.slice(0, 4));
  const current = reports.find(r => r.kind === 'month' && r.periodKey === period);
  const ages = [full, current].map(r => r?.available && r.runTimeUtc ? (now.getTime() - Date.parse(r.runTimeUtc)) / 3_600_000 : Infinity);
  const ageHours = Math.max(...ages);
  return { fresh: ages.every(age => Number.isFinite(age) && age >= 0 && age < 20), ageHours };
}
