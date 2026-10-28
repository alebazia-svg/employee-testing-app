import { validEmployeePayrollView, type EmployeePayrollView } from './employee-payroll-view';

type Request = (input: string, init?: RequestInit) => Promise<Response>;
export class EmployeePayrollAccessError extends Error {}

/** Each read has its own deadline. A slow 1C refresh must not consume the
 * stored projection's budget, nor may a cancelled month publish a late result. */
export async function loadEmployeePayroll(options: {
  month: string; request: Request; signal: AbortSignal; hasSaved: boolean;
  onStored: (value: EmployeePayrollView) => void;
  storedTimeoutMs?: number; refreshTimeoutMs?: number;
}): Promise<EmployeePayrollView> {
  const { month, request, signal } = options;
  const read = async (stored: boolean) => {
    const controller = new AbortController();
    let rejectCancelled!: (error: Error) => void;
    const cancelled = new Promise<never>((_, reject) => { rejectCancelled = reject; });
    const abort = () => {
      controller.abort();
      rejectCancelled(new Error('Загрузка отменена.'));
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const timer = setTimeout(() => {
      controller.abort();
      rejectCancelled(new Error('Не удалось обновить расчёт. Попробуйте ещё раз.'));
    }, stored ? options.storedTimeoutMs ?? 15000 : options.refreshTimeoutMs ?? 25000);
    try {
      const work = async () => {
        if (signal.aborted) throw new Error('Загрузка отменена.');
        const response = await request(`/api/employee/payroll?month=${encodeURIComponent(month)}${stored ? '&snapshot=stored' : ''}`, {
          cache: 'no-store', signal: controller.signal,
        });
        if ([401, 403, 404, 410].includes(response.status)) throw new EmployeePayrollAccessError('Войдите в приложение заново.');
        if (!response.ok) throw new Error('Не удалось обновить расчёт. Попробуйте ещё раз.');
        const result: unknown = await response.json();
        if (!validEmployeePayrollView(result, month)) throw new Error('Расчёт пока недоступен.');
        return result;
      };
      return await Promise.race([work(), cancelled]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
    }
  };
  if (!options.hasSaved) {
    try {
      const saved = await read(true);
      if (!signal.aborted && saved.state !== 'unavailable') options.onStored(saved);
    } catch (error) {
      // A missing/cold snapshot is not proof that the live read is unavailable.
      // Access loss is different: never continue with another private read.
      if (signal.aborted || error instanceof EmployeePayrollAccessError) throw error;
    }
  }
  if (signal.aborted) throw new Error('Загрузка отменена.');
  return read(false);
}
