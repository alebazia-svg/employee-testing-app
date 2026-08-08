'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { WorkdayTimingViolation } from '@/lib/workday-timing';

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
  autoChecks?: ShiftAutoCheck[];
  timingViolations?: WorkdayTimingViolation[];
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
  status: 'matched' | 'mismatch' | 'waiting' | 'unavailable';
  summary: string;
  evidence?: string;
  manualReview?: ShiftAutoCheckManualReview | null;
};

export type ShiftAutoCheckManualReview = {
  id: number;
  decision: 'confirmed_ok' | 'confirmed_issue';
  comment: string;
  reviewedAt: string;
  reviewedBy: {
    id: number;
    name: string;
    login: string;
  };
};

function manualReviewResolves(check: ShiftAutoCheck) {
  return check.manualReview?.decision === 'confirmed_ok';
}

function manualReviewConfirmsIssue(check: ShiftAutoCheck) {
  return check.manualReview?.decision === 'confirmed_issue';
}

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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function taskStatus(task: ShiftTask, timingViolation?: WorkdayTimingViolation) {
  if (task.status === 'done') {
    return timingViolation?.kind === 'task_late' ? 'late' : 'done';
  }
  return timingViolation?.kind === 'task_overdue' ? 'overdue' : 'pending';
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
  if (status === 'waiting') return { label: '1С: ожидает', className: 'bg-slate-100 text-slate-700' };
  return { label: 'Нельзя проверить автоматически', className: 'bg-blue-100 text-blue-800' };
}

function autoCheckSummary(autoChecks: ShiftAutoCheck[]) {
  const unresolvedChecks = autoChecks.filter((check) => !manualReviewResolves(check));
  const manualOkCount = autoChecks.filter(manualReviewResolves).length;
  const manualIssueCount = autoChecks.filter(manualReviewConfirmsIssue).length;
  const mismatchCount = unresolvedChecks.filter((check) => check.status === 'mismatch' || manualReviewConfirmsIssue(check)).length;
  const matchedCount = unresolvedChecks.filter((check) => (
    check.status === 'matched' && !manualReviewConfirmsIssue(check)
  )).length;
  const incompleteCount = unresolvedChecks.filter((check) => (
    !manualReviewConfirmsIssue(check) && (check.status === 'waiting' || check.status === 'unavailable')
  )).length;

  if (mismatchCount > 0) {
    return {
      label: `расхождений ${mismatchCount}${manualIssueCount > 0 ? `, подтверждено вручную ${manualIssueCount}` : ''}`,
      className: 'bg-rose-100 text-rose-800',
      problem: true,
    };
  }
  if (autoChecks.length === 0) {
    return { label: 'нет проверок', className: 'bg-slate-100 text-slate-700', problem: false };
  }
  if (incompleteCount > 0) {
    return {
      label: `авто ${matchedCount}, нельзя проверить ${incompleteCount}${manualOkCount > 0 ? `, вручную ${manualOkCount}` : ''}`,
      className: 'bg-blue-100 text-blue-800',
      problem: false,
    };
  }
  return {
    label: manualOkCount > 0 ? `авто ${matchedCount}, вручную ${manualOkCount}` : `совпало ${matchedCount}`,
    className: 'bg-green-100 text-green-800',
    problem: false,
  };
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
  if (task.integerValue === 0) return { label: 'Новых операций не было', problem: false, legacy: false };
  if (task.integerValue === 1) return { label: 'Всё совпадает', problem: false, legacy: false };
  if (task.integerValue === 2) return { label: 'Есть расхождение', problem: true, legacy: false };
  if (task.numericValue !== null && task.numericValue !== undefined) {
    return { label: 'Сумма введена по старой версии', problem: false, legacy: true };
  }
  return { label: 'Результат не указан', problem: false, legacy: false };
}

