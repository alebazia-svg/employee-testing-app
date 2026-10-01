export function validateFinboxPeriod(period: unknown): string {
  if (typeof period !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Выберите месяц зарплаты.');
  return period;
}
export function validateFinboxWrite(body: unknown) {
  const input = body as { period?: unknown; amount?: unknown; revision?: unknown } | null;
  const period = validateFinboxPeriod(input?.period);
  const amount = typeof input?.amount === 'string' ? input.amount.trim().replace(',', '.') : '';
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) throw new Error('Введите сумму от нуля, не более двух знаков после запятой.');
  const amountCents = Math.round(Number(amount) * 100);
  if (!Number.isSafeInteger(amountCents) || amountCents > 1_000_000_000) throw new Error('Сумма превышает допустимый предел.');
  if (!Number.isInteger(input?.revision) || Number(input?.revision) < 0) throw new Error('Обновите сохранённые данные перед изменением.');
  return { period, amountCents, revision: Number(input!.revision) };
}
export type FinboxPeriodRead = { periodKey: string; amount: string | null; revision: number; savedAt: string | null; locked: boolean; lockReason: string };
