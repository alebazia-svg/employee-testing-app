'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

type ShiftTask = {
  id: number;
  title: string;
  category: string;
  plannedTimeMinutes: number | null;
  status: string;
  completedAt: string | null;
  numericValue: number | null;
  integerValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
  comment: string;
  handoverData: unknown;
};

type ShiftRun = {
  id: number;
  status: string;
  submittedAt: string | null;
  completedAt: string | null;
  tasks: ShiftTask[];
};

type WorkDayInfo = {
  status: string;
  endedAt: string | null;
} | null;

type Props = {
  department: string;
  run: ShiftRun | null;
  workDay: WorkDayInfo;
  nowMinutes: number;
};

type PhotoInfo = {
  storagePath?: unknown;
};

type PhotoPreview = {
  href: string;
  label: string;
};

function minutesToTime(minutes: number | null) {
  if (minutes === null) return 'без времени';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function formatTime(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ₽`;
}

function taskStatus(task: ShiftTask, nowMinutes: number) {
  if (task.status === 'done') return 'done';
  if (task.plannedTimeMinutes !== null && nowMinutes > task.plannedTimeMinutes) return 'overdue';
  return 'pending';
}

function taskStatusLabel(status: string) {
  if (status === 'done') return 'выполнено';
  if (status === 'overdue') return 'просрочено';
  return 'ожидает';
}

function badgeClass(status: string) {
  if (status === 'done' || status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'overdue' || status === 'not_submitted') return 'bg-amber-100 text-amber-800';
  if (status === 'none') return 'bg-slate-100 text-slate-600';
  return 'bg-blue-100 text-blue-800';
}

function yesNo(value: unknown) {
  if (value === true) return 'да';
  if (value === false) return 'нет';
  return '—';
}

function textValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function acquiringResult(task: ShiftTask) {
  if (task.integerValue === 0) return { label: 'Оплат не было', problem: false, legacy: false };
  if (task.integerValue === 1) return { label: 'Сверено', problem: false, legacy: false };
  if (task.integerValue === 2) return { label: 'Есть расхождение', problem: true, legacy: false };
  if (task.numericValue !== null && task.numericValue !== undefined) {
    return { label: 'Сумма введена по старой версии', problem: false, legacy: true };
  }
  return { label: 'Результат не указан', problem: false, legacy: false };
}

function discrepancyLabel(value: unknown) {
  if (value === 'surplus') return 'излишек';
  if (value === 'shortage') return 'недостача';
  if (value === 'none') return 'нет';
  return '—';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? (value[key] as Record<string, unknown>) : null;
}

function readPhotos(value: unknown) {
  return readRecord(value, 'photos');
}

function readPhoto(photos: Record<string, unknown> | null, key: string) {
  if (!photos || !isRecord(photos[key])) return null;
  return photos[key] as PhotoInfo;
}

function photoHref(photo: PhotoInfo | null) {
  const storagePath = typeof photo?.storagePath === 'string' ? photo.storagePath : '';
  if (!storagePath) return null;
  return `/api/admin/workday/shift-control-photo?path=${encodeURIComponent(storagePath)}`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/80'>
      <p className='text-[11px] font-bold uppercase text-slate-400'>{label}</p>
      <div className='mt-0.5 text-sm font-semibold text-slate-800'>{value}</div>
    </div>
  );
}

function PhotoRow({ label, photo, onPreview }: { label: string; photo: PhotoInfo | null; onPreview: (photo: PhotoPreview) => void }) {
  const href = photoHref(photo);
  return (
    <DetailRow
      label={label}
      value={
        <div className='flex flex-wrap items-center gap-2'>
          <span>{href ? 'Фото есть' : 'Фото нет'}</span>
          {href && (
            <>
              <button
                type='button'
                className='group block overflow-hidden rounded-md bg-white ring-1 ring-slate-200 transition hover:ring-slate-300'
                onClick={() => onPreview({ href, label })}
                aria-label={`${label}: открыть фото`}
              >
                <img src={href} alt={label} className='h-16 w-16 object-cover transition group-hover:scale-105' />
              </button>
              <a
                href={href}
                target='_blank'
                rel='noreferrer'
                className='inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100'
              >
                Открыть отдельно
                <ExternalLink className='h-3.5 w-3.5' />
              </a>
            </>
          )}
        </div>
      }
    />
  );
}

function TaskValue({ task, onPreview }: { task: ShiftTask; onPreview: (photo: PhotoPreview) => void }) {
  if (task.category === 'cash') {
    return <span>Сумма: {formatMoney(task.numericValue)}</span>;
  }
  if (task.category === 'acquiring') {
    const result = acquiringResult(task);
    return (
      <span className='inline-flex flex-wrap items-center gap-1.5'>
        <span className={result.problem ? 'font-extrabold text-amber-800' : result.legacy ? 'font-extrabold text-slate-500' : ''}>
          {result.label}
        </span>
        {task.numericValue !== null && task.numericValue !== undefined && <span>· сумма: {formatMoney(task.numericValue)}</span>}
        {task.comment && <span>· {task.comment}</span>}
      </span>
    );
  }
  if (task.category === 'credit') {
    return (
      <span>
        {task.integerValue ?? 0} кредитов · {formatMoney(task.numericValue)} · контрагенты проверены: {yesNo(task.booleanValue)}
        {task.comment ? ` · ${task.comment}` : ''}
      </span>
    );
  }
  if (task.category === 'opening') {
    const href = task.textValue ? `/api/admin/workday/shift-control-photo?path=${encodeURIComponent(task.textValue)}` : null;
    return (
      <span className='inline-flex flex-wrap items-center gap-2'>
        {href ? 'Фото есть' : 'Фото нет'}
        {href && (
          <>
            <button
              type='button'
              className='group block overflow-hidden rounded-md bg-white ring-1 ring-slate-200 transition hover:ring-slate-300'
              onClick={() => onPreview({ href, label: task.title })}
              aria-label={`${task.title}: открыть фото`}
            >
              <img src={href} alt={task.title} className='h-16 w-16 object-cover transition group-hover:scale-105' />
            </button>
            <a
              href={href}
              target='_blank'
              rel='noreferrer'
              className='inline-flex h-7 items-center gap-1 rounded-md bg-white px-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100'
            >
              Открыть отдельно
              <ExternalLink className='h-3.5 w-3.5' />
            </a>
          </>
        )}
      </span>
    );
  }
  if (task.category === 'handover') return <span>Сдача смены</span>;
  return <span>{task.comment || '—'}</span>;
}

function HandoverDetails({ data, department, onPreview }: { data: unknown; department: string; onPreview: (photo: PhotoPreview) => void }) {
  const personalCash = readRecord(data, 'personalCash');
  const storeClosing = readRecord(data, 'storeClosing');
  const photos = readPhotos(data);
  const comment = isRecord(data) ? data.comment : '';
  const isRetail = department === 'retail';

  if (!personalCash && !storeClosing) return null;

  return (
    <div className='grid gap-4'>
      {personalCash && (
        <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
          <h4 className='text-sm font-extrabold text-slate-950'>Сдача своей кассы</h4>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <PhotoRow label='Фото ведомости 1С' photo={readPhoto(photos, 'personalStatement')} onPreview={onPreview} />
            <DetailRow label='Остаток наличных' value={formatMoney(Number(personalCash.cashBalance ?? 0))} />
            {isRetail && <PhotoRow label='Фото чеков эквайринга' photo={readPhoto(photos, 'personalAcquiringReceipts')} onPreview={onPreview} />}
            <DetailRow label='Расхождение' value={discrepancyLabel(personalCash.discrepancyType)} />
            <DetailRow
              label='Сумма расхождения'
              value={personalCash.discrepancyAmount === null ? '—' : formatMoney(Number(personalCash.discrepancyAmount ?? 0))}
            />
            <DetailRow label='Комментарий' value={textValue(comment)} />
            {isRetail && <DetailRow label='Выемка' value={yesNo(personalCash.hadWithdrawal)} />}
            {isRetail && <DetailRow label='Сумма выемки' value={personalCash.withdrawalAmount === null ? '—' : formatMoney(Number(personalCash.withdrawalAmount ?? 0))} />}
            {isRetail && <DetailRow label='Сумма приходника' value={personalCash.cashOrderAmount === null ? '—' : formatMoney(Number(personalCash.cashOrderAmount ?? 0))} />}
            <DetailRow label='Инкассация' value={yesNo(personalCash.requiresEncashment)} />
            <DetailRow label='Сумма инкассации' value={personalCash.encashmentAmount === null ? '—' : formatMoney(Number(personalCash.encashmentAmount ?? 0))} />
            <PhotoRow label='Фото документа инкассации' photo={readPhoto(photos, 'encashmentDocument')} onPreview={onPreview} />
          </div>
        </section>
      )}

      {storeClosing && (
        <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
          <h4 className='text-sm font-extrabold text-slate-950'>Закрытие магазина</h4>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <PhotoRow label='Фото отчёта Сбербанка' photo={readPhoto(photos, 'sberbankTerminalReport')} onPreview={onPreview} />
            <DetailRow label='Сумма по Сбербанку' value={formatMoney(Number(storeClosing.sberbankTerminalTotal ?? 0))} />
            <DetailRow label='Операции Т-Банка' value={yesNo(storeClosing.hasTbankCredit)} />
            <PhotoRow label='Фото чеков / слипов Т-Банка' photo={readPhoto(photos, 'tbankReceipts')} onPreview={onPreview} />
            <PhotoRow label='Фото отчёта Т-Банка' photo={readPhoto(photos, 'tbankTerminalReport')} onPreview={onPreview} />
            <DetailRow
              label='Сумма по Т-Банку'
              value={storeClosing.tbankTerminalTotal === null ? '—' : formatMoney(Number(storeClosing.tbankTerminalTotal ?? 0))}
            />
            <PhotoRow label='Z-отчёт / чек закрытия смены' photo={readPhoto(photos, 'zReport')} onPreview={onPreview} />
          </div>
        </section>
      )}
    </div>
  );
}

export function AdminShiftControlDetails({ department, run, workDay, nowMinutes }: Props) {
  const [open, setOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoPreview | null>(null);
  const canUseShiftControl = department === 'retail' || department === 'wholesale';
  function closeDetails() {
    setSelectedPhoto(null);
    setOpen(false);
  }
  const summary = useMemo(() => {
    if (!canUseShiftControl) return { status: 'none', label: '—', completed: 0, total: 0, overdue: 0, handoverDone: false };
    if (!run) return { status: 'none', label: 'нет контроля', completed: 0, total: 0, overdue: 0, handoverDone: false };

    const completed = run.tasks.filter((task) => task.status === 'done').length;
    const overdue = run.tasks.filter((task) => taskStatus(task, nowMinutes) === 'overdue').length;
    const handoverDone = run.tasks.some((task) => task.category === 'handover' && task.status === 'done');
    const total = run.tasks.length;
    const status = completed === total && total > 0 ? 'completed' : overdue > 0 ? 'overdue' : handoverDone ? 'completed' : 'in_progress';
    const label = status === 'completed' ? 'выполнено' : status === 'overdue' ? 'есть просрочки' : 'в процессе';

    return { status, label, completed, total, overdue, handoverDone };
  }, [canUseShiftControl, nowMinutes, run]);

  const hasZReportInHandover = useMemo(() => {
    if (!run) return false;
    return run.tasks.some((task) => task.category === 'handover' && Boolean(photoHref(readPhoto(readPhotos(task.handoverData), 'zReport'))));
  }, [run]);

  const detailTasks = useMemo(() => {
    if (!run) return [];
    return run.tasks.filter((task) => !(task.category === 'closing' && hasZReportInHandover));
  }, [hasZReportInHandover, run]);

  if (!canUseShiftControl) return <span className='text-sm font-semibold text-slate-400'>—</span>;

  return (
    <div className='min-w-[220px]'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge className={badgeClass(summary.status)}>{summary.label}</Badge>
        {run && (
          <Button
            type='button'
            className='h-8 bg-slate-100 px-2.5 text-xs font-extrabold text-slate-700 shadow-none hover:bg-slate-200'
            onClick={() => setOpen(true)}
          >
            Подробнее
          </Button>
        )}
      </div>
      <div className='mt-1 grid gap-0.5 text-xs font-semibold text-slate-500'>
        {run ? (
          <>
            <span>Прогресс: {summary.completed}/{summary.total}</span>
            <span>Просрочено: {summary.overdue}</span>
            <span>День завершён: {workDay?.status === 'completed' || workDay?.endedAt ? 'да' : 'нет'}</span>
            <span>Смена сдана: {summary.handoverDone ? 'да' : 'нет'}</span>
          </>
        ) : (
          <span>Нет ShiftControlRun за день</span>
        )}
      </div>

      {open && run && (
        <div className='fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm' onClick={closeDetails}>
          <aside
            className='ml-auto flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl'
            onClick={(event) => event.stopPropagation()}
          >
            <header className='flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-5'>
              <div>
                <p className='text-sm font-semibold text-primary'>Контроль смены</p>
                <h3 className='mt-1 text-xl font-extrabold text-slate-950'>Детали контроля смены</h3>
                <div className='mt-2 flex flex-wrap gap-2'>
                  <Badge className={badgeClass(summary.status)}>{summary.label}</Badge>
                  <Badge className='bg-slate-100 text-slate-700'>Прогресс {summary.completed}/{summary.total}</Badge>
                  <Badge className={summary.overdue > 0 ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}>
                    Просрочки {summary.overdue}
                  </Badge>
                </div>
              </div>
              <Button
                type='button'
                className='h-9 w-9 shrink-0 bg-slate-100 p-0 text-slate-700 shadow-none hover:bg-slate-200'
                onClick={closeDetails}
                aria-label='Закрыть'
              >
                <X className='h-5 w-5' />
              </Button>
            </header>

            <div className='flex-1 overflow-y-auto p-5'>
              <div className='grid gap-5'>
                <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
                  <h4 className='text-sm font-extrabold text-slate-950'>Список задач</h4>
                  <div className='mt-3 grid gap-2'>
                    {detailTasks.map((task) => {
                      const status = taskStatus(task, nowMinutes);
                      return (
                        <div key={task.id} className='rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200/80'>
                          <div className='flex flex-wrap items-center justify-between gap-2'>
                            <p className='text-sm font-extrabold text-slate-950'>{task.title}</p>
                            <Badge className={badgeClass(status)}>{taskStatusLabel(status)}</Badge>
                          </div>
                          <div className='mt-1 grid gap-1 text-xs font-semibold text-slate-600 md:grid-cols-3'>
                            <span>План: {minutesToTime(task.plannedTimeMinutes)}</span>
                            <span>Выполнено: {formatTime(task.completedAt)}</span>
                            <TaskValue task={task} onPreview={setSelectedPhoto} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {run.tasks
                  .filter((task) => task.category === 'handover')
                  .map((task) => (
                    <HandoverDetails key={task.id} data={task.handoverData} department={department} onPreview={setSelectedPhoto} />
                  ))}
              </div>
            </div>
          </aside>
          {selectedPhoto && (
            <div className='fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4' onClick={() => setSelectedPhoto(null)}>
              <div className='flex max-h-full w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl' onClick={(event) => event.stopPropagation()}>
                <div className='flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3'>
                  <p className='min-w-0 truncate text-sm font-extrabold text-slate-950'>{selectedPhoto.label}</p>
                  <div className='flex shrink-0 items-center gap-2'>
                    <a
                      href={selectedPhoto.href}
                      target='_blank'
                      rel='noreferrer'
                      className='inline-flex h-8 items-center gap-1 rounded-md bg-slate-100 px-2.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200'
                    >
                      Открыть отдельно
                      <ExternalLink className='h-3.5 w-3.5' />
                    </a>
                    <Button
                      type='button'
                      className='h-8 w-8 bg-slate-100 p-0 text-slate-700 shadow-none hover:bg-slate-200'
                      onClick={() => setSelectedPhoto(null)}
                      aria-label='Закрыть фото'
                    >
                      <X className='h-4 w-4' />
                    </Button>
                  </div>
                </div>
                <div className='flex min-h-0 flex-1 items-center justify-center overflow-auto bg-slate-100 p-3'>
                  <img src={selectedPhoto.href} alt={selectedPhoto.label} className='max-h-[78vh] max-w-full object-contain' />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
