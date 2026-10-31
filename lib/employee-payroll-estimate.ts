export const employeeEarningLabels = ['Выходы', 'Телефоны и техника', 'Аксессуары', 'Поклейка и услуги', 'Оптовые продажи', 'Финбокс'] as const;
export type EmployeeEarning = { label: typeof employeeEarningLabels[number]; amount: number };

// Display-only rounding: preserve the rounded total across its components.
// Never feed these approximate amounts back into ADMIN or 1C accounting.
export function roundEmployeeEarnings(parts: EmployeeEarning[] | undefined) {
  if (!parts || parts.length > employeeEarningLabels.length
    || new Set(parts.map(row => row.label)).size !== parts.length
    || parts.some(row => !employeeEarningLabels.includes(row.label) || !Number.isFinite(row.amount)
      || !Number.isSafeInteger(Math.round(row.amount * 100)))) return null;
  const total = parts.reduce((sum, row) => sum + row.amount, 0);
  if (!Number.isSafeInteger(Math.round(total * 100))) return null;
  const rounded = parts.map((row, index) => ({ ...row, index,
    amount: Math.floor(row.amount / 100) * 100,
    fraction: row.amount / 100 - Math.floor(row.amount / 100) }));
  const units = Math.round(total / 100);
  const remainder = units - rounded.reduce((sum, row) => sum + row.amount / 100, 0);
  if (remainder < 0 || remainder > parts.length) return null;
  [...rounded].sort((a, b) => b.fraction - a.fraction || a.index - b.index).slice(0, remainder)
    .forEach(row => { row.amount += 100; });
  return { estimatedAccrued: units * 100,
    earnings: rounded.filter(row => row.amount !== 0).map(({ label, amount }) => ({ label, amount })) };
}