function taskDisplayTitle(task: ShiftTask) {
  return task.category === 'acquiring' ? 'Проверка операций терминала' : task.title;
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

function employeeRevisions(task: ShiftTask) {
  if (!isRecord(task.handoverData) || !Array.isArray(task.handoverData._employeeRevisionHistory)) return [];
  return task.handoverData._employeeRevisionHistory.filter(isRecord);
}

function previousTaskFromRevision(task: ShiftTask, revision: Record<string, unknown>): ShiftTask | null {
  const previous = isRecord(revision.previous) ? revision.previous : null;
  if (!previous) return null;
  return {
    ...task,
    completedAt: typeof previous.completedAt === 'string' ? previous.completedAt : task.completedAt,
    numericValue: typeof previous.numericValue === 'number' ? previous.numericValue : null,
    integerValue: typeof previous.integerValue === 'number' ? previous.integerValue : null,
    booleanValue: typeof previous.booleanValue === 'boolean' ? previous.booleanValue : null,
    textValue: typeof previous.textValue === 'string' ? previous.textValue : null,
    comment: typeof previous.comment === 'string' ? previous.comment : '',
    handoverData: previous.handoverData,
  };
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
    const photo = readPhoto(readPhotos(task.handoverData), 'terminalReceipts');
    return (
      <div className='grid gap-2'>
        <span className='inline-flex flex-wrap items-center gap-1.5'>
          <span className={result.problem ? 'font-extrabold text-amber-800' : result.legacy ? 'font-extrabold text-slate-500' : ''}>
            {result.label}
          </span>
          {result.legacy && task.numericValue !== null && task.numericValue !== undefined && <span>· сумма: {formatMoney(task.numericValue)}</span>}
          {task.comment && <span>· {task.comment}</span>}
        </span>
        {photo && <PhotoRow label='Чеки терминала' photo={photo} onPreview={onPreview} />}
      </div>
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
  const terminalCheck = readRecord(data, 'terminalCheck');
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
            {isRetail && <DetailRow label='Операции терминала' value={yesNo(terminalCheck?.hadOperations)} />}
            {isRetail && <DetailRow label='Результат сверки терминала' value={terminalCheck?.reconciliation === 'discrepancy' ? 'Есть расхождение' : terminalCheck?.reconciliation === 'matched' ? 'Всё совпадает' : '—'} />}
            {isRetail && <PhotoRow label='Чеки терминала' photo={readPhoto(photos, 'terminalReceipts') ?? readPhoto(photos, 'personalAcquiringReceipts')} onPreview={onPreview} />}
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
  const terminalCheck = readRecord(data, 'terminalCheck');
  const photos = readPhotos(data);
  const photoKeys = department === 'retail'
    ? ['personalStatement', 'terminalReceipts', 'personalAcquiringReceipts', 'encashmentDocument', 'tbankReceipts', 'tbankTerminalReport', 'zReport']
    : ['personalStatement', 'encashmentDocument', 'tbankReceipts', 'tbankTerminalReport', 'zReport'];
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
          <DetailRow label='Операции терминала' value={yesNo(terminalCheck?.hadOperations)} />
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
  onManualReview,
}: {
  item: ReviewedTask;
  tone: 'attention' | 'unverified' | 'normal' | 'planned';
  onPreview: (photo: PhotoPreview) => void;
  onManualReview: (check: ShiftAutoCheck) => void;
}) {
  const toneClass = {
    attention: 'border-amber-200 bg-amber-50/60',
    unverified: 'border-blue-200 bg-blue-50/50',
    normal: 'border-green-200 bg-green-50/40',
    planned: 'border-slate-200 bg-white',
  }[tone];
  const hasMismatch = item.autoChecks.some((check) => (
    manualReviewConfirmsIssue(check) || (check.status === 'mismatch' && !manualReviewResolves(check))
  ));
  const needsTimingReview = item.status === 'late' || item.status === 'overdue';
  const revisions = employeeRevisions(item.task);

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <p className='text-sm font-extrabold text-slate-950'>{taskDisplayTitle(item.task)}</p>
        <Badge className={badgeClass(item.status)}>{taskStatusLabel(item.status)}</Badge>
      </div>
      <div className='mt-2 grid gap-1 text-xs font-semibold text-slate-600 sm:grid-cols-3'>
        <span>План: {minutesToTime(item.task.plannedTimeMinutes)}</span>
        <span>Выполнено: {formatTime(item.task.completedAt)}</span>
        <TaskValue task={item.task} onPreview={onPreview} />
      </div>
      {revisions.length > 0 && (
        <details className='mt-2 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200'>
          <summary className='cursor-pointer text-xs font-extrabold text-slate-700'>Исправления сотрудника: {revisions.length}</summary>
          <div className='mt-2 grid gap-2'>
            {revisions.map((revision, index) => {
              const previousTask = previousTaskFromRevision(item.task, revision);
              const editedAt = typeof revision.editedAt === 'string' ? revision.editedAt : null;
              return (
                <div key={`${editedAt ?? 'revision'}-${index}`} className='rounded-md bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-600'>
                  <p className='font-bold text-slate-700'>Исправлено: {formatTime(editedAt)}</p>
                  {previousTask && (
                    <div className='mt-1'>
                      <span className='text-slate-500'>Предыдущий ответ: </span>
                      <TaskValue task={previousTask} onPreview={onPreview} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}
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
                {check.manualReview ? (
                  <div className={`mt-2 rounded-lg border px-3 py-2 ${
                    check.manualReview.decision === 'confirmed_issue'
                      ? 'border-rose-200 bg-rose-50'
                      : 'border-green-200 bg-green-50'
                  }`}>
                    <p className={`text-xs font-extrabold ${
                      check.manualReview.decision === 'confirmed_issue' ? 'text-rose-900' : 'text-green-900'
                    }`}>
                      {check.manualReview.decision === 'confirmed_issue' ? 'Проблема подтверждена вручную' : 'Данные подтверждены вручную'}
                      {' · '}{check.manualReview.reviewedBy.name} · {formatDateTime(check.manualReview.reviewedAt)}
                    </p>
                    <p className={`mt-1 text-xs font-semibold leading-relaxed ${
                      check.manualReview.decision === 'confirmed_issue' ? 'text-rose-800' : 'text-green-800'
                    }`}>{check.manualReview.comment}</p>
                    <button
                      type='button'
                      className={`mt-2 text-xs font-extrabold underline underline-offset-2 ${
                        check.manualReview.decision === 'confirmed_issue'
                          ? 'text-rose-900 decoration-rose-400'
                          : 'text-green-900 decoration-green-400'
                      }`}
                      onClick={() => onManualReview(check)}
                    >
                      Добавить новое подтверждение
                    </button>
                  </div>
                ) : check.status === 'mismatch' || check.status === 'unavailable' ? (
                  <button
                    type='button'
                    className='mt-2 inline-flex min-h-8 items-center rounded-lg bg-slate-950 px-3 text-xs font-extrabold text-white transition hover:bg-slate-800'
                    onClick={() => onManualReview(check)}
                  >
                    Подтвердить вручную
                  </button>
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
  onManualReview,
}: {
  title: string;
  items: ReviewedTask[];
  tone: 'attention' | 'unverified' | 'normal' | 'planned';
  defaultOpen: boolean;
  onPreview: (photo: PhotoPreview) => void;
  onManualReview: (check: ShiftAutoCheck) => void;
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
          <TaskDetailCard key={item.task.id} item={item} tone={tone} onPreview={onPreview} onManualReview={onManualReview} />
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
  autoChecks = [],
  timingViolations = [],
  initialOpen = false,
  closeHref,
  previousEmployee,
  nextEmployee,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoPreview | null>(null);
  const [manualReviewTarget, setManualReviewTarget] = useState<ShiftAutoCheck | null>(null);
  const [manualReviewDecision, setManualReviewDecision] = useState<'confirmed_ok' | 'confirmed_issue'>('confirmed_ok');
  const [manualReviewComment, setManualReviewComment] = useState('');
  const [manualReviewError, setManualReviewError] = useState('');
  const [manualReviewSaving, setManualReviewSaving] = useState(false);
  const canUseShiftControl = department === 'retail' || department === 'wholesale';
  const closeDetails = useCallback(() => {
    setSelectedPhoto(null);
    setManualReviewTarget(null);
    setOpen(false);
    if (initialOpen && closeHref) {
      router.replace(closeHref, { scroll: false });
    }
  }, [closeHref, initialOpen, router]);
  function openManualReview(check: ShiftAutoCheck) {
    setManualReviewTarget(check);
    setManualReviewDecision(check.manualReview?.decision ?? 'confirmed_ok');
    setManualReviewComment('');
    setManualReviewError('');
  }
  async function submitManualReview() {
    if (!manualReviewTarget || manualReviewSaving) return;
    const comment = manualReviewComment.trim();
    if (!comment) {
      setManualReviewError('Комментарий обязателен.');
      return;
    }

    setManualReviewSaving(true);
    setManualReviewError('');
    try {
      const response = await fetch('/api/admin/workday/manual-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: manualReviewTarget.taskId,
          checkId: manualReviewTarget.id,
          checkLabel: manualReviewTarget.label,
          decision: manualReviewDecision,
          comment,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Не удалось сохранить подтверждение.');
      }
      setManualReviewTarget(null);
      setManualReviewComment('');
      router.refresh();
    } catch (error) {
      setManualReviewError(error instanceof Error ? error.message : 'Не удалось сохранить подтверждение.');
    } finally {
      setManualReviewSaving(false);
    }
  }
  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (manualReviewTarget && !manualReviewSaving) {
        setManualReviewTarget(null);
      } else if (selectedPhoto) {
        setSelectedPhoto(null);
      } else {
        closeDetails();
      }
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeDetails, manualReviewSaving, manualReviewTarget, open, selectedPhoto]);
  const summary = useMemo(() => {
    if (!canUseShiftControl) return { status: 'none', label: '—', completed: 0, total: 0, overdue: 0, handoverDone: false };
    if (!run) {
      return timingViolations.length > 0
        ? { status: 'overdue', label: 'есть нарушения времени', completed: 0, total: 0, overdue: timingViolations.length, handoverDone: false }
        : { status: 'none', label: 'нет контроля', completed: 0, total: 0, overdue: 0, handoverDone: false };
    }

    const completed = run.tasks.filter((task) => task.status === 'done').length;
    const overdue = timingViolations.length;
    const handoverDone = run.tasks.some((task) => task.category === 'handover' && task.status === 'done');
    const total = run.tasks.length;
    const status = overdue > 0 ? 'overdue' : completed === total && total > 0 ? 'completed' : handoverDone ? 'completed' : 'in_progress';
    const label = status === 'completed' ? 'выполнено' : status === 'overdue' ? 'есть нарушения времени' : 'в процессе';

    return { status, label, completed, total, overdue, handoverDone };
  }, [canUseShiftControl, run, timingViolations.length]);

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
  const timingViolationByTaskId = useMemo(() => (
    new Map(timingViolations.flatMap((violation) => (
      violation.taskId === null ? [] : [[violation.taskId, violation] as const]
    )))
  ), [timingViolations]);
  const taskGroups = useMemo(() => {
    const groups: Record<'attention' | 'unverified' | 'normal' | 'planned', ReviewedTask[]> = {
      attention: [],
      unverified: [],
      normal: [],
      planned: [],
    };

    for (const task of detailTasks) {
      const status = taskStatus(task, timingViolationByTaskId.get(task.id));
      const taskAutoChecks = autoChecksByTask.get(task.id) ?? [];
      const item = { task, status, autoChecks: taskAutoChecks };
      const unresolvedAutoChecks = taskAutoChecks.filter((check) => !manualReviewResolves(check));
      if (
        status === 'late'
        || status === 'overdue'
        || unresolvedAutoChecks.some((check) => check.status === 'mismatch' || manualReviewConfirmsIssue(check))
      ) {
        groups.attention.push(item);
      } else if (unresolvedAutoChecks.some((check) => (
        !manualReviewConfirmsIssue(check) && (check.status === 'waiting' || check.status === 'unavailable')
      ))) {
        groups.unverified.push(item);
      } else if (status === 'done') {
        groups.normal.push(item);
      } else {
        groups.planned.push(item);
      }
    }

    return groups;
  }, [autoChecksByTask, detailTasks, timingViolationByTaskId]);
  const autoSummary = autoCheckSummary(autoChecks);
  const workdayTimingViolations = timingViolations.filter((violation) => violation.taskId === null);
  const taskTimingViolationCount = timingViolations.length - workdayTimingViolations.length;
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
                    : autoChecks.some((check) => !manualReviewResolves(check) && check.status !== 'matched')
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
                  {timingViolations.length > 0 ? (
                    <section className='rounded-xl border border-amber-200 bg-amber-50 px-4 py-3'>
                      <p className='text-sm font-extrabold text-amber-950'>
                        Нарушения времени: {timingViolations.length}
                      </p>
                      <div className='mt-2 grid gap-1.5'>
                        {workdayTimingViolations.map((violation) => (
                          <div key={violation.id} className='text-xs font-semibold leading-relaxed text-amber-900'>
                            <span className='font-extrabold'>{violation.label}.</span> {violation.detail}
                          </div>
                        ))}
                        {taskTimingViolationCount > 0 ? (
                          <p className='text-xs font-semibold leading-relaxed text-amber-900'>
                            Шагов чек-листа не в срок: <span className='font-extrabold'>{taskTimingViolationCount}</span>. Подробности показаны в карточках ниже.
                          </p>
                        ) : null}
                      </div>
                    </section>
                  ) : null}
                  {taskGroups.attention.length === 0 && timingViolations.length === 0 ? (
                    <div className='rounded-xl border border-green-200 bg-green-50 px-4 py-3'>
                      <p className='text-sm font-extrabold text-green-950'>Действий по чек-листу не требуется</p>
                      <p className='mt-1 text-xs font-semibold text-green-800'>Критичных расхождений и просроченных шагов нет.</p>
                    </div>
                  ) : null}
                  <TaskGroup title='Требует действия' items={taskGroups.attention} tone='attention' defaultOpen onPreview={setSelectedPhoto} onManualReview={openManualReview} />
                  <TaskGroup title='Нельзя проверить автоматически' items={taskGroups.unverified} tone='unverified' defaultOpen onPreview={setSelectedPhoto} onManualReview={openManualReview} />
                  <TaskGroup title='По плану' items={taskGroups.planned} tone='planned' defaultOpen onPreview={setSelectedPhoto} onManualReview={openManualReview} />
                  <TaskGroup title='Выполнено нормально' items={taskGroups.normal} tone='normal' defaultOpen={false} onPreview={setSelectedPhoto} onManualReview={openManualReview} />
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
          {manualReviewTarget ? (
            <div
              className='fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/70 p-4'
              onClick={(event) => {
                event.stopPropagation();
                if (!manualReviewSaving) setManualReviewTarget(null);
              }}
            >
              <div
                className='w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl'
                onClick={(event) => event.stopPropagation()}
                role='dialog'
                aria-modal='true'
                aria-label={`Ручное подтверждение: ${manualReviewTarget.label}`}
              >
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <p className='text-xs font-extrabold uppercase text-primary'>Ручное подтверждение</p>
                    <h4 className='mt-1 text-lg font-extrabold text-slate-950'>{manualReviewTarget.label}</h4>
                    <p className='mt-2 text-sm font-semibold leading-relaxed text-slate-600'>{manualReviewTarget.summary}</p>
                  </div>
                  <Button
                    type='button'
                    className='h-9 w-9 shrink-0 bg-slate-100 p-0 text-slate-700 shadow-none hover:bg-slate-200'
                    onClick={() => setManualReviewTarget(null)}
                    disabled={manualReviewSaving}
                    aria-label='Закрыть ручное подтверждение'
                  >
                    <X className='h-5 w-5' />
                  </Button>
                </div>
                <fieldset className='mt-4'>
                  <legend className='text-sm font-extrabold text-slate-900'>Результат ручной проверки</legend>
                  <div className='mt-2 grid gap-2 sm:grid-cols-2'>
                    <label className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                      manualReviewDecision === 'confirmed_ok'
                        ? 'border-green-400 bg-green-50 ring-2 ring-green-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}>
                      <input
                        type='radio'
                        name='manual-review-decision'
                        value='confirmed_ok'
                        checked={manualReviewDecision === 'confirmed_ok'}
                        onChange={() => setManualReviewDecision('confirmed_ok')}
                        className='sr-only'
                      />
                      <span className='block text-sm font-extrabold text-green-900'>Данные подтверждены</span>
                      <span className='mt-1 block text-xs font-semibold text-slate-600'>Ручная проверка не выявила проблему.</span>
                    </label>
                    <label className={`cursor-pointer rounded-xl border px-3 py-3 transition ${
                      manualReviewDecision === 'confirmed_issue'
                        ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}>
                      <input
                        type='radio'
                        name='manual-review-decision'
                        value='confirmed_issue'
                        checked={manualReviewDecision === 'confirmed_issue'}
                        onChange={() => setManualReviewDecision('confirmed_issue')}
                        className='sr-only'
                      />
                      <span className='block text-sm font-extrabold text-rose-900'>Проблема подтверждена</span>
                      <span className='mt-1 block text-xs font-semibold text-slate-600'>Проверка должна остаться в блоке внимания.</span>
                    </label>
                  </div>
                </fieldset>
                <label className='mt-4 block'>
                  <span className='text-sm font-extrabold text-slate-900'>Комментарий администратора</span>
                  <textarea
                    value={manualReviewComment}
                    onChange={(event) => setManualReviewComment(event.target.value)}
                    maxLength={1000}
                    rows={5}
                    className='mt-2 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'
                    placeholder='Что проверено вручную и на основании каких данных?'
                    autoFocus
                  />
                </label>
                <div className='mt-1 flex items-center justify-between gap-3 text-xs font-semibold text-slate-500'>
                  <span>Подтверждение сохранит автора и точное время.</span>
                  <span>{manualReviewComment.length}/1000</span>
                </div>
                {manualReviewError ? (
                  <p className='mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800'>
                    {manualReviewError}
                  </p>
                ) : null}
                <div className='mt-5 flex justify-end gap-2'>
                  <Button
                    type='button'
                    className='bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200'
                    onClick={() => setManualReviewTarget(null)}
                    disabled={manualReviewSaving}
                  >
                    Отмена
                  </Button>
                  <Button type='button' onClick={submitManualReview} disabled={manualReviewSaving}>
                    {manualReviewSaving ? 'Сохраняю…' : 'Сохранить решение'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
