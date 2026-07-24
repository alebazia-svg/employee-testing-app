'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
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
  startedAt: string;
  endedAt: string | null;
  shiftLabel: string;
  lateMinutes: number;
  comment: string;
} | null;

type Props = {
  employeeName: string;
  department: string;
  departmentName: string;
  scheduleLabel: string;
  run: ShiftRun | null;
  workDay: WorkDayInfo;
  dateKey: string;
  nowMinutes: number;
  autoChecks?: ShiftAutoCheck[];
  initialOpen?: boolean;
  closeHref?: string;
  previousEmployee?: EmployeeNavigation | null;
  nextEmployee?: EmployeeNavigation | null;
};

type EmployeeNavigation = {
  name: string;
  href: string;
};

export type ShiftAutoCheck = {
  id: string;
  taskId: number;
  label: string;
  status: 'matched' | 'mismatch' | 'partial' | 'waiting' | 'unavailable';
  summary: string;
  evidence?: string;
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

function moscowDateAndMinutes(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Moscow',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function taskStatus(task: ShiftTask, dateKey: string, nowMinutes: number) {
  if (task.status === 'done') {
    if (task.plannedTimeMinutes === null || !task.completedAt) return 'done';
    const completed = moscowDateAndMinutes(task.completedAt);
    if (completed.dateKey > dateKey || (completed.dateKey === dateKey && completed.minutes > task.plannedTimeMinutes)) {
      return 'late';
    }
    return 'done';
  }
  if (task.plannedTimeMinutes !== null && nowMinutes > task.plannedTimeMinutes) return 'overdue';
  return 'pending';
}

function taskStatusLabel(status: string) {
  if (status === 'done') return 'выполнено';
  if (status === 'late') return 'выполнено с опозданием';
  if (status === 'overdue') return 'просрочено';
  return 'ожидает';
}

function badgeClass(status: string) {
  if (status === 'done' || status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'late' || status === 'overdue' || status === 'not_submitted') return 'bg-amber-100 text-amber-800';
  if (status === 'none') return 'bg-slate-100 text-slate-600';
  return 'bg-blue-100 text-blue-800';
}

function autoCheckBadge(status: ShiftAutoCheck['status']) {
  if (status === 'matched') return { label: '1С: совпало', className: 'bg-green-100 text-green-800' };
  if (status === 'mismatch') return { label: '1С: расхождение', className: 'bg-rose-100 text-rose-800' };
  if (status === 'partial') return { label: '1С: частично', className: 'bg-blue-100 text-blue-800' };
  if (status === 'waiting') return { label: '1С: ожидает', className: 'bg-slate-100 text-slate-700' };
  return { label: '1С: недоступна', className: 'bg-amber-100 text-amber-800' };
}

function autoCheckSummary(autoChecks: ShiftAutoCheck[]) {
  const mismatchCount = autoChecks.filter((check) => check.status === 'mismatch').length;
  const matchedCount = autoChecks.filter((check) => check.status === 'matched').length;
  const incompleteCount = autoChecks.filter((check) => (
    check.status === 'partial'
    || check.status === 'waiting'
    || check.status === 'unavailable'
  )).length;

  if (mismatchCount > 0) {
    return { label: `расхождений ${mismatchCount}`, className: 'bg-rose-100 text-rose-800', problem: true };
  }
  if (autoChecks.length === 0) {
    return { label: 'нет проверок', className: 'bg-slate-100 text-slate-700', problem: false };
  }
  if (incompleteCount > 0) {
    return {
      label: `совпало ${matchedCount}, не полностью ${incompleteCount}`,
      className: 'bg-blue-100 text-blue-800',
      problem: false,
    };
  }
  return { label: `совпало ${matchedCount}`, className: 'bg-green-100 text-green-800', problem: false };
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

function creditResult(task: ShiftTask) {
  if (task.integerValue === 0) return { label: 'Операций Т-Банка не было', problem: false };
  if (task.integerValue === 1) return { label: 'Проверка выполнена', problem: false };
  if (task.integerValue === 2) return { label: 'Есть проблема', problem: true };
  return { label: 'Результат не указан', problem: true };
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
    const result = creditResult(task);
    return (
      <span className='inline-flex flex-wrap items-center gap-1.5'>
        <span className={result.problem ? 'font-extrabold text-amber-800' : ''}>{result.label}</span>
        {task.comment && <span>· {task.comment}</span>}
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
  const reserveCash = readRecord(data, 'reserveCash');
  const storeClosing = readRecord(data, 'storeClosing');
  const photos = readPhotos(data);
  const comment = isRecord(data) ? data.comment : '';
  const isRetail = department === 'retail';

  if (!personalCash && !reserveCash && !storeClosing) return null;

  return (
    <div className='grid gap-4'>
      {personalCash && (
        <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
          <h4 className='text-sm font-extrabold text-slate-950'>Сдача своей кассы</h4>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <PhotoRow label='Фото ведомости 1С' photo={readPhoto(photos, 'personalStatement')} onPreview={onPreview} />
            <DetailRow label='Остаток наличных' value={formatMoney(Number(personalCash.cashBalance ?? 0))} />
            {isRetail && <DetailRow label='Оплаты Сбербанка' value={yesNo(personalCash.hasSberbankAcquiring)} />}
            {isRetail && <PhotoRow label='Фото чеков Сбербанка' photo={readPhoto(photos, 'personalAcquiringReceipts')} onPreview={onPreview} />}
            {isRetail && <DetailRow label='Операции Т-Банка' value={yesNo(personalCash.hasTbankCredit)} />}
            <DetailRow label='Расхождение' value={discrepancyLabel(personalCash.discrepancyType)} />
            <DetailRow
              label='Сумма расхождения'
              value={personalCash.discrepancyAmount === null ? '—' : formatMoney(Number(personalCash.discrepancyAmount ?? 0))}
            />
            <DetailRow label='Комментарий' value={textValue(comment)} />
            <DetailRow label='Инкассация' value={yesNo(personalCash.requiresEncashment)} />
            <DetailRow label='Сумма инкассации' value={personalCash.encashmentAmount === null ? '—' : formatMoney(Number(personalCash.encashmentAmount ?? 0))} />
            <PhotoRow label='Фото документа инкассации' photo={readPhoto(photos, 'encashmentDocument')} onPreview={onPreview} />
          </div>
        </section>
      )}

      {reserveCash && (
        <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
          <h4 className='text-sm font-extrabold text-slate-950'>Резерв</h4>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <DetailRow
              label='Наличные в резерве'
              value={reserveCash.cashBalance === null || reserveCash.cashBalance === undefined ? '—' : formatMoney(Number(reserveCash.cashBalance))}
            />
          </div>
        </section>
      )}

      {storeClosing && (
        <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
          <h4 className='text-sm font-extrabold text-slate-950'>Закрытие магазина</h4>
          <div className='mt-3 grid gap-2 sm:grid-cols-2'>
            <PhotoRow label='Фото сверки итогов Сбербанка' photo={readPhoto(photos, 'sberbankTerminalReport')} onPreview={onPreview} />
            <DetailRow label='Сумма сверки Сбербанка' value={formatMoney(Number(storeClosing.sberbankTerminalTotal ?? 0))} />
            <DetailRow label='Операции Т-Банка' value={yesNo(storeClosing.hasTbankCredit)} />
            <PhotoRow label='Фото чеков Т-Банка' photo={readPhoto(photos, 'tbankReceipts')} onPreview={onPreview} />
            <PhotoRow label='Фото сверки итогов Т-Банка' photo={readPhoto(photos, 'tbankTerminalReport')} onPreview={onPreview} />
            <DetailRow
              label='Сумма сверки Т-Банка'
              value={storeClosing.tbankTerminalTotal === null ? '—' : formatMoney(Number(storeClosing.tbankTerminalTotal ?? 0))}
            />
            <PhotoRow label='Фото чека закрытия смены' photo={readPhoto(photos, 'zReport')} onPreview={onPreview} />
          </div>
        </section>
      )}
    </div>
  );
}

function HandoverOverview({ data, department }: { data: unknown; department: string }) {
  const personalCash = readRecord(data, 'personalCash');
  const reserveCash = readRecord(data, 'reserveCash');
  const storeClosing = readRecord(data, 'storeClosing');
  const photos = readPhotos(data);
  const photoKeys = department === 'retail'
    ? ['personalStatement', 'personalAcquiringReceipts', 'encashmentDocument', 'sberbankTerminalReport', 'tbankReceipts', 'tbankTerminalReport', 'zReport']
    : ['personalStatement', 'encashmentDocument', 'sberbankTerminalReport', 'tbankReceipts', 'tbankTerminalReport', 'zReport'];
  const photoCount = photoKeys.filter((key) => Boolean(photoHref(readPhoto(photos, key)))).length;

  if (!personalCash && !reserveCash && !storeClosing) return null;

  return (
    <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
      <h4 className='text-sm font-extrabold text-slate-950'>Сдача смены</h4>
      <div className='mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2'>
        <DetailRow
          label='Своя касса'
          value={personalCash?.cashBalance === null || personalCash?.cashBalance === undefined
            ? '—'
            : formatMoney(Number(personalCash.cashBalance))}
        />
        <DetailRow
          label='Резерв'
          value={reserveCash?.cashBalance === null || reserveCash?.cashBalance === undefined
            ? '—'
            : formatMoney(Number(reserveCash.cashBalance))}
        />
        {department === 'retail' ? (
          <DetailRow label='Сбербанк' value={yesNo(personalCash?.hasSberbankAcquiring)} />
        ) : null}
        <DetailRow label='Т-Банк' value={yesNo(storeClosing?.hasTbankCredit ?? personalCash?.hasTbankCredit)} />
        <DetailRow label='Инкассация' value={yesNo(personalCash?.requiresEncashment)} />
        <DetailRow label='Фото приложено' value={photoCount} />
      </div>
    </section>
  );
}

type ReviewedTask = {
  task: ShiftTask;
  status: string;
  autoChecks: ShiftAutoCheck[];
};

function TaskDetailCard({
  item,
  tone,
  onPreview,
}: {
  item: ReviewedTask;
  tone: 'attention' | 'unverified' | 'normal' | 'planned';
  onPreview: (photo: PhotoPreview) => void;
}) {
  const toneClass = {
    attention: 'border-amber-200 bg-amber-50/60',
    unverified: 'border-blue-200 bg-blue-50/50',
    normal: 'border-green-200 bg-green-50/40',
    planned: 'border-slate-200 bg-white',
  }[tone];
  const hasMismatch = item.autoChecks.some((check) => check.status === 'mismatch');
  const needsTimingReview = item.status === 'late' || item.status === 'overdue';

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-extrabold text-slate-950'>{item.task.title}</p>
        <Badge className={badgeClass(item.status)}>{taskStatusLabel(item.status)}</Badge>
      </div>
      <div className='mt-2 grid gap-1 text-xs font-semibold text-slate-600 sm:grid-cols-3'>
        <span>План: {minutesToTime(item.task.plannedTimeMinutes)}</span>
        <span>Выполнено: {formatTime(item.task.completedAt)}</span>
        <TaskValue task={item.task} onPreview={onPreview} />
      </div>
      {item.autoChecks.length > 0 ? (
        <div className='mt-3 grid gap-2'>
          {item.autoChecks.map((check) => {
            const badge = autoCheckBadge(check.status);
            return (
              <div key={check.id} className='rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge className={badge.className}>{badge.label}</Badge>
                  <span className='text-xs font-extrabold text-slate-800'>{check.label}</span>
                </div>
                <p className='mt-1 text-xs font-semibold leading-relaxed text-slate-600'>{check.summary}</p>
                {check.evidence ? (
                  <details className='mt-1'>
                    <summary className='cursor-pointer text-[11px] font-bold text-slate-500'>Технические детали</summary>
                    <p className='mt-1 text-[11px] font-semibold leading-relaxed text-slate-500'>{check.evidence}</p>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {tone === 'attention' ? (
        <p className='mt-2 text-xs font-extrabold text-amber-800'>
          Что сделать: {hasMismatch ? 'сверить данные сотрудника с 1С и подтверждающими материалами.' : needsTimingReview ? 'проверить причину нарушения времени.' : 'проверить выполнение шага.'}
        </p>
      ) : null}
    </div>
  );
}

function TaskGroup({
  title,
  items,
  tone,
  defaultOpen,
  onPreview,
}: {
  title: string;
  items: ReviewedTask[];
  tone: 'attention' | 'unverified' | 'normal' | 'planned';
  defaultOpen: boolean;
  onPreview: (photo: PhotoPreview) => void;
}) {
  if (items.length === 0) return null;

  return (
    <details open={defaultOpen} className='group rounded-xl bg-white ring-1 ring-slate-200'>
      <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3'>
        <span className='text-sm font-extrabold text-slate-950'>{title} · {items.length}</span>
        <span className='text-xs font-extrabold text-slate-500 group-open:hidden'>Открыть</span>
        <span className='hidden text-xs font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
      </summary>
      <div className='grid gap-2 border-t border-slate-200 p-3'>
        {items.map((item) => (
          <TaskDetailCard key={item.task.id} item={item} tone={tone} onPreview={onPreview} />
        ))}
      </div>
    </details>
  );
}

export function AdminShiftControlDetails({
  employeeName,
  department,
  departmentName,
  scheduleLabel,
  run,
  workDay,
  dateKey,
  nowMinutes,
  autoChecks = [],
  initialOpen = false,
  closeHref,
  previousEmployee,
  nextEmployee,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoPreview | null>(null);
  const canUseShiftControl = department === 'retail' || department === 'wholesale';
  const closeDetails = useCallback(() => {
    setSelectedPhoto(null);
    setOpen(false);
    if (initialOpen && closeHref) {
      router.replace(closeHref, { scroll: false });
    }
  }, [closeHref, initialOpen, router]);
  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDetails();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDetails, open]);
  const summary = useMemo(() => {
    if (!canUseShiftControl) return { status: 'none', label: '—', completed: 0, total: 0, overdue: 0, handoverDone: false };
    if (!run) return { status: 'none', label: 'нет контроля', completed: 0, total: 0, overdue: 0, handoverDone: false };

    const completed = run.tasks.filter((task) => task.status === 'done').length;
    const overdue = run.tasks.filter((task) => {
      const status = taskStatus(task, dateKey, nowMinutes);
      return status === 'overdue' || status === 'late';
    }).length;
    const handoverDone = run.tasks.some((task) => task.category === 'handover' && task.status === 'done');
    const total = run.tasks.length;
    const status = overdue > 0 ? 'overdue' : completed === total && total > 0 ? 'completed' : handoverDone ? 'completed' : 'in_progress';
    const label = status === 'completed' ? 'выполнено' : status === 'overdue' ? 'есть нарушения времени' : 'в процессе';

    return { status, label, completed, total, overdue, handoverDone };
  }, [canUseShiftControl, dateKey, nowMinutes, run]);

  const hasZReportInHandover = useMemo(() => {
    if (!run) return false;
    return run.tasks.some((task) => task.category === 'handover' && Boolean(photoHref(readPhoto(readPhotos(task.handoverData), 'zReport'))));
  }, [run]);

  const detailTasks = useMemo(() => {
    if (!run) return [];
    return run.tasks.filter((task) => !(task.category === 'closing' && hasZReportInHandover));
  }, [hasZReportInHandover, run]);
  const autoChecksByTask = useMemo(() => {
    const result = new Map<number, ShiftAutoCheck[]>();
    for (const check of autoChecks) {
      result.set(check.taskId, [...(result.get(check.taskId) ?? []), check]);
    }
    return result;
  }, [autoChecks]);
  const taskGroups = useMemo(() => {
    const groups: Record<'attention' | 'unverified' | 'normal' | 'planned', ReviewedTask[]> = {
      attention: [],
      unverified: [],
      normal: [],
      planned: [],
    };

    for (const task of detailTasks) {
      const status = taskStatus(task, dateKey, nowMinutes);
      const taskAutoChecks = autoChecksByTask.get(task.id) ?? [];
      const item = { task, status, autoChecks: taskAutoChecks };
      if (status === 'late' || status === 'overdue' || taskAutoChecks.some((check) => check.status === 'mismatch')) {
        groups.attention.push(item);
      } else if (taskAutoChecks.some((check) => (
        check.status === 'partial'
        || check.status === 'waiting'
        || check.status === 'unavailable'
      ))) {
        groups.unverified.push(item);
      } else if (status === 'done') {
        groups.normal.push(item);
      } else {
        groups.planned.push(item);
      }
    }

    return groups;
  }, [autoChecksByTask, dateKey, detailTasks, nowMinutes]);
  const autoSummary = autoCheckSummary(autoChecks);
  const handoverTask = run?.tasks.find((task) => task.category === 'handover') ?? null;

  if (!canUseShiftControl) return <span className='text-sm font-semibold text-slate-400'>—</span>;

  return (
    <div>
      {run ? (
        <Button
          type='button'
          className={`h-8 px-3 text-xs font-extrabold shadow-none ${
            taskGroups.attention.length > 0
              ? 'bg-amber-100 text-amber-900 hover:bg-amber-200'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
          onClick={() => setOpen(true)}
        >
          {taskGroups.attention.length > 0 ? 'Проверить' : 'Подробнее'}
        </Button>
      ) : (
        <span className='text-xs font-semibold text-slate-400'>Нет чек-листа</span>
      )}

      {open && run && typeof document !== 'undefined' ? createPortal(
        <div className='fixed inset-0 z-[100] bg-slate-950/55 p-0 backdrop-blur-sm sm:p-3' onClick={closeDetails}>
          <div
            className='mx-auto flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 shadow-2xl sm:h-[calc(100dvh-1.5rem)] sm:rounded-2xl'
            onClick={(event) => event.stopPropagation()}
            role='dialog'
            aria-modal='true'
            aria-label={`Контроль смены: ${employeeName}`}
          >
            <header className='flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6'>
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-primary'>Контроль смены · {dateKey}</p>
                <h3 className='mt-0.5 truncate text-xl font-extrabold text-slate-950 sm:text-2xl'>{employeeName}</h3>
                <p className='mt-0.5 truncate text-xs font-semibold text-slate-500 sm:text-sm'>
                  {departmentName} · {scheduleLabel} · {workDay?.shiftLabel ?? 'смена не задана'}
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                <div className='hidden items-center gap-2 md:flex'>
                  {previousEmployee ? (
                    <Link
                      href={previousEmployee.href}
                      className='inline-flex h-9 items-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200'
                      title={previousEmployee.name}
                    >
                      <ChevronLeft className='h-4 w-4' />
                      Предыдущий
                    </Link>
                  ) : (
                    <span className='inline-flex h-9 items-center gap-1 rounded-lg bg-slate-50 px-3 text-xs font-extrabold text-slate-300'>
                      <ChevronLeft className='h-4 w-4' />
                      Предыдущий
                    </span>
                  )}
                  {nextEmployee ? (
                    <Link
                      href={nextEmployee.href}
                      className='inline-flex h-9 items-center gap-1 rounded-lg bg-slate-100 px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-200'
                      title={nextEmployee.name}
                    >
                      Следующий
                      <ChevronRight className='h-4 w-4' />
                    </Link>
                  ) : (
                    <span className='inline-flex h-9 items-center gap-1 rounded-lg bg-slate-50 px-3 text-xs font-extrabold text-slate-300'>
                      Следующий
                      <ChevronRight className='h-4 w-4' />
                    </span>
                  )}
                </div>
                <Button
                  type='button'
                  className='h-9 w-9 shrink-0 bg-slate-100 p-0 text-slate-700 shadow-none hover:bg-slate-200'
                  onClick={closeDetails}
                  aria-label='Закрыть'
                >
                  <X className='h-5 w-5' />
                </Button>
              </div>
            </header>
            {(previousEmployee || nextEmployee) ? (
              <div className='flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2 md:hidden'>
                {previousEmployee ? (
                  <Link href={previousEmployee.href} className='inline-flex min-w-0 items-center gap-1 text-xs font-extrabold text-slate-700'>
                    <ChevronLeft className='h-4 w-4 shrink-0' />
                    <span className='truncate'>{previousEmployee.name}</span>
                  </Link>
                ) : <span />}
                {nextEmployee ? (
                  <Link href={nextEmployee.href} className='inline-flex min-w-0 items-center gap-1 text-xs font-extrabold text-slate-700'>
                    <span className='truncate'>{nextEmployee.name}</span>
                    <ChevronRight className='h-4 w-4 shrink-0' />
                  </Link>
                ) : <span />}
              </div>
            ) : null}

            <div className='grid gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-2 sm:px-6 xl:grid-cols-4'>
              <div className={`rounded-xl border-l-4 bg-slate-50 px-3 py-2 ring-1 ring-slate-200 ${
                workDay?.status === 'completed' ? 'border-l-green-500' : 'border-l-amber-500'
              }`}>
                <p className='text-xs font-bold uppercase text-slate-400'>День</p>
                <p className='mt-0.5 text-base font-extrabold text-slate-950'>
                  {workDay?.status === 'completed' || workDay?.endedAt ? 'Завершён' : workDay ? 'Идёт' : 'Не начат'}
                </p>
                <p className='text-xs font-semibold text-slate-500'>
                  {workDay ? `${formatTime(workDay.startedAt)}–${formatTime(workDay.endedAt)}` : 'Нет отметок'}
                </p>
              </div>
              <div className={`rounded-xl border-l-4 bg-slate-50 px-3 py-2 ring-1 ring-slate-200 ${
                summary.overdue > 0 ? 'border-l-amber-500' : 'border-l-green-500'
              }`}>
                <p className='text-xs font-bold uppercase text-slate-400'>Время</p>
                <p className='mt-0.5 text-base font-extrabold text-slate-950'>{summary.overdue}</p>
                <p className='text-xs font-semibold text-slate-500'>нарушений времени</p>
              </div>
              <div className={`rounded-xl border-l-4 bg-slate-50 px-3 py-2 ring-1 ring-slate-200 ${
                summary.completed === summary.total && summary.total > 0 ? 'border-l-green-500' : 'border-l-amber-500'
              }`}>
                <p className='text-xs font-bold uppercase text-slate-400'>Чек-лист</p>
                <p className='mt-0.5 text-base font-extrabold text-slate-950'>{summary.completed}/{summary.total}</p>
                <p className='text-xs font-semibold text-slate-500'>{summary.handoverDone ? 'смена сдана' : 'смена не сдана'}</p>
              </div>
              <div className={`rounded-xl border-l-4 bg-slate-50 px-3 py-2 ring-1 ring-slate-200 ${
                autoSummary.problem
                  ? 'border-l-rose-500'
                  : autoChecks.length === 0
                    ? 'border-l-slate-400'
                    : autoChecks.some((check) => check.status !== 'matched')
                      ? 'border-l-blue-500'
                      : 'border-l-green-500'
              }`}>
                <p className='text-xs font-bold uppercase text-slate-400'>Сверка 1С</p>
                <p className='mt-0.5 text-base font-extrabold text-slate-950'>{autoSummary.label}</p>
                <p className='text-xs font-semibold text-slate-500'>автоматические проверки</p>
              </div>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6'>
              <div className='grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(380px,0.8fr)]'>
                <main className='grid content-start gap-4'>
                  {taskGroups.attention.length === 0 ? (
                    <div className='rounded-xl border border-green-200 bg-green-50 px-4 py-3'>
                      <p className='text-sm font-extrabold text-green-950'>Действий по чек-листу не требуется</p>
                      <p className='mt-1 text-xs font-semibold text-green-800'>Критичных расхождений и просроченных шагов нет.</p>
                    </div>
                  ) : null}
                  <TaskGroup title='Требует действия' items={taskGroups.attention} tone='attention' defaultOpen onPreview={setSelectedPhoto} />
                  <TaskGroup title='Нельзя проверить автоматически' items={taskGroups.unverified} tone='unverified' defaultOpen onPreview={setSelectedPhoto} />
                  <TaskGroup title='По плану' items={taskGroups.planned} tone='planned' defaultOpen onPreview={setSelectedPhoto} />
                  <TaskGroup title='Выполнено нормально' items={taskGroups.normal} tone='normal' defaultOpen={false} onPreview={setSelectedPhoto} />
                </main>

                <aside className='grid content-start gap-4'>
                  <section className='rounded-xl bg-white p-4 ring-1 ring-slate-200'>
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <h4 className='text-sm font-extrabold text-slate-950'>Итог смены</h4>
                      <Badge className={badgeClass(summary.status)}>{summary.label}</Badge>
                    </div>
                    <dl className='mt-3 grid gap-2 text-sm'>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>График</dt>
                        <dd className='font-extrabold text-slate-900'>{scheduleLabel}</dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>Смена</dt>
                        <dd className='font-extrabold text-slate-900'>{workDay?.shiftLabel ?? '—'}</dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>Опоздание на входе</dt>
                        <dd className={workDay?.lateMinutes ? 'font-extrabold text-amber-700' : 'font-extrabold text-slate-900'}>
                          {workDay?.lateMinutes ? `${workDay.lateMinutes} мин` : 'нет'}
                        </dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>День завершён</dt>
                        <dd className='font-extrabold text-slate-900'>{workDay?.status === 'completed' || workDay?.endedAt ? 'да' : 'нет'}</dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>Смена сдана</dt>
                        <dd className='font-extrabold text-slate-900'>{summary.handoverDone ? 'да' : 'нет'}</dd>
                      </div>
                    </dl>
                    {workDay?.comment ? (
                      <div className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600'>
                        Комментарий: {workDay.comment}
                      </div>
                    ) : null}
                  </section>

                  {handoverTask ? (
                    <>
                      <HandoverOverview data={handoverTask.handoverData} department={department} />
                      <details className='group rounded-xl bg-white ring-1 ring-slate-200'>
                        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3'>
                          <span className='text-sm font-extrabold text-slate-950'>Все данные и фото</span>
                          <span className='text-xs font-extrabold text-slate-500 group-open:hidden'>Открыть</span>
                          <span className='hidden text-xs font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
                        </summary>
                        <div className='border-t border-slate-200 bg-slate-50 p-3'>
                          <HandoverDetails data={handoverTask.handoverData} department={department} onPreview={setSelectedPhoto} />
                        </div>
                      </details>
                    </>
                  ) : null}

                </aside>
              </div>
              <details className='group mt-5 rounded-xl bg-white ring-1 ring-slate-200'>
                <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3'>
                  <span className='text-sm font-extrabold text-slate-950'>Технический журнал</span>
                  <span className='text-xs font-extrabold text-slate-500 group-open:hidden'>Открыть</span>
                  <span className='hidden text-xs font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
                </summary>
                <div className='grid gap-2 border-t border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 sm:grid-cols-2 xl:grid-cols-5'>
                  <span>Run ID: {run.id}</span>
                  <span>Статус: {run.status}</span>
                  <span>Отправлено: {formatTime(run.submittedAt)}</span>
                  <span>Завершено: {formatTime(run.completedAt)}</span>
                  <span>Автопроверок: {autoChecks.length}</span>
                </div>
              </details>
            </div>
          </div>
          {selectedPhoto && (
            <div
              className='fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4'
              onClick={(event) => {
                event.stopPropagation();
                setSelectedPhoto(null);
              }}
            >
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
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
