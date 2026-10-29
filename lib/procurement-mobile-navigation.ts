export type ProcurementMobileSection = 'day' | 'schedule' | 'procurement';
export function procurementMobileSection(value: string | null): ProcurementMobileSection {
  return value === 'day' || value === 'schedule' ? value : 'procurement';
}

/** Old workday push/bookmark entry joins the same cabinet; never redirects to an external URL. */
export function procurementWorkdayEntry(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach(item => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  query.set('tab', params.tab === 'schedule' ? 'schedule' : 'day');
  return `/procurement?${query}`;
}
