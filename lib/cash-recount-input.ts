/** Physical cash can be zero, but never negative. Do not apply to 1C balances. */
export function cashRecountInputError(amount: number | null): string | null {
  if (amount === null || !Number.isFinite(amount)) return 'Введите фактически пересчитанную сумму наличных';
  if (amount < 0) return 'Сумма наличных не может быть отрицательной';
  return null;
}
