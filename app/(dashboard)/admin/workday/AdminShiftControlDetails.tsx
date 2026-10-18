'use client';
import { taskTimingLabel } from '@/lib/team-control';

import Link from 'next/link';
import { CloseExceptionDecisionClient } from './close-exceptions/[id]/CloseExceptionDecisionClient';
import { cashEncashmentReasonLabel, isCashEncashmentException } from '@/lib/workday-cash-encashment-exception';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatShadowPoints } from '@/lib/attendance-shadow';
import {
  terminalFiscalConfigurationProblem,
  terminalFiscalReasonLabel,
  terminalFiscalReasonTimes,
  terminalFiscalSourceContext,
  terminalFiscalSourceIncomplete,
} from '@/lib/terminal-fiscal-reason-view';
import type { WorkdayTimingViolation } from '@/lib/workday-timing';
import { deviationReasonLabel } from '@/lib/workday-deviation';
import { belongsInOperationalTaskOverview, hasTechnicalWorkdayClose, technicalWorkdayCloseTime } from '@/lib/workday-close-view';

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
  closingComment?: string | null;
  id: number;
  status: string;
  submittedAt: string | null;
  completedAt: string | null;
  tasks: ShiftTask[];
};

type WorkDayInfo = {
  status: string;
  startedAt: string;
  qrAcceptedAt: string | null;
  createdAt: string;
  endedAt: string | null;
  shiftLabel: string;
  lateMinutes: number;
  latenessPolicyVersion: string | null;
  latenessShadowPointsX2: number | null;
  comment: string;
  shiftChanges: Array<{
    source: string;
    fromShiftLabel: string;
    toShiftLabel: string;
    fromLateMinutes: number;
    toLateMinutes: number;
    changedAt: string;
  }>;
  deviations: Array<{
    kind: string;
    reasonCode: string;
    comment: string;
    lateMinutesSnapshot: number | null;
    requestedEndMinutes: number | null;
    reportedAt: string;
  }>;
} | null;

type CashEntry = { id: number; direction: string; amount: number; status: string; photoPath: string; comment: string; createdAt: string; oneCDocumentNumber: string | null; oneCReceiptDocumentNumber: string | null };
type CloseRequest = { id: string; status: string; reasonCode: string; comment: string; requestedAt: string; decidedAt: string | null; decisionComment: string; decidedBy: string | null };
type Props = {
  cashOperations?: CashEntry[];
  closeRequests?: CloseRequest[];
  employeeName: string;
  department: string;
  departmentName: string;
  scheduleLabel: string;
  run: ShiftRun | null;
  workDay: WorkDayInfo;
  attendanceNote?: string;
  dateKey: string;
  autoChecks?: ShiftAutoCheck[];
  timingViolations?: WorkdayTimingViolation[];
  terminalFiscalControl?: {
    total: number;
    statuses: { confirmed: number; pending: number; mismatch: number; unavailable: number; needs_review: number };
    reasonCodes: Record<string, number>;
    lastOperationAt: string | null;
  } | null;
  terminalFiscalRecords?: Array<{
    status: string;
    reasonCode: string;
    bankOperationAt: string | null;
  }>;
  requiredIssues?: Array<{
    id: number;
    title: string;
    meta: string;
    lifecycle?: string;
    href: string;
  }>;
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
  cashOperation?: {
    id: number;
    status: string;
    photoPath?: string;
    amount?: number;
  };
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
  if (task.status === 'done') return 'done';
  if (task.status === 'missed') return 'missed';
  return timingViolation?.kind === 'task_overdue' ? 'overdue' : 'pending';
}

function taskStatusLabel(status: string) {
  if (status === 'done') return 'выполнено';
  if (status === 'late') return 'выполнено с опозданием';
  if (status === 'overdue') return 'просрочено';
  if (status === 'missed') return 'пропущено';
  return 'ожидает';
}

function badgeClass(status: string) {
  if (status === 'done' || status === 'completed') return 'bg-green-100 text-green-800';
  if (status === 'late' || status === 'overdue' || status === 'missed' || status === 'not_submitted') return 'bg-amber-100 text-amber-800';
  if (status === 'none') return 'bg-slate-100 text-slate-600';
  return 'bg-blue-100 text-blue-800';
}

