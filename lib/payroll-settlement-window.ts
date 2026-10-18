/** Late payments must remain visible when reviewing a historical payroll month. */
export function payrollSettlementWindow(period: string, today: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)
    || !/^20\d{2}-\d{2}-\d{2}$/.test(today)
    || !Number.isFinite(Date.parse(today))
    || new Date(today).toISOString().slice(0, 10) !== today
    || period > today.slice(0, 7)) return null;
  return { dateFrom: `${period}-01`, dateTo: today };
}
