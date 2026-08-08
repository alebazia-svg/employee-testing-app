import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertTriangle, CheckCircle2, CreditCard, RefreshCw } from 'lucide-react';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getCurrentUser } from '@/lib/auth';
import { getKkmEquipmentDiagnostics } from '@/lib/one-c';
import { getTBankTerminalOperations, getTBankTerminals } from '@/lib/tbank-acquiring';
import { normalizeOneCDateTime, reconcileTerminalOperations, tBankTerminalOneCMapping } from '@/lib/terminal-reconciliation';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatDate(value: string) {
  if (!value) return 'нет данных';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Europe/Moscow' }).format(date);
}

function formatOperationType(value: 'Debit' | 'Credit' | 'Other') {
  if (value === 'Debit') return 'Оплата';
  if (value === 'Credit') return 'Возврат';
  return 'Другая';
}

function isDateKey(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function moscowDayBounds(dateKey: string) {
  return {
    from: new Date(`${dateKey}T00:00:00+03:00`),
    till: new Date(`${dateKey}T23:59:59+03:00`),
  };
}

function formatMoney(value: number) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

export default async function AdminTBankAcquiringPage({
  searchParams,
}: {
  searchParams: { terminalKey?: string; date?: string };
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect('/login');
  if (currentUser.role !== 'ADMIN') redirect('/employee');

  const terminalsResult = await getTBankTerminals();
  const selectedTerminal = searchParams.terminalKey?.trim() || '';
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(new Date());
  const selectedDate = isDateKey(searchParams.date) ? searchParams.date : today;
  const { from: fromDate, till: tillDate } = moscowDayBounds(selectedDate);
  const oneCMapping = tBankTerminalOneCMapping[selectedTerminal] ?? null;
  const [operationsResult, oneCResult] = await Promise.all([
    selectedTerminal ? getTBankTerminalOperations({
        terminalKey: selectedTerminal,
        from: fromDate.toISOString(),
        till: tillDate.toISOString(),
      }) : Promise.resolve(null),
    selectedTerminal && oneCMapping
      ? getKkmEquipmentDiagnostics({ dateFrom: selectedDate, dateTo: selectedDate, limit: 1000 })
      : Promise.resolve(null),
  ]);
  const reconciliation = operationsResult?.ok && oneCResult?.ok && oneCMapping
    ? reconcileTerminalOperations({
        operations: operationsResult.operations,
        checks: oneCResult.recentChecks,
        cashRegisterName: oneCMapping.cashRegisterName,
      })
    : null;

  return (
    <AdminShell>
      <AdminBreadcrumbs current='Торговый эквайринг' />

      <div className='mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div>
          <h1 className='text-3xl font-extrabold text-slate-950'>Торговый эквайринг</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Read-only диагностика операций терминалов T‑Bank.</p>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Badge className={terminalsResult.environment === 'sandbox' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-800'}>
            {terminalsResult.environment === 'sandbox' ? 'Sandbox' : 'Production'}
          </Badge>
          <Badge className={terminalsResult.ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
            {terminalsResult.ok ? 'Подключено' : 'Недоступно'}
          </Badge>
        </div>
      </div>

      {!terminalsResult.ok ? (
        <Card className='mb-5 border-red-200 bg-red-50'>
          <div className='flex gap-3'>
            <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-red-700' />
            <div>
              <h2 className='font-extrabold text-red-950'>Интеграция пока не готова к чтению данных</h2>
              <p className='mt-1 text-sm font-semibold text-red-800'>{terminalsResult.error}</p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className='mb-5 border-green-200 bg-green-50'>
          <div className='flex gap-3'>
            <CheckCircle2 className='mt-0.5 h-5 w-5 shrink-0 text-green-700' />
            <div>
              <h2 className='font-extrabold text-green-950'>Соединение работает</h2>
              <p className='mt-1 text-sm font-semibold text-green-800'>Получено активных терминалов: {terminalsResult.terminals.length}. Ответ за {terminalsResult.durationMs} мс.</p>
            </div>
          </div>
        </Card>
      )}

      <section className='mb-5 grid gap-4 lg:grid-cols-[minmax(280px,0.7fr)_minmax(0,1.3fr)]'>
        <Card className='p-0'>
          <div className='border-b border-slate-200/80 px-5 py-4'>
            <h2 className='text-xl font-extrabold text-slate-950'>Терминалы</h2>
            <p className='mt-1 text-sm font-semibold text-slate-500'>Выберите терминал для чтения операций за последние 24 часа.</p>
          </div>
          <div className='grid gap-2 p-4'>
            {terminalsResult.terminals.map((terminal) => (
              <Link
                key={terminal.key}
                href={`/admin/workday/tbank?terminalKey=${encodeURIComponent(terminal.key)}&date=${selectedDate}`}
                className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-bold transition ${selectedTerminal === terminal.key ? 'border-green-300 bg-green-50 text-green-900' : 'border-slate-200 bg-white text-slate-800 hover:border-green-200 hover:bg-green-50/60'}`}
              >
                <span className='flex items-center gap-2'><CreditCard className='h-4 w-4' />{terminal.key}</span>
                <span className='text-xs text-slate-500'>ID {terminal.id}</span>
              </Link>
            ))}
            {terminalsResult.ok && terminalsResult.terminals.length === 0 ? (
              <p className='px-1 py-3 text-sm font-semibold text-slate-500'>Активные терминалы не найдены.</p>
            ) : null}
          </div>
        </Card>

        <Card className='p-0'>
          <div className='flex items-start justify-between gap-3 border-b border-slate-200/80 px-5 py-4'>
            <div>
              <h2 className='text-xl font-extrabold text-slate-950'>Операции</h2>
              <p className='mt-1 text-sm font-semibold text-slate-500'>{selectedTerminal ? `Терминал ${selectedTerminal} · ${selectedDate}` : 'Терминал не выбран'}</p>
            </div>
            {selectedTerminal ? (
              <Link href={`/admin/workday/tbank?terminalKey=${encodeURIComponent(selectedTerminal)}&date=${selectedDate}`} title='Обновить' className='flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'>
                <RefreshCw className='h-4 w-4' />
              </Link>
            ) : null}
          </div>

          {!operationsResult ? (
            <p className='p-5 text-sm font-semibold text-slate-500'>Выберите терминал слева.</p>
          ) : !operationsResult.ok ? (
            <div className='m-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800'>{operationsResult.error}</div>
          ) : operationsResult.operations.length === 0 ? (
            <p className='p-5 text-sm font-semibold text-slate-500'>За последние 24 часа операций не найдено.</p>
          ) : (
            <div className='overflow-x-auto'>
              <table className='min-w-full text-left text-sm'>
                <thead className='bg-slate-50 text-xs uppercase text-slate-500'>
                  <tr><th className='px-5 py-3'>Время</th><th className='px-5 py-3'>Тип</th><th className='px-5 py-3'>Карта</th><th className='px-5 py-3'>RRN</th><th className='px-5 py-3 text-right'>Сумма</th></tr>
                </thead>
                <tbody>
                  {operationsResult.operations.map((operation, index) => (
                    <tr key={`${operation.rrn}-${operation.transactionDate}-${index}`} className='border-t border-slate-200/80'>
                      <td className='whitespace-nowrap px-5 py-3 font-semibold text-slate-700'>{formatDate(operation.transactionDate)}</td>
                      <td className='px-5 py-3 font-semibold text-slate-700'>{formatOperationType(operation.type)}</td>
                      <td className='whitespace-nowrap px-5 py-3 font-semibold text-slate-700'>{operation.maskedCardNumber || 'скрыта'}</td>
                      <td className='px-5 py-3 font-mono text-xs text-slate-600'>{operation.rrn || 'нет данных'}</td>
                      <td className='whitespace-nowrap px-5 py-3 text-right font-extrabold text-slate-950'>{operation.amountRubles.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {selectedTerminal ? (
        <Card className='mb-5 p-0'>
          <div className='flex flex-col gap-3 border-b border-slate-200/80 px-5 py-4 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <h2 className='text-xl font-extrabold text-slate-950'>Теневая сверка с 1С</h2>
              <p className='mt-1 text-sm font-semibold text-slate-500'>Сотруднику результат не показывается и задания автоматически не закрываются.</p>
            </div>
            <form className='flex items-end gap-2' action='/admin/workday/tbank'>
              <input type='hidden' name='terminalKey' value={selectedTerminal} />
              <label className='text-xs font-bold text-slate-600'>Дата<input className='mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm' type='date' name='date' defaultValue={selectedDate} /></label>
              <button className='rounded-lg bg-slate-950 px-4 py-2 text-sm font-extrabold text-white' type='submit'>Проверить</button>
            </form>
          </div>
          {!oneCMapping ? (
            <p className='px-5 py-4 text-sm font-semibold text-amber-800'>Для этого терминала ещё не подтверждена касса 1С.</p>
          ) : !operationsResult?.ok || !oneCResult?.ok ? (
            <p className='px-5 py-4 text-sm font-semibold text-red-800'>Сверка недоступна: {operationsResult?.error || oneCResult?.error || 'источник данных не ответил'}.</p>
          ) : reconciliation ? (
            <div>
              <div className='grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4'>
                <div className='rounded-lg bg-green-50 p-4'><p className='text-xs font-bold uppercase text-green-700'>Совпало</p><p className='mt-1 text-2xl font-extrabold text-green-950'>{reconciliation.matched.length}</p></div>
                <div className='rounded-lg bg-rose-50 p-4'><p className='text-xs font-bold uppercase text-rose-700'>Только Т‑Банк</p><p className='mt-1 text-2xl font-extrabold text-rose-950'>{reconciliation.onlyTBank.length}</p></div>
                <div className='rounded-lg bg-rose-50 p-4'><p className='text-xs font-bold uppercase text-rose-700'>Только 1С</p><p className='mt-1 text-2xl font-extrabold text-rose-950'>{reconciliation.onlyOneC.length}</p></div>
                <div className='rounded-lg bg-blue-50 p-4'><p className='text-xs font-bold uppercase text-blue-700'>Возвраты</p><p className='mt-1 text-2xl font-extrabold text-blue-950'>{reconciliation.unsupportedReturns.length}</p></div>
              </div>
              <div className='border-t border-slate-200 px-5 py-4 text-sm font-semibold text-slate-600'>
                Касса 1С: <strong>{oneCMapping.cashRegisterName}</strong>. Сопоставление оплат выполняется по сумме и времени с допуском 5 минут.
                {reconciliation.unsupportedReturns.length > 0 ? ' Возвраты пока не считаются расхождением: текущий ответ 1С не подтверждает их полный состав.' : ''}
              </div>
              {(reconciliation.onlyTBank.length > 0 || reconciliation.onlyOneC.length > 0) ? (
                <div className='overflow-x-auto border-t border-slate-200'>
                  <table className='min-w-full text-left text-sm'>
                    <thead className='bg-slate-50 text-xs uppercase text-slate-500'><tr><th className='px-5 py-3'>Источник</th><th className='px-5 py-3'>Время</th><th className='px-5 py-3'>Документ</th><th className='px-5 py-3 text-right'>Сумма</th></tr></thead>
                    <tbody>
                      {reconciliation.onlyTBank.map((operation, index) => <tr key={`bank-${operation.rrn}-${index}`} className='border-t border-slate-200/80'><td className='px-5 py-3 font-bold text-rose-800'>Только Т‑Банк</td><td className='px-5 py-3'>{formatDate(operation.transactionDate)}</td><td className='px-5 py-3 font-mono text-xs'>{operation.rrn || '—'}</td><td className='px-5 py-3 text-right font-extrabold'>{formatMoney(operation.amountRubles)}</td></tr>)}
                      {reconciliation.onlyOneC.map((check) => <tr key={`onec-${check.ref}`} className='border-t border-slate-200/80'><td className='px-5 py-3 font-bold text-rose-800'>Только 1С</td><td className='px-5 py-3'>{formatDate(normalizeOneCDateTime(check.datetime))}</td><td className='px-5 py-3 font-semibold'>{check.number || check.ref}</td><td className='px-5 py-3 text-right font-extrabold'>{formatMoney(check.amount ?? 0)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card className='text-sm font-semibold text-slate-600'>
        Данные используются только для диагностики. Они пока не изменяют ответы сотрудников и не закрывают задания автоматически. Операции T‑Bank могут появляться с задержкой до двух часов.
      </Card>
    </AdminShell>
  );
}