function autoCheckBadge(status: ShiftAutoCheck['status']) {
  if (status === 'matched') return { label: '1С: совпало', className: 'bg-green-100 text-green-800' };
  if (status === 'mismatch') return { label: '1С: расхождение', className: 'bg-rose-100 text-rose-800' };
  if (status === 'waiting') return { label: '1С: ожидает', className: 'bg-slate-100 text-slate-700' };
  return { label: 'Результат не подтверждён', className: 'bg-slate-100 text-slate-700' };
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

function cashRecountInputHistory(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.cashRecountInputHistory)) return [];
  return value.cashRecountInputHistory.flatMap((entry) => {
    if (!isRecord(entry) || typeof entry.value !== 'number' || typeof entry.enteredAt !== 'string') return [];
    return [{ value: entry.value, enteredAt: entry.enteredAt, kind: entry.kind === 'corrected' ? 'corrected' : 'initial' }];
  });
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
    const history = cashRecountInputHistory(task.handoverData);
    return (
      <div className='grid gap-1'>
        <span>Сумма: {formatMoney(task.numericValue)}</span>
        {history.length > 0 && (
          <div className='grid gap-0.5 text-xs font-semibold text-slate-500'>
            {history.map((entry, index) => (
              <span key={`${entry.enteredAt}-${index}`}>
                {entry.kind === 'initial' ? 'Первоначальный ввод' : 'Исправленный ввод'}: {formatMoney(entry.value)} · {formatTime(entry.enteredAt)}
              </span>
            ))}
          </div>
        )}
      </div>
    );
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
  const recountHistory = cashRecountInputHistory(data);
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
            {recountHistory.length > 0 && (
              <div className='grid gap-0.5 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 sm:col-span-2'>
                {recountHistory.map((entry, index) => (
                  <span key={`${entry.enteredAt}-${index}`}>
                    {entry.kind === 'initial' ? 'Первоначальный ввод' : 'Исправленный ввод'}: {formatMoney(entry.value)} · {formatTime(entry.enteredAt)}
                  </span>
                ))}
              </div>
            )}
            {isRetail && <DetailRow label='Операции терминала' value={yesNo(terminalCheck?.hadOperations)} />}
            {isRetail && <DetailRow label='Результат сверки терминала' value={terminalCheck?.reconciliation === 'discrepancy' ? 'Есть расхождение' : terminalCheck?.reconciliation === 'matched' ? 'Всё совпадает' : '—'} />}
            {isRetail && <PhotoRow label='Чеки терминала' photo={readPhoto(photos, 'terminalReceipts') ?? readPhoto(photos, 'personalAcquiringReceipts')} onPreview={onPreview} />}
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
            {readPhoto(photos, 'zReport')
              ? <PhotoRow label='Историческое фото чека закрытия смены' photo={readPhoto(photos, 'zReport')} onPreview={onPreview} />
              : <DetailRow label='Закрытие ККМ' value='Проверяется автоматически по данным 1С' />}
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
    ? ['personalStatement', 'terminalReceipts', 'personalAcquiringReceipts', 'encashmentDocument', 'zReport']
    : ['personalStatement', 'encashmentDocument', 'zReport'];
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
        {reserveCash ? (
          <DetailRow
            label='Резерв'
            value={reserveCash?.cashBalance === null || reserveCash?.cashBalance === undefined
              ? '—'
              : formatMoney(Number(reserveCash.cashBalance))}
          />
        ) : null}
        {department === 'retail' ? (
          <DetailRow label='Операции терминала' value={yesNo(terminalCheck?.hadOperations)} />
        ) : null}
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
            const cashPhotoHref = photoHref({ storagePath: check.cashOperation?.photoPath });
            const cashPhotoLabel = `Фото инкассации · ${formatMoney(check.cashOperation?.amount)}`;
            return (
              <div key={check.id} className='rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge className={badge.className}>{badge.label}</Badge>
                  <span className='text-xs font-extrabold text-slate-800'>{check.label}</span>
                </div>
                <p className='mt-1 text-xs font-semibold leading-relaxed text-slate-600'>{check.summary}</p>
                {check.cashOperation && (cashPhotoHref ? (
                  <button type='button' className='mt-2 flex min-h-16 items-center gap-3 rounded-lg text-left text-slate-700 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-700' onClick={() => onPreview({ href: cashPhotoHref, label: cashPhotoLabel })} aria-label={`${cashPhotoLabel}: увеличить`}>
                    <img src={cashPhotoHref} alt={cashPhotoLabel} className='h-16 w-16 shrink-0 rounded-lg object-cover ring-1 ring-slate-200' />
                    <span><span className='block text-sm font-bold'>Фото инкассации</span><span className='mt-1 block text-xs font-semibold underline underline-offset-4'>Увеличить</span></span>
                  </button>
                ) : <p className='mt-2 text-xs text-slate-600'>Фото не приложено</p>)}
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
                    {check.cashOperation ? 'Выбрать действие' : 'Подтвердить вручную'}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      {tone === 'attention' ? (
        <p className='mt-2 text-xs font-extrabold text-amber-800'>
          Что проверить: {hasMismatch ? 'сумму сотрудника, данные 1С и подтверждающие материалы.' : item.autoChecks.some(check => check.status === 'unavailable' && !manualReviewResolves(check)) ? 'причину отсутствия данных выше. Без них результат сверки не установлен; это не подтверждённая ошибка сотрудника.' : needsTimingReview ? 'причину задержки выполнения.' : 'ответ и подтверждения сотрудника.'}
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

type TaskBusinessState = {
  tone: 'error' | 'attention' | 'normal' | 'pending';
  label: string;
  result: string;
};

function taskBusinessState(item: ReviewedTask): TaskBusinessState {
  const unresolvedChecks = item.autoChecks.filter((check) => !manualReviewResolves(check));
  const mismatch = unresolvedChecks.find((check) => check.status === 'mismatch' || manualReviewConfirmsIssue(check));
  if (mismatch) return { tone: 'error', label: 'Есть ошибка', result: mismatch.summary };

  if (
    (item.task.category === 'acquiring' || item.task.category === 'credit')
    && item.task.status === 'done'
    && item.task.integerValue === 2
  ) {
    return { tone: 'error', label: 'Есть ошибка', result: item.task.comment || 'Сотрудник сообщил о расхождении' };
  }

  if (item.status === 'overdue') return { tone: 'attention', label: 'Требует внимания', result: 'Обязательная проверка просрочена' };
  if (item.status === 'missed') return { tone: 'attention', label: 'Требует внимания', result: 'Не выполнено до сдачи смены' };

  if (item.task.status !== 'done') return { tone: 'pending', label: 'Не выполнено', result: 'Срок ещё не наступил' };

  const unavailable = unresolvedChecks.find((check) => check.status === 'unavailable');
  if (unavailable) return {
    tone: 'attention', label: 'Результат не подтверждён',
    result: unavailable.summary.includes('Остаток 1С на момент проверки не был сохранён')
      ? 'Нет сохранённой суммы 1С для сверки'
      : `Не подтверждено: ${unavailable.label}`,
  };

  if (item.task.category === 'acquiring') return { tone: 'normal', label: 'Всё нормально', result: acquiringResult(item.task).label };
  const matched = item.autoChecks.find((check) => check.status === 'matched');
  if (item.task.category === 'credit') {
    return { tone: 'normal', label: 'Всё нормально', result: matched?.summary || creditResult(item.task).label };
  }

  return { tone: 'normal', label: 'Всё нормально', result: matched?.summary || 'Выполнено без замечаний' };
}

function cashOperationDecisionSummary(summary: string) {
  const marker = '. Инкассация зафиксирована, но документы 1С не проведены.';
  const markerIndex = summary.indexOf(marker);
  return markerIndex >= 0 ? summary.slice(0, markerIndex + marker.length) : summary;
}

function TaskOverviewRow({
  item,
  dateKey,
  overdueMinutes,
  department,
  run,
  onPreview,
  onManualReview,
}: {
  item: ReviewedTask;
  dateKey: string;
  overdueMinutes?: number | null;
  department: string;
  run: ShiftRun;
  onPreview: (photo: PhotoPreview) => void;
  onManualReview: (check: ShiftAutoCheck) => void;
}) {
  const state = taskBusinessState(item);
  const timing = taskTimingLabel(item.task.plannedTimeMinutes, item.task.completedAt, dateKey, item.status === 'overdue' ? overdueMinutes : undefined);
  const statusClassName = {
    error: 'bg-rose-100 text-rose-800',
    attention: 'bg-amber-100 text-amber-800',
    normal: 'bg-green-100 text-green-800',
    pending: 'bg-slate-100 text-slate-700',
  }[state.tone];
  const detailTone = state.tone === 'error' || state.tone === 'attention'
    ? 'attention'
    : state.tone === 'pending'
      ? 'planned'
      : 'normal';

  return (
    <details id={`shift-task-${item.task.id}`} className='group border-t border-slate-200 first:border-t-0'>
      <summary className='team-task-summary grid cursor-pointer list-none gap-2 px-4 py-3 transition hover:bg-slate-50 md:grid-cols-[minmax(180px,1.6fr)_64px_76px_110px_22px] md:items-center'>
        <span className='font-extrabold text-slate-950'>{taskDisplayTitle(item.task)}{state.tone !== 'pending' && <small className={`team-check-result result-${state.tone}`}>{state.result}</small>}</span>
        <span className='text-sm text-stone-600'><span className='md:hidden'>Срок: </span>{minutesToTime(item.task.plannedTimeMinutes)}</span>
        <span className='text-sm text-stone-600'><span className='md:hidden'>Выполнено: </span>{formatTime(item.task.completedAt)}</span>
        <span className={`team-status ${timing.tone === 'green' ? 'green' : timing.tone === 'amber' ? 'amber' : ''}`}>{item.task.status === 'missed' ? 'Пропущено' : item.task.status !== 'done' && state.tone === 'pending' ? 'Срок впереди' : timing.text}</span>
        <span aria-hidden='true' className='text-stone-500'>⌄</span>
      </summary>
      <div className='border-t border-slate-200 bg-slate-50 p-3'>
        <TaskDetailCard item={item} tone={detailTone} onPreview={onPreview} onManualReview={onManualReview} />
        {item.task.category === 'handover' ? (
          <div className='mt-3'><HandoverDetails data={item.task.handoverData} department={department} onPreview={onPreview} /></div>
        ) : null}
        <details className='mt-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200'>
          <summary className='cursor-pointer text-xs font-extrabold text-slate-600'>Технический журнал проверки</summary>
          <div className='mt-2 grid gap-1 text-xs font-semibold text-slate-500 sm:grid-cols-3'>
            <span>Task ID: {item.task.id}</span>
            <span>Run ID: {run.id}</span>
            <span>Завершено: {formatTime(item.task.completedAt)}</span>
          </div>
        </details>
      </div>
    </details>
  );
}

export function AdminShiftControlDetails({
  cashOperations = [],
  closeRequests = [],
  employeeName,
  department,
  departmentName,
  scheduleLabel,
  run,
  workDay,
  dateKey,
  attendanceNote,
  autoChecks = [],
  timingViolations = [],
  terminalFiscalControl = null,
  terminalFiscalRecords = [],
  requiredIssues = [],
  initialOpen = false,
  closeHref,
  previousEmployee,
  nextEmployee,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cardView, setCardView] = useState<'day' | 'cash' | 'close'>('day');
  const [focusedOperation, setFocusedOperation] = useState<number | null>(null);
  const [focusedTask, setFocusedTask] = useState<number | null>(null);
  const cardBodyRef = useRef<HTMLDivElement>(null);
  function showCardView(view: 'day' | 'cash' | 'close', operationId: number | null = null) {
    setCardView(view); setFocusedOperation(operationId); cardBodyRef.current?.scrollTo({ top: 0 });
  }
  const panelRef = useRef<HTMLDivElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoPreview | null>(null);
  const [manualReviewTarget, setManualReviewTarget] = useState<ShiftAutoCheck | null>(null);
  const [manualReviewDecision, setManualReviewDecision] = useState<'confirmed_ok' | 'confirmed_issue'>('confirmed_ok');
  const [manualReviewComment, setManualReviewComment] = useState('');
  const [manualReviewError, setManualReviewError] = useState('');
  const [manualReviewSaving, setManualReviewSaving] = useState(false);
  const [cashControlSaving, setCashControlSaving] = useState(false);
  const canUseShiftControl = department === 'retail' || department === 'wholesale';
  const technicalClose = hasTechnicalWorkdayClose(workDay, run);
  const technicalMissedTaskCount = technicalClose ? (run?.tasks.filter((task) => task.status === 'missed').length ?? 0) : 0;
  const shadowPolicyVersion = workDay?.latenessPolicyVersion ?? null;
  const shadowPointsX2 = workDay?.latenessShadowPointsX2 ?? null;
  const qrAcceptedAt = workDay?.qrAcceptedAt ?? null;
  const workDayCreatedAt = workDay?.createdAt ?? null;
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
  async function updateCashOperationControl(action: 'take_manual' | 'return_to_review' | 'retry_now') {
    const operation = manualReviewTarget?.cashOperation;
    if (!operation || cashControlSaving) return;
    setCashControlSaving(true);
    setManualReviewError('');
    try {
      const response = await fetch(`/api/admin/workday/cash-operations/${operation.id}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: manualReviewComment.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof payload.error === 'string' ? payload.error : 'Не удалось изменить способ проведения.');
      setManualReviewTarget(null);
      router.refresh();
    } catch (error) {
      setManualReviewError(error instanceof Error ? error.message : 'Не удалось изменить способ проведения.');
    } finally {
      setCashControlSaving(false);
    }
  }
  useEffect(() => {
    if (initialOpen) setOpen(true);
  }, [initialOpen]);
  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus();
    const containFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || document.querySelectorAll('[role="dialog"]').length > 1) return;
      const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],input:not([disabled]),textarea:not([disabled]),select:not([disabled]),summary,[tabindex="0"]') ?? []).filter(node => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panelRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', containFocus);
    return () => { document.removeEventListener('keydown', containFocus); previousFocus?.focus(); };
  }, [open]);
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
    const operationalTimingViolations = timingViolations.filter((violation) => (
      violation.kind === 'missing_checkout' || violation.kind === 'workday_not_started'
    ));
    if (!run) {
      return operationalTimingViolations.length > 0
        ? { status: 'overdue', label: 'требует внимания', completed: 0, total: 0, overdue: operationalTimingViolations.length, handoverDone: false }
        : { status: 'none', label: 'нет контроля', completed: 0, total: 0, overdue: 0, handoverDone: false };
    }

    const completed = run.tasks.filter((task) => task.status === 'done').length;
    const overdue = operationalTimingViolations.length;
    const handoverDone = run.tasks.some((task) => task.category === 'handover' && task.status === 'done');
    const total = run.tasks.length;
    const status = overdue > 0 ? 'overdue' : completed === total && total > 0 ? 'completed' : handoverDone ? 'completed' : 'in_progress';
    const label = status === 'completed' ? 'выполнено' : status === 'overdue' ? 'требует внимания' : 'в процессе';

    return { status, label, completed, total, overdue, handoverDone };
  }, [canUseShiftControl, run, timingViolations.length]);

  const hasZReportInHandover = useMemo(() => {
    if (!run) return false;
    return run.tasks.some((task) => task.category === 'handover' && Boolean(photoHref(readPhoto(readPhotos(task.handoverData), 'zReport'))));
  }, [run]);

  const detailTasks = useMemo(() => {
    if (!run) return [];
    return run.tasks.filter((task) => (
      !(task.category === 'closing' && hasZReportInHandover)
      && belongsInOperationalTaskOverview(task.status, technicalClose)
    ));
  }, [hasZReportInHandover, run, technicalClose]);
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
        status === 'overdue'
        || status === 'missed'
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
  const overviewTasks = useMemo(() => {
    const items = detailTasks.map((task) => ({
      task,
      status: taskStatus(task, timingViolationByTaskId.get(task.id)),
      autoChecks: autoChecksByTask.get(task.id) ?? [],
    }));
    const rank = { error: 0, attention: 1, pending: 2, normal: 3 };
    return items.sort((left, right) => (
      rank[taskBusinessState(left).tone] - rank[taskBusinessState(right).tone]
      || (left.task.plannedTimeMinutes ?? Number.MAX_SAFE_INTEGER) - (right.task.plannedTimeMinutes ?? Number.MAX_SAFE_INTEGER)
    ));
  }, [autoChecksByTask, detailTasks, timingViolationByTaskId]);
  const keyProblems = overviewTasks.filter((item) => (
    taskBusinessState(item).tone === 'error' || taskBusinessState(item).tone === 'attention' || item.status === 'overdue'
  ));
  const autoSummary = autoCheckSummary(autoChecks);
  const workdayTimingViolations = timingViolations.filter((violation) => violation.taskId === null);
  const activeWorkdayProblems = workdayTimingViolations.filter((violation) => (
    violation.kind === 'missing_checkout' || violation.kind === 'workday_not_started'
  ));
  const taskTimingViolationCount = timingViolations.length - workdayTimingViolations.length;
  const terminalFiscalHasError = (terminalFiscalControl?.statuses.mismatch ?? 0) > 0;
  const terminalFiscalNeedsAttention = (terminalFiscalControl?.statuses.needs_review ?? 0) > 0;
  const terminalFiscalUnavailable = (terminalFiscalControl?.statuses.unavailable ?? 0) > 0;
  const terminalFiscalConfigurationNeedsAttention = Object.entries(terminalFiscalControl?.reasonCodes ?? {})
    .some(([reasonCode, count]) => Number(count) > 0 && terminalFiscalConfigurationProblem(reasonCode));
  const hasError = requiredIssues.length > 0 || keyProblems.some((item) => taskBusinessState(item).tone === 'error') || terminalFiscalHasError;
  const scheduleNeedsAttention = scheduleLabel === 'не заполнено';
  const keyProblemCount = requiredIssues.length + keyProblems.length + activeWorkdayProblems.length + (scheduleNeedsAttention ? 1 : 0)
    + (terminalFiscalHasError || terminalFiscalNeedsAttention || terminalFiscalConfigurationNeedsAttention ? 1 : 0);
  const pendingOverviewCount = overviewTasks.filter((item) => taskBusinessState(item).tone === 'pending').length;
  const handoverTask = run?.tasks.find((task) => task.category === 'handover') ?? null;
  const workdayStateLabel = technicalClose ? 'закрыта позже' : workDay?.status === 'completed' || workDay?.endedAt
    ? 'завершил смену'
    : workDay
      ? 'работает'
      : scheduleLabel;
  const terminalReasonEntries = Object.entries(terminalFiscalControl?.reasonCodes ?? {})
    .filter(([reasonCode, count]) => Number(count) > 0 && !['MATCH_CONFIRMED', 'MATCH_CONFIRMED_LATE', 'OFD_ITEM_PRESENTATION_DIFFERENCE', 'OFD_ITEM_VALUES_MISMATCH'].includes(reasonCode));
  const terminalHasSourceIncomplete = terminalReasonEntries.some(([reasonCode]) => terminalFiscalSourceIncomplete(reasonCode));

  if (!canUseShiftControl) return <span className='text-sm font-semibold text-slate-400'>—</span>;
  const hasDetails = Boolean(requiredIssues.length > 0 || run || workDay || timingViolations.length > 0);

  return (
    <div>
      {hasDetails ? (
        <button type="button" className="team-action-button" onClick={() => setOpen(true)}>Подробнее</button>
      ) : (
        <span className='text-xs font-semibold text-slate-400'>Нет данных</span>
      )}

      {open && hasDetails && typeof document !== 'undefined' ? createPortal(
        <div className='team-shift-backdrop fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm' onClick={closeDetails}>
          <div
            ref={panelRef}
            tabIndex={-1}
            className='admin-dialog-panel team-shift-panel mx-auto flex w-full flex-col overflow-hidden rounded-2xl bg-slate-50 shadow-2xl'
            onClick={(event) => event.stopPropagation()}
            role='dialog'
            aria-modal='true'
            aria-label={`Контроль смены: ${employeeName}`}
          >
            <header className='flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 sm:px-6'>
              <div className='min-w-0'>
                <p className='text-sm font-semibold text-stone-600'>Контроль смены · {dateKey}</p>
                <h3 className='mt-0.5 truncate text-xl font-extrabold text-slate-950 sm:text-2xl'>{employeeName}</h3>
                <p className='mt-0.5 truncate text-xs font-semibold text-slate-500 sm:text-sm'>
                  {departmentName} · {workdayStateLabel} · {workDay?.shiftLabel ?? 'смена не задана'}
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
                    <span className='truncate'>Предыдущий: {previousEmployee.name}</span>
                  </Link>
                ) : <span />}
                {nextEmployee ? (
                  <Link href={nextEmployee.href} className='inline-flex min-w-0 items-center gap-1 text-xs font-extrabold text-slate-700'>
                    <span className='truncate'>Следующий: {nextEmployee.name}</span>
                    <ChevronRight className='h-4 w-4 shrink-0' />
                  </Link>
                ) : <span />}
              </div>
            ) : null}

            {false && (<><div className='hidden'>
              <div className={`rounded-xl border-l-4 bg-slate-50 px-3 py-2 ring-1 ring-slate-200 ${
                workDay?.status === 'completed' ? 'border-l-green-500' : 'border-l-amber-500'
              }`}>
                <p className='text-xs font-bold uppercase text-slate-400'>День</p>
                <p className='mt-0.5 text-base font-extrabold text-slate-950'>
                  {technicalClose ? 'Закрыта позже' : workDay?.status === 'completed' || workDay?.endedAt ? 'Завершён' : workDay ? 'Идёт' : 'Не начат'}
                </p>
                <p className='text-xs font-semibold text-slate-500'>
                  {technicalClose ? 'Время ухода не зафиксировано' : workDay ? `${formatTime(workDay!.startedAt)}–${formatTime(workDay!.endedAt)}` : 'Нет отметок'}
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

            <div className='hidden'>
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
                      {shadowPolicyVersion && shadowPointsX2 !== null ? (
                        <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                          <dt className='font-semibold text-slate-500'>Тестовая оценка</dt>
                          <dd className='text-right font-extrabold text-slate-900'>
                            {formatShadowPoints(shadowPointsX2 ?? 0)} · без влияния
                          </dd>
                        </div>
                      ) : null}
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>Смена</dt>
                        <dd className='font-extrabold text-slate-900'>{workDay?.shiftLabel ?? '—'}</dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>Опоздание на входе</dt>
                        <dd className={workDay?.lateMinutes ? 'font-extrabold text-amber-700' : 'font-extrabold text-slate-900'}>
                          {workDay?.lateMinutes ? `${workDay!.lateMinutes} мин` : 'нет'}
                        </dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>День завершён</dt>
                        <dd className='font-extrabold text-slate-900'>{technicalClose ? 'закрыт позже' : workDay?.status === 'completed' || workDay?.endedAt ? 'да' : 'нет'}</dd>
                      </div>
                      <div className='flex justify-between gap-3 border-t border-slate-100 pt-2'>
                        <dt className='font-semibold text-slate-500'>Смена сдана</dt>
                        <dd className='font-extrabold text-slate-900'>{summary.handoverDone ? 'да' : 'нет'}</dd>
                      </div>
                    </dl>
                    {workDay?.comment ? (
                      <div className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600'>
                        Комментарий: {workDay!.comment}
                      </div>
                    ) : null}
                    {workDay?.shiftChanges.length ? (
                      <div className='mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs font-semibold text-green-900'>
                        {workDay!.shiftChanges.map((change, index) => (
                          <p key={`${change.changedAt}-${index}`}>
                            Смена исправлена {formatTime(change.changedAt)}: {change.fromShiftLabel} → {change.toShiftLabel}; опоздание {change.fromLateMinutes} → {change.toLateMinutes} мин.
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {qrAcceptedAt && workDayCreatedAt ? (
                      <details className='mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600'>
                        <summary className='cursor-pointer font-extrabold text-slate-700'>Диагностика входа</summary>
                        <div className='mt-2 grid gap-1'>
                          <p>QR принят сервером: {formatTime(qrAcceptedAt)}</p>
                          <p>WorkDay создан: {formatTime(workDayCreatedAt)}</p>
                          <p>Правило: {shadowPolicyVersion}</p>
                        </div>
                      </details>
                    ) : null}
                  </section>

                  {handoverTask ? (
                    <>
                      <HandoverOverview data={handoverTask!.handoverData} department={department} />
                      <details className='group rounded-xl bg-white ring-1 ring-slate-200'>
                        <summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3'>
                          <span className='text-sm font-extrabold text-slate-950'>Все данные и фото</span>
                          <span className='text-xs font-extrabold text-slate-500 group-open:hidden'>Открыть</span>
                          <span className='hidden text-xs font-extrabold text-slate-500 group-open:inline'>Свернуть</span>
                        </summary>
                        <div className='border-t border-slate-200 bg-slate-50 p-3'>
                          <HandoverDetails data={handoverTask!.handoverData} department={department} onPreview={setSelectedPhoto} />
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
                  <span>Run ID: {run!.id}</span>
                  <span>Статус: {run!.status}</span>
                  <span>Отправлено: {formatTime(run!.submittedAt)}</span>
                  <span>Завершено: {formatTime(run!.completedAt)}</span>
                  <span>Автопроверок: {autoChecks.length}</span>
                </div>
              </details>
            </div></>)}
            <div ref={cardBodyRef} className='team-shift-body min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6'>
              <div className='team-shift-facts'><div><small>План</small><b>{scheduleLabel === 'работаю' ? 'Рабочий день' : scheduleLabel}</b><span>{workDay?.shiftLabel ?? 'Время смены не задано'}</span></div><div><small>Начало</small><b>{formatTime(workDay?.startedAt ?? null)}</b><span>{workDay?.lateMinutes ? `Позже на ${workDay.lateMinutes} мин` : workDay ? 'Начало отмечено' : 'Нет отметки приложения'}</span></div><div><small>Состояние</small><span className={`team-status ${workDay && !workDay.endedAt ? 'green' : ''}`}>{workdayStateLabel === 'работает' ? 'Работает' : workdayStateLabel}</span></div></div>
              {cardView === 'day' && <>
                {attendanceNote && <p className='team-card-note'>{attendanceNote}</p>}
                <section className='team-review-total'><b>{keyProblemCount + cashOperations.filter(operation => operation.status !== 'posted_1c_pair').length + closeRequests.filter(request => request.status === 'pending').length > 0 ? 'Есть неподтверждённые пункты' : 'Неподтверждённых результатов не выявлено'}</b><span>Проверки: {summary.completed} из {summary.total} выполнено · инкассации: {cashOperations.filter(operation => operation.status === 'posted_1c_pair').length} из {cashOperations.length} проведено{closeRequests.some(request => request.status === 'pending') ? ' · требуется ваше решение' : ''}</span></section>
                <div className='team-review-list'>
                  {closeRequests.some(request => request.status === 'pending') && <details className='team-review-row needs-attention'><summary><b>Запрос завершения дня</b><span>Требуется ваше решение</span></summary><div>{closeRequests.filter(request => request.status === 'pending').map(request => <div key={request.id}><p>{formatTime(request.requestedAt)} · {isCashEncashmentException(request.reasonCode) ? cashEncashmentReasonLabel(request.reasonCode) : 'Не удалось завершить обязательные проверки'}</p><p>{request.comment}</p></div>)}{closeRequests.filter(request => request.status === 'pending').map(request => <div key={`decision-${request.id}`}><CloseExceptionDecisionClient embedded requestId={request.id} approveLabel={isCashEncashmentException(request.reasonCode) ? 'Завершить без инкассации' : undefined} /><small>Разрешение завершит день. Неподтверждённые операции останутся на контроле.</small></div>)}</div></details>}
                  {requiredIssues.length > 0 && <details className='team-review-row needs-attention'><summary><b>Нерешённые замечания</b><span>{requiredIssues.length} · нужно исправить</span></summary><div>{requiredIssues.map(issue => <Link key={issue.id} href={issue.href}>{issue.title}{issue.meta ? ` · ${issue.meta}` : ''} →</Link>)}</div></details>}
                  <details className={`team-review-row ${cashOperations.some(operation => operation.status !== 'posted_1c_pair') ? 'needs-attention' : ''}`}><summary><b>Инкассации</b><span>{cashOperations.length ? `${cashOperations.filter(operation => operation.status === 'posted_1c_pair').length} из ${cashOperations.length} проведено` : 'Операций за день нет'}</span></summary><div>
                    {cashOperations.map(operation => <details key={operation.id} className='team-cash-entry'><summary><b>{formatTime(operation.createdAt)} · {formatMoney(operation.amount)}</b><span>{operation.direction === 'deposit_safe' ? 'В депозитный сейф' : 'В резерв'}</span><span className={`team-status ${operation.status === 'posted_1c_pair' ? 'green' : 'amber'}`}>{operation.status === 'posted_1c_pair' ? 'Проведена' : 'Не подтверждена'}</span></summary><div className='team-cash-evidence'><p>Документ: {operation.oneCDocumentNumber ?? 'Нет номера'} · приход: {operation.oneCReceiptDocumentNumber ?? 'Нет номера'}</p>{operation.comment && <p>{operation.comment}</p>}<PhotoRow label='Документ инкассации' photo={{ storagePath: operation.photoPath }} onPreview={setSelectedPhoto} />{autoChecks.filter(check => check.cashOperation?.id === operation.id).map(check => <div key={check.id}><p>{check.summary}</p><button type='button' onClick={() => openManualReview(check)}>Проверить и зафиксировать решение →</button></div>)}</div></details>)}
                    {cashOperations.length === 0 && <p>Сотрудник не вносил операций инкассации за этот день.</p>}
                  </div></details>
                  <div className='team-task-head px-4 py-2'><span>Проверки</span><span>Срок</span><span>Выполнено</span><span>По времени</span><span /></div>
                  {overviewTasks.filter(item => item.task.category !== 'handover').sort((left, right) => Number(['error', 'attention'].includes(taskBusinessState(right).tone)) - Number(['error', 'attention'].includes(taskBusinessState(left).tone))).map(item => <TaskOverviewRow key={item.task.id} dateKey={dateKey} overdueMinutes={timingViolationByTaskId.get(item.task.id)?.minutesLate} item={item} department={department} run={run!} onPreview={setSelectedPhoto} onManualReview={openManualReview} />)}
                  <details className={`team-review-row ${scheduleNeedsAttention || workDay?.lateMinutes || activeWorkdayProblems.length ? 'needs-attention' : ''}`}><summary><b>Начало смены и график</b><span>{!workDay ? 'Нет отметки приложения' : workDay.lateMinutes ? `Позже на ${workDay.lateMinutes} мин` : `Начало ${formatTime(workDay.startedAt)}`}</span></summary><div><p>План: {scheduleLabel} · {workDay?.shiftLabel ?? 'Время не задано'}</p>{scheduleNeedsAttention && <p>График не заполнен.</p>}{activeWorkdayProblems.map(violation => <p key={violation.id}>{violation.label}: {violation.detail}</p>)}{workDay?.deviations.map(deviation => <p key={deviation.reportedAt}>{deviationReasonLabel(deviation.kind === 'late_arrival' ? 'late_arrival' : 'early_finish', deviation.reasonCode)} · {deviation.comment}</p>)}</div></details>
                  <details className='team-review-row'><summary><b>Сдача смены</b><span>{handoverTask?.status === 'done' ? 'Выполнена' : closeRequests.some(request => request.status === 'pending') ? 'Не завершена · есть запрос' : handoverTask ? handoverTask.status === 'missed' ? 'Пропущена' : timingViolationByTaskId.get(handoverTask.id)?.kind === 'task_overdue' ? 'Просрочена' : `Ожидается к ${minutesToTime(handoverTask.plannedTimeMinutes)}` : 'Нет данных сдачи'}</span></summary><div>{handoverTask && <HandoverDetails data={handoverTask.handoverData} department={department} onPreview={setSelectedPhoto} />}{handoverTask && !readRecord(handoverTask.handoverData, 'personalCash') && !readRecord(handoverTask.handoverData, 'reserveCash') && !readRecord(handoverTask.handoverData, 'storeClosing') && <p>Сотрудник ещё не заполнил сдачу смены.</p>}</div></details>
                  {terminalFiscalControl && terminalFiscalControl.total > 0 && <details className={`team-review-row ${terminalFiscalHasError || terminalFiscalNeedsAttention || terminalFiscalUnavailable ? 'needs-attention' : ''}`}><summary><b>Сверка терминала</b><span>Подтверждено {terminalFiscalControl.statuses.confirmed} из {terminalFiscalControl.total}</span></summary><div>{terminalReasonEntries.map(([reason, count]) => <div key={reason}><p>{terminalFiscalReasonLabel(reason)} · {count}</p><p>{terminalFiscalReasonTimes(terminalFiscalRecords, reason).join(', ')}</p>{terminalFiscalSourceIncomplete(reason) && <p>{terminalFiscalSourceContext(reason)}</p>}</div>)}</div></details>}
                </div>
                {workDay && <details className='team-card-checks'><summary>История и комментарии</summary><div className='team-cash-evidence'>{workDay.comment && <p>{workDay.comment}</p>}{workDay.shiftChanges.map(change => <p key={change.changedAt}>{formatTime(change.changedAt)} · {change.fromShiftLabel} → {change.toShiftLabel}</p>)}{!workDay.comment && workDay.shiftChanges.length === 0 && <p>Дополнительных комментариев и изменений нет.</p>}</div></details>}
              </>}
              {cardView === 'cash' && <>
                <h4 className='team-card-heading'>Инкассации за день</h4>
                <p className='team-card-note'>Проведено в 1С: {formatMoney(cashOperations.filter(operation => operation.status === 'posted_1c_pair').reduce((sum, operation) => sum + operation.amount, 0))} · без подтверждения: {formatMoney(cashOperations.filter(operation => operation.status !== 'posted_1c_pair').reduce((sum, operation) => sum + operation.amount, 0))}</p>
                {cashOperations.length === 0 && <p className='team-card-empty'>Операций инкассации за этот день нет.</p>}
                {cashOperations.map(operation => <details key={`${operation.id}-${focusedOperation}`} className='team-cash-entry' open={focusedOperation === operation.id || undefined}><summary><b>{formatTime(operation.createdAt)} · {formatMoney(operation.amount)}</b><span>{operation.direction === 'deposit_safe' ? 'В депозитный сейф' : 'В резерв'}</span><span className={`team-status ${operation.status === 'posted_1c_pair' ? 'green' : 'amber'}`}>{operation.status === 'posted_1c_pair' ? 'Проведена' : operation.status === 'one_c_error' ? 'Не проведена' : operation.status === 'manual_in_progress' ? 'Вручную' : 'Ожидает 1С'}</span></summary><div className='team-cash-evidence'>
                  <p>Документ расхода: {operation.oneCDocumentNumber ?? 'Нет номера'} · приход: {operation.oneCReceiptDocumentNumber ?? 'Нет номера'}</p>
                  {operation.comment && <p>Комментарий: {operation.comment}</p>}
                  <PhotoRow label='Документ инкассации' photo={{ storagePath: operation.photoPath }} onPreview={setSelectedPhoto} />
                  {autoChecks.filter(check => check.cashOperation?.id === operation.id).map(check => <div key={check.id}><p>{check.summary}</p><button type='button' className='team-inline-action' onClick={() => openManualReview(check)}>Проверить и зафиксировать решение →</button></div>)}
                </div></details>)}
                {handoverTask && <details className='team-card-checks'><summary>Инкассация и подтверждения при сдаче смены</summary><HandoverDetails data={handoverTask.handoverData} department={department} onPreview={setSelectedPhoto} /></details>}
              </>}
              {cardView === 'close' && <>
                <h4 className='team-card-heading'>{workDay?.endedAt ? `День завершён · ${formatTime(workDay.endedAt)}` : 'Завершение дня · не завершён'}</h4>
                {closeRequests.length === 0 && <p className='team-card-note'>Запросов решения администратора нет.</p>}
                {closeRequests.map(request => <section key={request.id} className='team-card-attention'><b>{request.status === 'pending' ? 'Требуется ваше решение' : request.status === 'approved' ? 'Завершение разрешено' : request.status === 'rejected' ? 'Завершение не разрешено' : 'Запрос закрыт'}</b><p>{formatTime(request.requestedAt)} · {isCashEncashmentException(request.reasonCode) ? cashEncashmentReasonLabel(request.reasonCode) : request.reasonCode === 'kkm' ? 'Закрытие ККМ не подтверждено' : 'Не удалось завершить обязательные проверки'}</p><p>{request.comment}</p>
                  {request.status === 'pending' ? <CloseExceptionDecisionClient embedded requestId={request.id} approveLabel={isCashEncashmentException(request.reasonCode) ? 'Завершить без инкассации' : undefined} /> : <p>{request.decidedBy ? `${request.decidedBy} · ` : ''}{formatTime(request.decidedAt)}{request.decisionComment ? ` · ${request.decisionComment}` : ''}</p>}
                  {request.status === 'pending' && <small>Разрешение сразу завершит день. Неподтверждённые операции и замечания останутся на контроле.</small>}
                </section>)}
                {handoverTask ? <details className='team-card-checks'><summary>Подтверждения сдачи смены · {handoverTask.status === 'done' ? 'выполнена' : 'не завершена'}</summary><div className='team-cash-evidence'>{readRecord(handoverTask.handoverData, 'personalCash') || readRecord(handoverTask.handoverData, 'reserveCash') || readRecord(handoverTask.handoverData, 'storeClosing') ? <HandoverDetails data={handoverTask.handoverData} department={department} onPreview={setSelectedPhoto} /> : <p>Сотрудник ещё не заполнил сдачу смены.</p>}</div></details> : <p className='team-card-note'>Данных сдачи смены нет.</p>}
                {requiredIssues.length > 0 && <section className='team-card-attention'><b>Нерешённые замечания · {requiredIssues.length}</b>{requiredIssues.map(issue => <Link key={issue.id} href={issue.href}>{issue.title} →</Link>)}</section>}
              </>}
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
              <div className='admin-dialog-panel flex max-h-full w-full max-w-5xl flex-col rounded-xl bg-white shadow-2xl' onClick={(event) => event.stopPropagation()}>
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
                className='admin-dialog-panel w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl'
                onClick={(event) => event.stopPropagation()}
                role='dialog'
                aria-modal='true'
                aria-label={manualReviewTarget.cashOperation
                  ? `Решение по инкассации: ${manualReviewTarget.label}`
                  : `Ручное подтверждение: ${manualReviewTarget.label}`}
              >
                <div className='flex items-start justify-between gap-4'>
                  <div>
                    <p className='text-xs font-extrabold uppercase text-primary'>
                      {manualReviewTarget.cashOperation ? 'Решение администратора' : 'Ручное подтверждение'}
                    </p>
                    <h4 className='mt-1 text-lg font-extrabold text-slate-950'>
                      {manualReviewTarget.cashOperation ? 'Инкассация не проведена' : manualReviewTarget.label}
                    </h4>
                    {manualReviewTarget.cashOperation ? (
                      <p className='mt-1 text-xs font-extrabold text-slate-500'>{manualReviewTarget.label}</p>
                    ) : null}
                    <p className='mt-2 text-sm font-semibold leading-relaxed text-slate-600'>
                      {manualReviewTarget.cashOperation
                        ? cashOperationDecisionSummary(manualReviewTarget.summary)
                        : manualReviewTarget.summary}
                    </p>
                    {manualReviewTarget.cashOperation && manualReviewTarget.evidence ? (
                      <p className='mt-2 text-xs font-semibold leading-relaxed text-amber-800'>
                        <span className='font-extrabold'>Причина:</span> {manualReviewTarget.evidence}
                      </p>
                    ) : null}
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
                {manualReviewTarget.cashOperation ? (
                  <div className='mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3'>
                    <p className='text-sm font-extrabold text-slate-950'>Выберите, как провести документы в 1С</p>
                    <p className='mt-1 text-xs font-semibold leading-relaxed text-slate-600'>
                      Автоматическое проведение не запустится без вашего выбора.
                    </p>
                    <div className='mt-3 grid gap-2 sm:grid-cols-2'>
                      {manualReviewTarget.cashOperation.status === 'manual_in_progress' ? (
                        <Button
                          type='button'
                          className='sm:col-span-2 bg-white text-slate-700 shadow-none ring-1 ring-slate-200 hover:bg-slate-50'
                          onClick={() => updateCashOperationControl('return_to_review')}
                          disabled={cashControlSaving || manualReviewSaving}
                        >
                          Вернуть к выбору
                        </Button>
                      ) : manualReviewTarget.cashOperation.status === 'retrying_1c' ? (
                        <span className='inline-flex min-h-10 items-center rounded-lg bg-white px-3 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200'>Портал проводит документы…</span>
                      ) : (
                        <>
                          <Button
                            type='button'
                            className='bg-primary text-white hover:bg-primary/90'
                            onClick={() => updateCashOperationControl('retry_now')}
                            disabled={cashControlSaving || manualReviewSaving}
                          >
                            Провести автоматически
                          </Button>
                          <Button
                            type='button'
                            className='bg-white text-slate-800 shadow-none ring-1 ring-slate-300 hover:bg-slate-100'
                            onClick={() => updateCashOperationControl('take_manual')}
                            disabled={cashControlSaving || manualReviewSaving}
                          >
                            Проведу вручную
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ) : <>
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
                    disabled={manualReviewSaving || cashControlSaving}
                  >
                    Отмена
                  </Button>
                  <Button type='button' onClick={submitManualReview} disabled={manualReviewSaving || cashControlSaving}>
                    {manualReviewSaving ? 'Сохраняю…' : 'Сохранить решение'}
                  </Button>
                </div>
                </>}
                {manualReviewTarget.cashOperation && manualReviewError ? (
                  <p className='mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800'>
                    {manualReviewError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
