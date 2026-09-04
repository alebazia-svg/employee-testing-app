export type FinboxPreview = {
  amount: string;
  accrualCount: number;
  transfers: number;
  opening: number | null;
  closing: number | null;
  difference: number | null;
  errors: string[];
  notes: string[];
};

const monthNames = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];

function dateIn(text: string): string | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  const ru = text.match(/\b(\d{2})\.(\d{2})\.(\d{4})\b/);
  const date = iso ? iso[0] : ru ? `${ru[3]}-${ru[2]}-${ru[1]}` : null;
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date ? date : null;
}

function amountIn(text: string): number | null {
  const compact = text.replace(/[\s\u00a0\u202f]/g, '').replace(/(?:₽|руб\.?|RUB)$/i, '');
  if (!/^-?\d+(?:[.,]\d{1,2})?$/.test(compact)) return null;
  const value = Math.round(Number(compact.replace(',', '.')) * 100);
  return Number.isSafeInteger(value) && Math.abs(value) <= 1_000_000_000 ? value : null;
}

// Parse pasted TSV/Markdown as text only. No HTML execution or remote requests.
// Balances are reconciliation controls, never employee earnings or advances.
export function parseFinboxReport(text: string, periodKey: string): FinboxPreview {
  const errors: string[] = [];
  const notes: string[] = [];
  let accrual = 0, accrualCount = 0, transfers = 0;
  let opening: number | null = null, closing: number | null = null, closingDate: string | null = null;
  const operationDates: string[] = [];
  const seen = new Set<string>();
  const finish = (): FinboxPreview => {
    const difference = opening !== null && closing !== null ? (opening + accrual + transfers - closing) / 100 : null;
    return { amount: (accrual / 100).toFixed(2), accrualCount, transfers: transfers / 100, opening: opening === null ? null : opening / 100, closing: closing === null ? null : closing / 100, difference, errors: [...new Set(errors)], notes };
  };
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) { errors.push('Выберите месяц зарплаты.'); return finish(); }
  if (!text.trim()) { errors.push('Вставьте таблицу Finbox целиком, с начальным и конечным остатком.'); return finish(); }
  if (text.length > 100_000 || text.split('\n').length > 2000) { errors.push('Слишком большой отчёт. Вставьте один месяц, не более 2000 строк.'); return finish(); }
  const lines = text.replace(/&#x20;|&#32;|&nbsp;|&#160;/gi, ' ').replace(/\*\*/g, '').split(/\r?\n/);
  for (const [index, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || /^[|\s:-]+$/.test(line) || /^(?:\|\s*)?Дата\s*[|\t]/i.test(line)) continue;
    const cells = line.split(line.includes('\t') ? '\t' : '|').map(s => s.trim()).filter(Boolean);
    const value = amountIn(cells.at(-1) ?? '');
    const date = dateIn(line);
    const prefix = `Строка ${index + 1}: `;
    if (/начальный остаток/i.test(line)) {
      if (opening !== null || value === null || date !== `${periodKey}-01`) errors.push(prefix + 'проверьте начальный остаток и начало выбранного месяца.');
      else opening = value;
      continue;
    }
    if (/конечный остаток/i.test(line)) {
      if (closing !== null || value === null || !date?.startsWith(periodKey + '-')) errors.push(prefix + 'проверьте конечный остаток и выбранный месяц.');
      else { closing = value; closingDate = date; }
      continue;
    }
    if (value === null || !date?.startsWith(periodKey + '-')) { errors.push(prefix + 'не распознана сумма или дата не относится к выбранному месяцу.'); continue; }
    const key = cells.join('|').toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(key)) errors.push(prefix + 'повтор операции. Проверьте, не вставлен ли отчёт дважды.');
    seen.add(key);
    operationDates.push(date);
    if (/начисление агентского вознаграждения/i.test(line)) {
      const attributed = line.toLowerCase().match(/за\s+([а-яё]+)\s+(\d{4})/);
      if (attributed) {
        const month = monthNames.indexOf(attributed[1]) + 1;
        const attributedPeriod = `${attributed[2]}-${String(month).padStart(2, '0')}`;
        if (attributedPeriod !== periodKey) {
          if (value !== 0) errors.push(prefix + 'начисление за другой месяц — требуется ручная проверка.');
          else notes.push('Нулевое начисление за другой месяц не влияет на итог.');
        }
      }
      accrual += value;
      if (value !== 0) accrualCount += 1;
    } else if (/перечисление на карту/i.test(line)) {
      if (value > 0) errors.push(prefix + 'перечисление на карту должно быть отрицательным.');
      transfers += value;
    } else errors.push(prefix + 'неизвестный вид операции — требуется ручная проверка.');
  }
  if (opening === null || closing === null) errors.push('Нужны начальный и конечный остатки для контрольной сверки.');
  if (closingDate && operationDates.some(date => date > closingDate!)) errors.push('Есть операции позже даты конечного остатка.');
  if (!operationDates.length) errors.push('В отчёте не найдены операции.');
  if (accrual < 0 || accrual > 1_000_000_000) errors.push('Итог начислений вне допустимого диапазона. Проверьте отчёт.');
  const result = finish();
  if (result.difference !== null && result.difference !== 0) result.errors.push('Остатки не сходятся. Возможно, таблица скопирована не полностью.');
  return result;
}
