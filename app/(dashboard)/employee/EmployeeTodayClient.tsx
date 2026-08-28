'use client';

import jsQR from 'jsqr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardCheck,
  Clock,
  CreditCard,
  Home,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Users,
  X,
} from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { startVisibleSync } from '@/lib/visible-sync';
import { createIdempotencyKey } from '@/lib/idempotency-key';
import { terminalFiscalEmployeeReviewSummary } from '@/lib/terminal-fiscal-employee-review-view';
import { workdayIssueView } from '@/lib/workday-control-issue-view';
import { buildDateRange, formatDateLabel, formatTime, getMoscowMinutes, getShiftOptionsForDepartment, shiftOptions, usesWorkdayShiftControl } from '@/lib/workday';
import { cn } from '@/lib/utils';
import { buildShiftHandoverSteps } from '@/lib/shift-control-policy';
import { colleaguePresence } from '@/lib/workday-presence';
import {
  cashOutboxFormData,
  listEmployeeCashOutboxItems,
  removeEmployeeCashOutboxItem,
  saveEmployeeCashOutboxItem,
  type EmployeeCashOutboxItem,
} from '@/lib/employee-cash-outbox';
import { WorkdayNotificationsClient } from './WorkdayNotificationsClient';

function uploadFormData<T>(
  url: string,
  method: 'POST' | 'PATCH',
  formData: FormData,
  fallbackError: string,
  onProgress?: (progress: number) => void,
) {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, url);
    request.timeout = 120_000;
    onProgress?.(0);
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    request.onload = () => {
      onProgress?.(100);
      let result: unknown = null;
      try {
        result = request.responseText ? JSON.parse(request.responseText) : null;
      } catch {
        reject(new Error(fallbackError));
        return;
      }
      if (request.status >= 200 && request.status < 300) {
        resolve(result as T);
        return;
      }
      const error = isRecord(result) && typeof result.error === 'string' ? result.error : fallbackError;
      reject(new EmployeeApiError(error, isRecord(result) && typeof result.code === 'string' ? result.code : '', result));
    };
    request.onerror = () => reject(new EmployeeNetworkError('Связь прервалась при сохранении.'));
    request.ontimeout = () => reject(new EmployeeNetworkError('Сохранение занимает слишком долго.'));
    request.send(formData);
  });
}

async function submitFormData<T>(
  url: string,
  method: 'POST' | 'PATCH',
  formData: FormData,
  fallbackError: string,
  onProgress?: (progress: number) => void,
) {
  const containsPhoto = Array.from(formData.values()).some((value) => value instanceof File && value.size > 0);
  if (containsPhoto) return uploadFormData<T>(url, method, formData, fallbackError, onProgress);

  const response = await fetch(url, { method, body: formData });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = isRecord(result) && typeof result.error === 'string' ? result.error : fallbackError;
    throw new EmployeeApiError(error, isRecord(result) && typeof result.code === 'string' ? result.code : '', result);
  }
  return result as T;
}

function photoSavingLabel(progress: number | null) {
  if (progress === null || progress <= 0) return 'Подготавливаем фото...';
  if (progress >= 100) return 'Сохраняем результат...';
  return `Отправляем фото · ${progress}%`;
}

class EmployeeApiError extends Error {
  constructor(message: string, readonly code: string, readonly payload: unknown) {
    super(message);
  }
}

class EmployeeNetworkError extends Error {}

type UserSummary = {
  id: number;
  name: string;
  department: string;
};

type ScheduleEntry = {
  id: number;
  userId: number;
  date: string;
  department: string;
  status: string;
  user?: UserSummary;
};

type ScheduleUndo = {
  date: string;
  previousStatus: 'working' | 'off' | null;
};

type WorkDayEntry = {
  id: number;
  userId: number;
  date: string;
  department: string;
  shiftCode: string;
  shiftLabel: string;
  shiftStartMinutes?: number | null;
  shiftEndMinutes?: number | null;
  startedAt: string | Date;
  endedAt: string | Date | null;
  lateMinutes: number;
  comment: string;
  status: string;
};

type DepartmentWorkdayPresence = Pick<WorkDayEntry, 'userId' | 'date' | 'status' | 'startedAt' | 'endedAt'>;

type ShiftControlTask = {
  id: number;
  runId: number;
  title: string;
  category: string;
  sortOrder: number;
  required: boolean;
  plannedTimeMinutes: number | null;
  status: string;
  completedAt: string | Date | null;
  numericValue: number | null;
  integerValue: number | null;
  booleanValue: boolean | null;
  textValue: string | null;
  handoverData?: unknown;
  comment: string;
};

type ShiftControlRun = {
  id: number;
  workDayEntryId: number;
  userId: number;
  department: string;
  date: string;
  status: string;
  startedAt: string | Date;
  completedAt?: string | Date | null;
};

type ShiftControlState = {
  run: ShiftControlRun | null;
  tasks: ShiftControlTask[];
};

type CashOperation = {
  id: number;
  userId: number;
  workDayEntryId: number;
  date: string;
  direction: 'phone_reserve' | 'deposit_safe';
  amount: number;
  photoPath: string;
  comment: string;
  status: string;
  createdAt: string | Date;
};

type RequiredWorkdayIssue = {
  id: number;
  ruleKey: string;
  severity: string;
  title: string;
  detail: string;
  sourceData: unknown;
  originDate: string;
  detectedAt: string;
  lastDetectedAt: string;
};

type OpenPaymentCheck = {
  id: string;
  bankOperationAt: string;
  amountKopecks: number;
  detectedAt: string;
};

type WorkdayCloseException = {
  id: string;
  status: string;
  reasonCode: string;
  comment: string;
  issueIds: unknown;
  decisionComment: string;
  requestedAt: string;
  decidedAt: string | null;
  consumedAt: string | null;
};

type Props = {
  user: UserSummary;
  today: string;
  ownSchedule: ScheduleEntry[];
  departmentSchedule: ScheduleEntry[];
  departmentUsers: UserSummary[];
  departmentWorkdays: DepartmentWorkdayPresence[];
  todayWorkDay: WorkDayEntry | null;
  unfinishedWorkDay: WorkDayEntry | null;
  shiftControl: ShiftControlState;
  cashOperations: CashOperation[];
  requiredIssues: RequiredWorkdayIssue[];
  paymentChecks: OpenPaymentCheck[];
  closeExceptionRequest: WorkdayCloseException | null;
  cashEncashmentExceptionRequest: WorkdayCloseException | null;
};

type EmployeeWorkdaySnapshot = {
  workDay: WorkDayEntry | null;
  unfinishedWorkDay: WorkDayEntry | null;
  departmentWorkdays: DepartmentWorkdayPresence[];
  shiftControl: ShiftControlState;
  cashOperations: CashOperation[];
  requiredIssues: RequiredWorkdayIssue[];
  paymentChecks: OpenPaymentCheck[];
  closeExceptionRequest: WorkdayCloseException | null;
  cashEncashmentExceptionRequest: WorkdayCloseException | null;
};

type Tab = 'day' | 'schedule';
type ScheduleMode = 'list' | 'month';
type QrScannerState = 'idle' | 'starting' | 'scanning' | 'found' | 'error';
type ShiftTaskDraft = {
  numericValue: string;
  integerValue: string;
  booleanValue: boolean;
  comment: string;
  terminalReceiptsPhoto: File | null;
};
type HandoverPhotoKey =
  | 'personalStatementPhoto'
  | 'terminalReceiptsPhoto'
  | 'tbankReceiptsPhoto'
  | 'tbankTerminalReportPhoto'
  | 'zReportPhoto'
  | 'encashmentDocumentPhoto';
type HandoverSavedPhoto = {
  storagePath?: string;
  originalName?: string;
};
type HandoverPhotoValue = File | HandoverSavedPhoto | null;
type HandoverDraft = {
  personalStatementPhoto: HandoverPhotoValue;
  terminalReceiptsPhoto: HandoverPhotoValue;
  personalCashBalance: string;
  reserveCashBalance: string;
  discrepancyType: '' | 'none' | 'surplus' | 'shortage';
  discrepancyAmount: string;
  cashCommentRequired: boolean;
  terminalHadOperations: '' | 'yes' | 'no';
  terminalReconciliation: '' | 'matched' | 'discrepancy';
  terminalComment: string;
  hasTbankCredit: '' | 'yes' | 'no';
  tbankReceiptsPhoto: HandoverPhotoValue;
  tbankTerminalReportPhoto: HandoverPhotoValue;
  tbankTerminalTotal: string;
  zReportPhoto: HandoverPhotoValue;
  encashmentAmount: string;
  encashmentDirection: '' | 'phone_reserve' | 'deposit_safe';
  encashmentDocumentPhoto: HandoverPhotoValue;
  comment: string;
};
type CashOperationDraft = {
  direction: CashOperation['direction'] | null;
  amount: string;
  comment: string;
  idempotencyKey: string;
};

const staleCloseReasons = [
  'Забыл закрыть рабочий день',
  'Не удалось закончить сдачу смены',
  'Техническая проблема',
  'По указанию администратора',
  'Другое',
];

const tabs: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'day', label: 'Рабочий день', icon: Home },
  { id: 'schedule', label: 'График', icon: CalendarDays },
];

const workdaySyncIntervalMs = 60_000;
const scheduleSyncIntervalMs = 30_000;
const workdaySyncTimeoutMs = 15_000;

function parseWorkdayQrDepartment(value: string) {
  const text = value.trim();
  if (!text) return null;

  const directMatch = text.match(/^offonika-workday-start:(retail|wholesale)$/i);
  if (directMatch) return directMatch[1].toLowerCase();

  return null;
}

function cameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) return 'Не удалось открыть камеру. Попробуйте ещё раз.';
  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'Доступ к камере запрещён. Разрешите камеру для портала и попробуйте снова.';
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') return 'Камера не найдена на этом устройстве.';
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') return 'Камера занята другим приложением или временно недоступна.';
  if (error.name === 'OverconstrainedError') return 'Не удалось выбрать заднюю камеру. Попробуйте ещё раз.';
  if (error.name === 'AbortError') return 'Запуск камеры был прерван. Попробуйте ещё раз.';
  return `Камера недоступна: ${error.name}`;
}

function WorkdayQrScanner({
  userDepartment,
  onCancel,
  onAccepted,
}: {
  userDepartment: string;
  onCancel: () => void;
  onAccepted: (department: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [state, setState] = useState<QrScannerState>('idle');
  const [error, setError] = useState('');

  function stopCamera() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function scanFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
      frameRef.current = window.requestAnimationFrame(scanFrame);
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      frameRef.current = window.requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      setError('Не удалось подготовить изображение с камеры.');
      setState('error');
      stopCamera();
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });

    if (code?.data) {
      const department = parseWorkdayQrDepartment(code.data);
      if (!department) {
        setError('Это не QR-код начала рабочего дня. Отсканируйте QR-код отдела в магазине.');
        setState('error');
        stopCamera();
        return;
      }
      if (department !== userDepartment) {
        setError(department === 'retail' ? 'Этот QR-код для розницы. Отсканируйте QR своего отдела.' : 'Этот QR-код для опта. Отсканируйте QR своего отдела.');
        setState('error');
        stopCamera();
        return;
      }
      setState('found');
      stopCamera();
      window.setTimeout(() => onAccepted(department), 350);
      return;
    }

    frameRef.current = window.requestAnimationFrame(scanFrame);
  }

  async function startCamera() {
    setError('');
    setState('starting');
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException('getUserMedia is not available', 'NotSupportedError');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setState('scanning');
      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (reason) {
      stopCamera();
      setError(cameraErrorMessage(reason));
      setState('error');
    }
  }

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className='employee-material-scanner fixed inset-0 z-50 bg-slate-950 text-white'>
      <div className='mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-5'>
        <div className='mb-4 flex items-center justify-between gap-3'>
          <div>
            <p className='text-xs font-black uppercase tracking-[0.22em] text-green-300'>Начало дня</p>
            <h2 className='mt-1 text-2xl font-black leading-tight'>Отсканируйте QR отдела</h2>
          </div>
          <button type='button' onClick={onCancel} className='flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white'>
            <X className='h-6 w-6' />
          </button>
        </div>

        <div className='employee-material-camera relative flex-1 overflow-hidden rounded-3xl bg-black shadow-2xl shadow-black/40'>
          <video ref={videoRef} className='h-full w-full object-cover' muted playsInline autoPlay />
          <canvas ref={canvasRef} className='hidden' />
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <div className='employee-material-scan-frame h-56 w-56 rounded-3xl border-4 border-green-300 shadow-[0_0_0_999px_rgba(2,6,23,0.42)]' />
          </div>
          <div className='absolute inset-x-4 top-4 rounded-2xl bg-slate-950/70 px-4 py-3 text-center backdrop-blur'>
            <p className='text-sm font-extrabold'>Наведите камеру на QR-код на рабочем месте</p>
          </div>
          {state === 'starting' && (
            <div className='absolute inset-x-4 bottom-4 rounded-2xl bg-slate-950/80 px-4 py-3 text-center text-sm font-extrabold backdrop-blur'>
              <RefreshCw className='mx-auto mb-2 h-5 w-5 animate-spin text-green-300' />
              Открываю камеру
            </div>
          )}
          {state === 'found' && (
            <div className='absolute inset-4 flex items-center justify-center rounded-3xl bg-green-500/90 text-center backdrop-blur'>
              <div>
                <CheckCircle2 className='mx-auto h-14 w-14' />
                <p className='mt-3 text-2xl font-black'>QR принят</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className='employee-material-scanner-warning mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-50'>
            {error}
            <button type='button' onClick={startCamera} className='mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-amber-400 px-3 font-black text-slate-950'>
              Попробовать ещё раз
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function scheduleTone(status: string | null | undefined) {
  if (status === 'working') return 'employee-material-status employee-material-status-green';
  if (status === 'off') return 'employee-material-status employee-material-status-slate';
  return 'employee-material-status employee-material-status-amber';
}

function scheduleLabel(status: string | null | undefined) {
  if (status === 'working') return 'По графику';
  if (status === 'off') return 'Выходной';
  return 'Нет графика';
}

function scheduleWorkLabel(status: string | null | undefined) {
  if (status === 'working') return 'Работаю';
  if (status === 'off') return 'Выходной';
  return 'Не заполнено';
}

function scheduleCellLabel(status: string | null | undefined) {
  if (status === 'working') return 'раб';
  if (status === 'off') return 'вых';
  return '?';
}

function replaceScheduleRange(current: ScheduleEntry[], incoming: ScheduleEntry[], from: string, to: string) {
  const entries = new Map(
    current
      .filter((entry) => entry.date < from || entry.date > to)
      .map((entry) => [`${entry.userId}:${entry.date}`, entry]),
  );
  for (const entry of incoming) entries.set(`${entry.userId}:${entry.date}`, entry);
  return [...entries.values()].sort((left, right) => left.date.localeCompare(right.date) || left.userId - right.userId);
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function addMonths(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthTitle(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const title = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, 1)));
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function buildCalendarMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const last = new Date(Date.UTC(year, month, 0));
  const lastOffset = (last.getUTCDay() + 6) % 7;
  const daysInMonth = last.getUTCDate();
  const daysCount = startOffset + daysInMonth + (6 - lastOffset);
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - startOffset);

  return Array.from({ length: daysCount }, (_, index) => {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + index);
    return {
      date: day.toISOString().slice(0, 10),
      day: day.getUTCDate(),
      inMonth: day.getUTCMonth() === month - 1,
    };
  });
}

function factTone(status: string | null | undefined) {
  if (status === 'active') return 'employee-material-status employee-material-status-green';
  if (status === 'completed') return 'employee-material-status employee-material-status-green';
  if (status === 'missing_checkout') return 'employee-material-status employee-material-status-amber';
  return 'employee-material-status employee-material-status-slate';
}

function factLabel(status: string | null | undefined) {
  if (status === 'active') return 'Идёт';
  if (status === 'completed') return 'Завершён';
  if (status === 'missing_checkout') return 'Не завершён';
  return 'Не начат';
}

function departmentLabel(department: string | null | undefined) {
  if (department === 'wholesale') return 'Опт';
  if (department === 'operations') return 'Операции';
  return 'Розница';
}

function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function personDisplayName(name: string) {
  const shortName = name.split('/').pop()?.trim();
  return shortName || name;
}

function byName(a: UserSummary, b: UserSummary) {
  return a.name.localeCompare(b.name, 'ru');
}

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalMinutes = Math.floor(safeMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDurationWithSeconds(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function minutesToTime(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return 'не указано';
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function plannedTimeLabel(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return 'без времени';
  return minutesToTime(minutes);
}

function shiftTaskStatus(task: ShiftControlTask, now: Date) {
  if (task.status === 'done') return 'done';
  if (task.plannedTimeMinutes !== null && task.plannedTimeMinutes !== undefined && getMoscowMinutes(now) > task.plannedTimeMinutes) {
    return 'overdue';
  }
  return 'pending';
}

function shiftTaskStatusLabel(status: string) {
  if (status === 'done') return 'выполнено';
  if (status === 'overdue') return 'просрочено';
  return 'ожидает';
}

function shiftTaskIcon(task: ShiftControlTask) {
  if (task.category === 'cash') return Banknote;
  if (task.category === 'credit') return ReceiptText;
  if (task.category === 'acquiring') return CreditCard;
  if (task.category === 'opening') return Camera;
  if (task.category === 'handover') return ClipboardCheck;
  if (task.category === 'closing') return Camera;
  return Clock;
}

function shiftTaskTitle(task: ShiftControlTask) {
  if (task.category === 'cash') {
    if (task.title.includes('Финальная')) return 'Финально пересчитать наличные';
    if (task.title.includes('при входе')) return 'Пересчитать наличные при входе';
    return 'Пересчитать наличные в кассе';
  }
  if (task.category === 'acquiring') return 'Проверка операций терминала';
  if (task.category === 'credit') return task.title.replace('Проверить кредиты и рассрочки', 'Сверить кредиты / рассрочки').replace('Повторно проверить кредиты и рассрочки', 'Повторно сверить кредиты / рассрочки').replace('кредиты и рассрочки', 'кредиты / рассрочки').replace('Кредиты', 'Кредиты / рассрочки');
  if (task.category === 'opening') return 'Чек открытия смены';
  if (task.category === 'closing') return 'Чек закрытия смены';
  return task.title;
}

function shiftTaskIconClass(category: string) {
  if (category === 'cash') return 'bg-green-50 text-green-700 ring-green-100';
  if (category === 'credit') return 'bg-slate-50 text-slate-700 ring-slate-200';
  if (category === 'acquiring') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (category === 'opening') return 'bg-slate-50 text-slate-700 ring-slate-200';
  if (category === 'handover') return 'bg-amber-50 text-amber-700 ring-amber-100';
  if (category === 'closing') return 'bg-slate-100 text-slate-800 ring-slate-200';
  return 'bg-slate-50 text-primary ring-slate-200';
}

function timeUntilLabel(minutes: number | null | undefined, now: Date) {
  if (minutes === null || minutes === undefined) return 'можно выполнить сейчас';
  const diff = minutes - getMoscowMinutes(now);
  if (diff <= 0) return 'пора выполнить';
  const hours = Math.floor(diff / 60);
  const restMinutes = diff % 60;
  if (hours > 0 && restMinutes > 0) return `через ${hours} ч ${restMinutes} мин`;
  if (hours > 0) return `через ${hours} ч`;
  return `через ${restMinutes} мин`;
}

function formatShiftMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function formatTaskCompletedAt(value: string | Date | null | undefined) {
  if (!value) return null;
  return formatTime(value);
}

function terminalBoundaryTime(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatTime(date) : null;
}

function emptyShiftTaskDraft(task?: ShiftControlTask): ShiftTaskDraft {
  return {
    numericValue: task?.numericValue !== null && task?.numericValue !== undefined ? String(task.numericValue) : '',
    integerValue: task?.integerValue !== null && task?.integerValue !== undefined ? String(task.integerValue) : '',
    booleanValue: task?.booleanValue ?? false,
    comment: task?.comment ?? '',
    terminalReceiptsPhoto: null,
  };
}

function emptyHandoverDraft(): HandoverDraft {
  return {
    personalStatementPhoto: null,
    terminalReceiptsPhoto: null,
    personalCashBalance: '',
    reserveCashBalance: '',
    discrepancyType: '',
    discrepancyAmount: '',
    cashCommentRequired: false,
    terminalHadOperations: '',
    terminalReconciliation: '',
    terminalComment: '',
    hasTbankCredit: '',
    tbankReceiptsPhoto: null,
    tbankTerminalReportPhoto: null,
    tbankTerminalTotal: '',
    zReportPhoto: null,
    encashmentAmount: '',
    encashmentDirection: '',
    encashmentDocumentPhoto: null,
    comment: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizedIssueIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.map(Number).filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b)
    : [];
}

function sameIssueIds(left: number[], right: number[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function readEmployeeWorkdaySnapshot(value: unknown): EmployeeWorkdaySnapshot | null {
  if (!isRecord(value)) return null;

  const workDay = value.workDay === null ? null : isRecord(value.workDay) ? (value.workDay as WorkDayEntry) : undefined;
  const unfinishedWorkDay =
    value.unfinishedWorkDay === null ? null : isRecord(value.unfinishedWorkDay) ? (value.unfinishedWorkDay as WorkDayEntry) : undefined;
  const shiftControl = value.shiftControl;

  if (workDay === undefined || unfinishedWorkDay === undefined || !Array.isArray(value.departmentWorkdays) || !isRecord(shiftControl) || !Array.isArray(shiftControl.tasks) || !Array.isArray(value.cashOperations) || !Array.isArray(value.requiredIssues) || !Array.isArray(value.paymentChecks)) {
    return null;
  }

  const run = shiftControl.run === null ? null : isRecord(shiftControl.run) ? (shiftControl.run as ShiftControlRun) : undefined;
  if (run === undefined) return null;

  return {
    workDay,
    unfinishedWorkDay,
    departmentWorkdays: value.departmentWorkdays as DepartmentWorkdayPresence[],
    shiftControl: {
      run,
      tasks: shiftControl.tasks as ShiftControlTask[],
    },
    cashOperations: value.cashOperations as CashOperation[],
    requiredIssues: value.requiredIssues as RequiredWorkdayIssue[],
    paymentChecks: value.paymentChecks as OpenPaymentCheck[],
    closeExceptionRequest: value.closeExceptionRequest === null ? null : isRecord(value.closeExceptionRequest) ? value.closeExceptionRequest as WorkdayCloseException : null,
    cashEncashmentExceptionRequest: value.cashEncashmentExceptionRequest === null ? null : isRecord(value.cashEncashmentExceptionRequest) ? value.cashEncashmentExceptionRequest as WorkdayCloseException : null,
  };
}

function readRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? (value[key] as Record<string, unknown>) : null;
}

function hasTaskPhoto(task: ShiftControlTask, key: string) {
  const photos = readRecord(task.handoverData, 'photos');
  return Boolean(photos?.[key]);
}

function readSavedPhoto(value: unknown, key: string): HandoverSavedPhoto | null {
  const photos = readRecord(value, 'photos');
  const photo = photos?.[key];
  return isRecord(photo) ? { storagePath: typeof photo.storagePath === 'string' ? photo.storagePath : undefined, originalName: typeof photo.originalName === 'string' ? photo.originalName : undefined } : null;
}

function isHandoverFile(value: HandoverPhotoValue): value is File {
  return typeof File !== 'undefined' && value instanceof File;
}

function hasHandoverPhoto(value: HandoverPhotoValue) {
  return Boolean(value && (isHandoverFile(value) || value.storagePath));
}

function stringFromUnknown(value: unknown) {
  return value === null || value === undefined ? '' : String(value);
}

function booleanDraftValue(value: unknown): '' | 'yes' | 'no' {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '';
}

function draftFromHandoverData(data: unknown): HandoverDraft {
  const draft = emptyHandoverDraft();
  const personalCash = readRecord(data, 'personalCash');
  const reserveCash = readRecord(data, 'reserveCash');
  const storeClosing = readRecord(data, 'storeClosing');
  if (personalCash) {
    draft.personalCashBalance = stringFromUnknown(personalCash.cashBalance);
    draft.discrepancyType = ['none', 'surplus', 'shortage'].includes(String(personalCash.discrepancyType)) ? String(personalCash.discrepancyType) as HandoverDraft['discrepancyType'] : '';
    draft.discrepancyAmount = stringFromUnknown(personalCash.discrepancyAmount);
    draft.cashCommentRequired = false;
    draft.hasTbankCredit = booleanDraftValue(personalCash.hasTbankCredit);
    draft.encashmentAmount = stringFromUnknown(personalCash.encashmentAmount);
    draft.encashmentDirection = personalCash.encashmentDirection === 'phone_reserve' || personalCash.encashmentDirection === 'deposit_safe'
      ? personalCash.encashmentDirection
      : '';
  }
  if (reserveCash) {
    draft.reserveCashBalance = stringFromUnknown(reserveCash.cashBalance);
  }
  if (storeClosing) {
    draft.hasTbankCredit = booleanDraftValue(storeClosing.hasTbankCredit);
    draft.tbankTerminalTotal = stringFromUnknown(storeClosing.tbankTerminalTotal);
  }
  const terminalCheck = readRecord(data, 'terminalCheck');
  if (terminalCheck) {
    draft.terminalHadOperations = booleanDraftValue(terminalCheck.hadOperations);
    draft.terminalReconciliation = terminalCheck.reconciliation === 'matched' || terminalCheck.reconciliation === 'discrepancy'
      ? terminalCheck.reconciliation
      : '';
    draft.terminalComment = typeof terminalCheck.comment === 'string' ? terminalCheck.comment : '';
  }
  if (isRecord(data) && typeof data.comment === 'string') draft.comment = data.comment;
  draft.personalStatementPhoto = readSavedPhoto(data, 'personalStatement');
  draft.terminalReceiptsPhoto = readSavedPhoto(data, 'terminalReceipts');
  draft.tbankReceiptsPhoto = readSavedPhoto(data, 'tbankReceipts');
  draft.tbankTerminalReportPhoto = readSavedPhoto(data, 'tbankTerminalReport');
  draft.zReportPhoto = readSavedPhoto(data, 'zReport');
  draft.encashmentDocumentPhoto = readSavedPhoto(data, 'encashmentDocument');
  return draft;
}

function parseMoneyInput(value: string) {
  if (!value.trim()) return null;
  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function readIntegerFromDraft(value: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function acquiringResultLabel(integerValue: number | null | undefined, numericValue: number | null | undefined) {
  if (integerValue === 0) return 'новых операций терминала не было';
  if (integerValue === 1) return 'операции терминала сверены';
  if (integerValue === 2) return 'есть расхождение по операциям терминала';
  if (numericValue !== null && numericValue !== undefined) return 'операции терминала сверены';
  return 'результат сверки не указан';
}

function creditResultLabel(integerValue: number | null | undefined) {
  if (integerValue === 0) return 'операций Т-Банка не было';
  if (integerValue === 1) return 'проверка Т-Банка выполнена';
  if (integerValue === 2) return 'есть проблема по операциям Т-Банка';
  return 'результат сверки не указан';
}

function isStoreClosingShift(shiftCode: string | null | undefined) {
  return shiftCode === '11_20' || shiftCode === '09_20';
}

function cashOperationDirectionLabel(direction: CashOperation['direction']) {
  if (direction === 'phone_reserve') return 'в резерв';
  return 'в депозитный сейф';
}

function formatCashOperationAmount(amount: number) {
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(amount)} ₽`;
}

function shiftLabel(code: string) {
  const shift = shiftOptions.find((option) => option.code === code);
  if (!shift) return 'не выбрана';
  return shift.code === 'other' ? 'Другая смена' : shift.label;
}

function taskCountWord(count: number) {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return 'задач';
  if (last === 1) return 'задача';
  if (last >= 2 && last <= 4) return 'задачи';
  return 'задач';
}

function remainingTasksLabel(count: number, primaryCategory?: string | null) {
  if (count === 1 && primaryCategory === 'handover') return 'Осталось: сдать смену';
  return `Осталось: ${count} ${taskCountWord(count)}`;
}

function getElapsed(workDay: WorkDayEntry | null, now: Date) {
  if (!workDay) return 0;
  const start = new Date(workDay.startedAt).getTime();
  const end = workDay.endedAt ? new Date(workDay.endedAt).getTime() : now.getTime();
  return Math.max(0, end - start);
}

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className='employee-material-subcard rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-slate-200/80'>
      <p className='text-xs font-extrabold uppercase text-slate-400'>{label}</p>
      <p className='mt-0.5 text-sm font-extrabold text-slate-950'>{value}</p>
    </div>
  );
}

function ColleagueGroup({ title, people, tone, emptyLabel = 'Нет сотрудников' }: { title: string; people: UserSummary[]; tone: 'green' | 'slate' | 'amber'; emptyLabel?: string }) {
  const dotClass = tone === 'green' ? 'employee-material-status-dot-green' : tone === 'amber' ? 'employee-material-status-dot-amber' : 'employee-material-status-dot-slate';

  return (
    <section className='employee-material-subcard rounded-lg bg-white/90 p-2.5 ring-1 ring-slate-200/80'>
      <div className='mb-1.5 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <span className={cn('employee-material-status-dot', dotClass)} />
          <h3 className='text-sm font-extrabold text-slate-950'>{title}</h3>
        </div>
        <span className='text-xs font-extrabold text-slate-400'>{people.length}</span>
      </div>
      {people.length ? (
        <div className='grid gap-1.5'>
          {people.map((person) => (
            <div key={person.id} className='employee-material-person flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5'>
              <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111821] text-xs font-extrabold text-white'>
                {initials(person.name)}
              </span>
              <span className='min-w-0 truncate text-sm font-bold text-slate-800'>{person.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className='text-sm font-medium text-slate-500'>{emptyLabel}</p>
      )}
    </section>
  );
}

export function EmployeeTodayClient({
  user,
  today,
  ownSchedule,
  departmentSchedule,
  departmentUsers,
  departmentWorkdays,
  todayWorkDay,
  unfinishedWorkDay,
  shiftControl,
  cashOperations,
  requiredIssues,
  paymentChecks,
  closeExceptionRequest,
  cashEncashmentExceptionRequest,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('day');
  const [ownScheduleState, setOwnScheduleState] = useState(ownSchedule);
  const [departmentScheduleState, setDepartmentScheduleState] = useState(departmentSchedule);
  const [departmentWorkdaysState, setDepartmentWorkdaysState] = useState(departmentWorkdays);
  const [workDay, setWorkDay] = useState(todayWorkDay);
  const [unfinished, setUnfinished] = useState(unfinishedWorkDay);
  const [shiftControlState, setShiftControlState] = useState(shiftControl);
  const [cashOperationsState, setCashOperationsState] = useState(cashOperations);
  const [requiredIssuesState, setRequiredIssuesState] = useState(requiredIssues);
  const [showAllRequiredIssues, setShowAllRequiredIssues] = useState(false);
  const [paymentChecksState, setPaymentChecksState] = useState(paymentChecks);
  const [closeExceptionRequestState, setCloseExceptionRequestState] = useState(closeExceptionRequest);
  const [cashEncashmentExceptionRequestState, setCashEncashmentExceptionRequestState] = useState(cashEncashmentExceptionRequest);
  const [closeBlocked, setCloseBlocked] = useState(false);
  const [closeExceptionReason, setCloseExceptionReason] = useState('');
  const [closeExceptionComment, setCloseExceptionComment] = useState('');
  const [cashEncashmentExceptionReason, setCashEncashmentExceptionReason] = useState('');
  const [cashEncashmentExceptionComment, setCashEncashmentExceptionComment] = useState('');
  const [showCashEncashmentExceptionForm, setShowCashEncashmentExceptionForm] = useState(false);
  const [cashOperationDraft, setCashOperationDraft] = useState<CashOperationDraft>({ direction: null, amount: '', comment: '', idempotencyKey: '' });
  const [selectedShift, setSelectedShift] = useState('');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrDepartmentConfirmed, setQrDepartmentConfirmed] = useState<string | null>(null);
  const [shiftPickerOpen, setShiftPickerOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [staleCloseReason, setStaleCloseReason] = useState('');
  const [staleCloseComment, setStaleCloseComment] = useState('');
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [showInactiveColleagues, setShowInactiveColleagues] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(monthKeyFromDate(today));
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(today);
  const [expandedScheduleDates, setExpandedScheduleDates] = useState<Set<string>>(() => new Set([today]));
  const [loadedScheduleMonths, setLoadedScheduleMonths] = useState<Set<string>>(() => new Set());
  const [loadingScheduleMonth, setLoadingScheduleMonth] = useState<string | null>(null);
  const [scheduleUndo, setScheduleUndo] = useState<ScheduleUndo | null>(null);
  const [openShiftTaskId, setOpenShiftTaskId] = useState<number | null>(null);
  const [editingShiftTaskId, setEditingShiftTaskId] = useState<number | null>(null);
  const [shiftTaskDrafts, setShiftTaskDrafts] = useState<Record<number, ShiftTaskDraft>>({});
  const [shiftTaskErrors, setShiftTaskErrors] = useState<Record<number, Record<string, string>>>({});
  const [showFullShiftPlan, setShowFullShiftPlan] = useState(false);
  const [activeHandoverTaskId, setActiveHandoverTaskId] = useState<number | null>(null);
  const [handoverStep, setHandoverStep] = useState(0);
  const [handoverAttemptedStep, setHandoverAttemptedStep] = useState<string | null>(null);
  const [handoverSaveError, setHandoverSaveError] = useState('');
  const [handoverDraft, setHandoverDraft] = useState<HandoverDraft>(() => emptyHandoverDraft());
  const [openingPhotoTaskId, setOpeningPhotoTaskId] = useState<number | null>(null);
  const [openingPhotoFile, setOpeningPhotoFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [cashOutboxCount, setCashOutboxCount] = useState(0);
  const [cashOutboxSyncing, setCashOutboxSyncing] = useState(false);
  const [cashOutboxError, setCashOutboxError] = useState('');
  const [now, setNow] = useState<Date | null>(null);
  const workdaySyncAbortRef = useRef<AbortController | null>(null);
  const workdaySyncInFlightRef = useRef(false);
  const approvedCashExceptionAutoFinishRef = useRef<string | null>(null);
  const approvedRequiredIssuesAutoFinishRef = useRef<string | null>(null);
  const cashOutboxSyncingRef = useRef(false);
  const initialRenderNow = useMemo(() => new Date(`${today}T00:00:00+03:00`), [today]);
  const displayNow = now ?? initialRenderNow;

  useEffect(() => {
    const startNotice = window.sessionStorage.getItem('workdayStartNotice');
    if (startNotice) {
      window.sessionStorage.removeItem('workdayStartNotice');
      setMessage(startNotice);
    }
  }, []);

  useEffect(() => {
    const hasActiveWorkDay = Boolean(workDay && workDay.status !== 'completed' && !workDay.endedAt);
    if (activeTab !== 'day' || !hasActiveWorkDay) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [activeTab, workDay]);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => {
      setMessage('');
      setScheduleUndo(null);
    }, scheduleUndo ? 6000 : 4000);
    return () => window.clearTimeout(timer);
  }, [message, scheduleUndo]);

  const dates = useMemo(() => buildDateRange(today, 31), [today]);
  const previewDates = dates.slice(0, 7);
  const visibleDates = showFullSchedule ? dates : previewDates;
  const ownScheduleByDate = useMemo(() => new Map(ownScheduleState.map((entry) => [entry.date, entry])), [ownScheduleState]);
  const departmentScheduleByDate = useMemo(() => {
    const groups = new Map<string, ScheduleEntry[]>();
    for (const entry of departmentScheduleState) {
      const list = groups.get(entry.date) ?? [];
      list.push(entry);
      groups.set(entry.date, list);
    }
    return groups;
  }, [departmentScheduleState]);

  const isCompleted = workDay?.status === 'completed' || Boolean(workDay?.endedAt);
  const activeWorkDay = workDay && !isCompleted ? workDay : null;
  const displayedWorkDayStatus = isCompleted ? 'completed' : workDay?.status;
  const availableShiftOptions = getShiftOptionsForDepartment(user.department);
  const selectedShiftOption = availableShiftOptions.find((shift) => shift.code === selectedShift);
  const elapsedMs = getElapsed(workDay, displayNow);
  const elapsedLabel = formatDuration(elapsedMs);
  const activeElapsedLabel = formatDurationWithSeconds(elapsedMs);
  const shiftStart = workDay ? workDay.shiftStartMinutes : selectedShiftOption?.startMinutes;
  const shiftEnd = workDay ? workDay.shiftEndMinutes : selectedShiftOption?.endMinutes;
  const shiftControlEnabled = usesWorkdayShiftControl(user);
  const canUseCashOperations = shiftControlEnabled;
  const cashOperationTotal = cashOperationsState.reduce((sum, operation) => sum + operation.amount, 0);

  const syncCurrentWorkdayState = useCallback(async (replaceInFlight = false) => {
    // iOS standalone web apps can leave a fetch pending while resuming. Do not
    // abort it on the next interval: that would keep the UI on its initial
    // server snapshot forever. A sync after a user action is different: it must
    // replace an older background request so the UI cannot keep stale fields.
    if (workdaySyncInFlightRef.current) {
      if (!replaceInFlight) return;
      workdaySyncAbortRef.current?.abort();
    }

    const controller = new AbortController();
    workdaySyncAbortRef.current = controller;
    workdaySyncInFlightRef.current = true;
    const timeout = window.setTimeout(() => controller.abort(), workdaySyncTimeoutMs);

    try {
      const response = await fetch('/api/employee/workday/today', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      const snapshot = readEmployeeWorkdaySnapshot(payload);
      if (!snapshot || controller.signal.aborted) return;

      setWorkDay(snapshot.workDay);
      setUnfinished(snapshot.unfinishedWorkDay);
      setDepartmentWorkdaysState(snapshot.departmentWorkdays);
      setShiftControlState(snapshot.shiftControl);
      setCashOperationsState(snapshot.cashOperations);
      setRequiredIssuesState(snapshot.requiredIssues);
      setPaymentChecksState(snapshot.paymentChecks);
      setCloseExceptionRequestState(snapshot.closeExceptionRequest);
      setCashEncashmentExceptionRequestState(snapshot.cashEncashmentExceptionRequest);
      if (!snapshot.requiredIssues.length) setCloseBlocked(false);
    } catch {
      // Keep the last valid snapshot and retry on the next scheduled sync.
    } finally {
      window.clearTimeout(timeout);
      if (workdaySyncAbortRef.current === controller) {
        workdaySyncAbortRef.current = null;
        workdaySyncInFlightRef.current = false;
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'day') return;
    const stopVisibleSync = startVisibleSync(syncCurrentWorkdayState, workdaySyncIntervalMs);
    return () => {
      stopVisibleSync();
      workdaySyncAbortRef.current?.abort();
      workdaySyncAbortRef.current = null;
      workdaySyncInFlightRef.current = false;
    };
  }, [activeTab, syncCurrentWorkdayState]);

  const refreshCashOutboxCount = useCallback(async () => {
    try {
      const items = await listEmployeeCashOutboxItems();
      setCashOutboxCount(items.filter((item) => item.userId === user.id).length);
    } catch {
      setCashOutboxCount(0);
    }
  }, [user.id]);

  const flushCashOutbox = useCallback(async () => {
    if (cashOutboxSyncingRef.current || !navigator.onLine) return;
    cashOutboxSyncingRef.current = true;
    setCashOutboxSyncing(true);
    setCashOutboxError('');
    let saved = 0;
    let failure = '';
    try {
      const items = (await listEmployeeCashOutboxItems())
        .filter((item) => item.userId === user.id)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      for (const item of items) {
        try {
          await uploadFormData<{ operation: CashOperation }>(item.url, 'POST', cashOutboxFormData(item), 'Не удалось отправить сохранённую операцию');
          await removeEmployeeCashOutboxItem(item.id);
          saved += 1;
        } catch (reason) {
          failure = reason instanceof Error ? reason.message : 'Не удалось отправить сохранённую инкассацию.';
          break;
        }
      }
      await refreshCashOutboxCount();
      if (failure) setCashOutboxError(failure);
      if (saved > 0) {
        await syncCurrentWorkdayState(true);
        setMessage(saved === 1 ? 'Сохранённая операция отправлена в портал' : `Сохранённые операции отправлены: ${saved}`);
      }
    } catch {
      // IndexedDB can be unavailable in a private browser session. Online work
      // still follows the ordinary server path in that case.
    } finally {
      cashOutboxSyncingRef.current = false;
      setCashOutboxSyncing(false);
    }
  }, [refreshCashOutboxCount, syncCurrentWorkdayState, user.id]);

  useEffect(() => {
    const updateConnection = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (online) void flushCashOutbox();
    };
    updateConnection();
    void refreshCashOutboxCount();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    document.addEventListener('visibilitychange', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
      document.removeEventListener('visibilitychange', updateConnection);
    };
  }, [flushCashOutbox, refreshCashOutboxCount]);

  const syncScheduleState = useCallback(async () => {
    const requestedMonth = scheduleMode === 'month' ? calendarMonth : null;
    if (requestedMonth) setLoadingScheduleMonth(requestedMonth);
    try {
      const query = requestedMonth ? `?month=${encodeURIComponent(requestedMonth)}` : '';
      const response = await fetch(`/api/employee/workday/schedule${query}`, { cache: 'no-store' });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.ownSchedule) || !Array.isArray(payload.departmentSchedule)) return;
      const range = payload.range;
      if (!isRecord(range) || typeof range.from !== 'string' || typeof range.to !== 'string') return;
      setOwnScheduleState((current) => replaceScheduleRange(current, payload.ownSchedule as ScheduleEntry[], range.from as string, range.to as string));
      setDepartmentScheduleState((current) => replaceScheduleRange(current, payload.departmentSchedule as ScheduleEntry[], range.from as string, range.to as string));
      if (requestedMonth) {
        setLoadedScheduleMonths((current) => new Set(current).add(requestedMonth));
      }
    } catch {
      // Keep the last valid schedule and retry on the next visible sync.
    } finally {
      if (requestedMonth) setLoadingScheduleMonth((current) => (current === requestedMonth ? null : current));
    }
  }, [calendarMonth, scheduleMode]);

  useEffect(() => {
    if (activeTab !== 'schedule') return;
    return startVisibleSync(syncScheduleState, scheduleSyncIntervalMs);
  }, [activeTab, syncScheduleState]);

  const todayDepartmentEntries = departmentScheduleByDate.get(today) ?? [];
  const todayEntryByUser = new Map(todayDepartmentEntries.map((entry) => [entry.userId, entry]));
  const todayWorkdayByUser = new Map(departmentWorkdaysState.filter((entry) => entry.date === today).map((entry) => [entry.userId, entry]));
  const colleagueUsers = departmentUsers.filter((person) => person.id !== user.id).sort(byName);
  const todayPresence = (person: UserSummary) => colleaguePresence(todayEntryByUser.get(person.id)?.status, todayWorkdayByUser.get(person.id));
  const workingColleagues = colleagueUsers.filter((person) => todayPresence(person) === 'active');
  const completedColleagues = colleagueUsers.filter((person) => todayPresence(person) === 'completed');
  const scheduledColleagues = colleagueUsers.filter((person) => todayPresence(person) === 'scheduled');
  const offColleagues = colleagueUsers.filter((person) => todayPresence(person) === 'off');
  const missingColleagues = colleagueUsers.filter((person) => todayPresence(person) === 'missing');
  const shiftControlBelongsToToday = shiftControlState.run?.date === today;
  const shiftControlCompleted = shiftControlState.run?.status === 'completed' || shiftControlState.run?.completedAt;
  const showShiftControl =
    shiftControlEnabled &&
    Boolean(shiftControlState.run) &&
    shiftControlBelongsToToday &&
    !(isCompleted && shiftControlCompleted);
  const shiftControlTasks = shiftControlState.tasks;
  const hiddenDuringHandoverCategories = new Set(['handover', 'closing']);
  const visibleShiftControlTasks = activeHandoverTaskId
    ? shiftControlTasks.filter((task) => task.status === 'done' || !hiddenDuringHandoverCategories.has(task.category))
    : shiftControlTasks;
  const pendingShiftControlTasks = visibleShiftControlTasks.filter((task) => task.status !== 'done');
  const actionableShiftControlTask =
    pendingShiftControlTasks.find((task) => task.plannedTimeMinutes === null || task.plannedTimeMinutes === undefined || getMoscowMinutes(displayNow) >= task.plannedTimeMinutes) ?? null;
  const handoverTask = shiftControlTasks.find((task) => task.category === 'handover') ?? null;
  const isHandoverDone = handoverTask?.status === 'done';
  const activeHandoverTask = activeHandoverTaskId ? shiftControlTasks.find((task) => task.id === activeHandoverTaskId) ?? null : null;
  const nextShiftControlTask =
    actionableShiftControlTask
      ? pendingShiftControlTasks.find((task) => task.id !== actionableShiftControlTask.id) ?? null
      : pendingShiftControlTasks[0] ?? null;
  const primaryShiftControlTask = actionableShiftControlTask ?? nextShiftControlTask;
  const remainingShiftControlCount = pendingShiftControlTasks.length;
  const otherShiftControlTaskCount = pendingShiftControlTasks.filter((task) => task.id !== primaryShiftControlTask?.id).length;
  const completedKkmCloseCheck = readRecord(handoverTask?.handoverData, 'kkmCloseCheck');
  const kkmClosureConfirmed = completedKkmCloseCheck?.status === 'confirmed';
  const primaryPaymentCheck = paymentChecksState[0] ?? null;
  const primaryPaymentCheckView = primaryPaymentCheck ? terminalFiscalEmployeeReviewSummary(primaryPaymentCheck) : null;
  const kkmCloseIssue = requiredIssuesState.find((issue) => issue.ruleKey === 'kkm_shift_not_closed') ?? null;
  const showCloseResolution = requiredIssuesState.length > 0 && (closeBlocked || Boolean(kkmCloseIssue));
  const requiredIssuesForBanner = showCloseResolution
    ? requiredIssuesState.filter((issue) => issue.ruleKey !== 'kkm_shift_not_closed')
    : requiredIssuesState;
  const currentRequiredIssueIds = requiredIssuesState.map((issue) => issue.id).sort((a, b) => a - b);
  const closeExceptionMatchesCurrentIssues = Boolean(
    closeExceptionRequestState
    && sameIssueIds(normalizedIssueIds(closeExceptionRequestState.issueIds), currentRequiredIssueIds),
  );
  function buildHandoverSteps(draft = handoverDraft) {
    const draftCashBalance = parseMoneyInput(draft.personalCashBalance);
    return buildShiftHandoverSteps({
      personalCashBalance: draftCashBalance,
      cashCommentRequired: draft.cashCommentRequired,
      isRetail: user.department === 'retail',
      isStoreClosingShift: isStoreClosingShift(activeWorkDay?.shiftCode ?? workDay?.shiftCode),
      requiresKkmClose: user.department === 'retail',
    });
  }
  const handoverSteps = buildHandoverSteps(handoverDraft);
  const calendarDays = useMemo(() => buildCalendarMonth(calendarMonth), [calendarMonth]);
  const scheduleMonthLoaded = loadedScheduleMonths.has(calendarMonth);
  const scheduleMonthLoading = loadingScheduleMonth === calendarMonth;

  useEffect(() => {
    if (!handoverTask || handoverTask.status === 'done' || activeHandoverTaskId) return;
    if (isRecord(handoverTask.handoverData) && handoverTask.handoverData.draft !== false) {
      startHandoverWizard(handoverTask);
    }
  }, [activeHandoverTaskId, handoverTask?.id, handoverTask?.status]);

  function getColleagueRows(date: string) {
    const entries = departmentScheduleByDate.get(date) ?? [];
    const entryByUser = new Map(entries.map((entry) => [entry.userId, entry]));
    const statusRank = (status?: string) => status === 'working' ? 0 : status === 'off' ? 1 : 2;
    return colleagueUsers
      .map((person) => ({
        person,
        entry: entryByUser.get(person.id),
      }))
      .sort((left, right) => statusRank(left.entry?.status) - statusRank(right.entry?.status) || left.person.name.localeCompare(right.person.name, 'ru'));
  }

  function getWorkingInitials(date: string) {
    const entries = departmentScheduleByDate.get(date) ?? [];
    const entryByUser = new Map(entries.map((entry) => [entry.userId, entry]));
    const working = colleagueUsers.filter((person) => entryByUser.get(person.id)?.status === 'working');
    return {
      initials: working.slice(0, 2).map((person) => initials(person.name)),
      extraCount: Math.max(0, working.length - 2),
    };
  }

  function applySchedulePayload(payload: unknown) {
    if (!isRecord(payload) || !Array.isArray(payload.ownSchedule) || !Array.isArray(payload.departmentSchedule) || !isRecord(payload.range)) return false;
    const { from, to, monthKey } = payload.range;
    if (typeof from !== 'string' || typeof to !== 'string') return false;
    setOwnScheduleState((current) => replaceScheduleRange(current, payload.ownSchedule as ScheduleEntry[], from, to));
    setDepartmentScheduleState((current) => replaceScheduleRange(current, payload.departmentSchedule as ScheduleEntry[], from, to));
    if (typeof monthKey === 'string') setLoadedScheduleMonths((current) => new Set(current).add(monthKey));
    return true;
  }

  function ScheduleDayCard({ date, selected = false }: { date: string; selected?: boolean }) {
    const ownEntry = ownScheduleByDate.get(date);
    const colleagueRows = getColleagueRows(date);
    const selectedWorkingRows = colleagueRows.filter(({ entry }) => entry?.status === 'working');
    const selectedOffRows = colleagueRows.filter(({ entry }) => entry?.status === 'off');
    const selectedMissingRows = colleagueRows.filter(({ entry }) => !entry);
    const expanded = selected || expandedScheduleDates.has(date);
    const colleagueSummary = [
      selectedWorkingRows.length === 0
        ? 'Коллеги: никто не работает'
        : `Коллеги: ${selectedWorkingRows.length === 1 ? 'работает' : 'работают'} ${selectedWorkingRows.length}`,
      selectedOffRows.length ? `выходной ${selectedOffRows.length}` : '',
      selectedMissingRows.length ? `без графика ${selectedMissingRows.length}` : '',
    ].filter(Boolean).join(' · ');

    function SelectedColleagueGroup({ title, rows, tone }: { title: string; rows: typeof colleagueRows; tone: 'green' | 'slate' | 'amber' }) {
      const dotClass = tone === 'green' ? 'employee-material-status-dot-green' : tone === 'amber' ? 'employee-material-status-dot-amber' : 'employee-material-status-dot-slate';

      return (
        <div className='employee-material-subcard rounded-lg bg-slate-50 px-2.5 py-2'>
          <div className='mb-1.5 flex items-center justify-between gap-2'>
            <span className='inline-flex items-center gap-2 text-xs font-extrabold text-slate-700'>
              <span className={cn('employee-material-status-dot h-2 w-2', dotClass)} />
              {title}
            </span>
            <span className='text-xs font-extrabold text-slate-400'>{rows.length}</span>
          </div>
          {rows.length ? (
            <div className='grid gap-1'>
              {rows.map(({ person }) => (
                <div key={person.id} className='flex min-w-0 items-center gap-2'>
                  <span className='flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold text-green-800 ring-1 ring-green-100'>
                    {initials(person.name)}
                  </span>
                  <span className='min-w-0 text-sm font-bold leading-tight text-slate-700'>{personDisplayName(person.name)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-xs font-medium text-slate-400'>Нет сотрудников</p>
          )}
        </div>
      );
    }

    return (
      <div className={cn('employee-material-day-card rounded-lg border bg-white p-3', selected ? 'border-primary/40 ring-2 ring-primary/10' : 'border-slate-200')}>
        <div className={cn('flex items-center justify-between gap-3', expanded && 'mb-2.5')}>
          <div className='min-w-0'>
            <p className='truncate text-base font-extrabold text-slate-950'>{formatDateLabel(date)}</p>
            {ownEntry?.status === 'working' && <p className='mt-0.5 text-xs font-bold text-green-700'>Рабочий день</p>}
          </div>
          <Badge className={cn('shrink-0 whitespace-nowrap px-2 py-0.5 text-xs', scheduleTone(ownEntry?.status))}>
            Я: {scheduleWorkLabel(ownEntry?.status)}
          </Badge>
        </div>

        {!selected && (
          <button
            type='button'
            className={cn('flex min-h-9 w-full items-center justify-between gap-2 text-left text-xs font-bold text-slate-500', expanded && 'mt-2 border-t border-slate-100 pt-2')}
            onClick={() => setExpandedScheduleDates((current) => {
              const next = new Set(current);
              if (next.has(date)) next.delete(date);
              else next.add(date);
              return next;
            })}
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Коллеги' : colleagueSummary}</span>
            {expanded ? <ChevronUp className='h-4 w-4 shrink-0' /> : <ChevronDown className='h-4 w-4 shrink-0' />}
          </button>
        )}

        {expanded && (
          <>
            <div className={cn('grid grid-cols-2 gap-2', !selected && 'mt-2')}>
              <Button
                className={cn('h-10 rounded-lg', ownEntry?.status !== 'working' && 'bg-slate-100 text-slate-700 shadow-none hover:bg-green-100 hover:text-green-800')}
                onClick={() => updateSchedule(date, 'working')}
                disabled={isSaving}
              >
                Работаю
              </Button>
              <Button
                className={cn('h-10 rounded-lg', ownEntry?.status === 'off' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200')}
                onClick={() => updateSchedule(date, 'off')}
                disabled={isSaving}
              >
                Выходной
              </Button>
            </div>

            <div className='mt-3 border-t border-slate-100 pt-2.5'>
              <p className='mb-2 text-xs font-extrabold uppercase leading-none text-slate-400'>
                {selected ? 'Коллеги на этот день' : 'Коллеги'}
              </p>
              {selected ? (
                <div className='grid gap-1.5'>
                  <SelectedColleagueGroup title='Работают' rows={selectedWorkingRows} tone='green' />
                  <SelectedColleagueGroup title='Выходной' rows={selectedOffRows} tone='slate' />
                  <SelectedColleagueGroup title='Не заполнено' rows={selectedMissingRows} tone='amber' />
                </div>
              ) : colleagueRows.length ? (
                <div className='grid gap-1.5'>
                  {colleagueRows.map(({ person, entry }) => (
                    <div key={person.id} className='employee-material-subcard flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5'>
                      <div className='flex min-w-0 items-center gap-2'>
                        <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-[11px] font-extrabold text-green-800'>
                          {initials(person.name)}
                        </span>
                        <span className='min-w-0 text-sm font-bold leading-tight text-slate-700'>{personDisplayName(person.name)}</span>
                      </div>
                      <span className={cn('shrink-0 text-xs font-extrabold', entry?.status === 'working' ? 'text-green-700' : entry?.status === 'off' ? 'text-slate-500' : 'text-amber-700')}>
                        {scheduleWorkLabel(entry?.status)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className='text-sm font-medium text-slate-400'>Нет коллег из отдела.</p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  async function updateSchedule(date: string, status: 'working' | 'off') {
    const previousStatus = ownScheduleByDate.get(date)?.status;
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/workday/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось обновить график');
      if (!applySchedulePayload(payload)) throw new Error('Сервер вернул неполные данные графика');
      setScheduleUndo({ date, previousStatus: previousStatus === 'working' || previousStatus === 'off' ? previousStatus : null });
      setMessage('График сохранён');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить график');
    } finally {
      setIsSaving(false);
    }
  }

  async function undoScheduleChange() {
    if (!scheduleUndo) return;
    const undo = scheduleUndo;
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const response = undo.previousStatus
        ? await fetch('/api/employee/workday/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ date: undo.date, status: undo.previousStatus }),
          })
        : await fetch(`/api/employee/workday/schedule?date=${encodeURIComponent(undo.date)}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось отменить изменение');
      if (!applySchedulePayload(payload)) throw new Error('Сервер вернул неполные данные графика');
      setScheduleUndo(null);
      setMessage('Изменение отменено');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отменить изменение');
    } finally {
      setIsSaving(false);
    }
  }

  function openQrStart() {
    setError('');
    setMessage('');
    if (workDay) return;
    if (unfinished) {
      setError('Сначала закройте предыдущий рабочий день');
      return;
    }
    if (user.department !== 'retail' && user.department !== 'wholesale') {
      setError('QR-старт доступен только для розницы и опта');
      return;
    }
    setQrScannerOpen(true);
  }

  async function handleQrAccepted(department: string) {
    setQrScannerOpen(false);
    setQrDepartmentConfirmed(department);
    setMessage('');
    setError('');
    setShiftPickerOpen(true);
  }

  async function chooseShiftAfterQr(value: string) {
    setSelectedShift(value);
    if (value && qrDepartmentConfirmed && !workDay && !isSaving) {
      setShiftPickerOpen(false);
      await startWorkDay(value, qrDepartmentConfirmed);
    }
  }

  async function startWorkDay(shiftCodeOverride = selectedShift, qrDepartmentOverride = qrDepartmentConfirmed) {
    setError('');
    setMessage('');
    if (!qrDepartmentOverride) {
      setError('Сначала отсканируйте QR-код отдела');
      return;
    }
    if (qrDepartmentOverride !== user.department) {
      setError('QR-код не совпадает с вашим отделом');
      return;
    }
    if (!shiftCodeOverride) {
      setError('Выберите смену перед началом рабочего дня');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/workday/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftCode: shiftCodeOverride, comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось начать рабочий день');
      // Safari/PWA can retain pre-start values in part of the React tree even
      // after the workday response is applied. Use the same full reload that
      // reliably refreshes these values when the employee does it manually.
      window.location.reload();
      return;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось начать рабочий день');
    } finally {
      setIsSaving(false);
    }
  }

  async function finishWorkDay() {
    setError('');
    setMessage('');
    if (shiftControlEnabled && showShiftControl && handoverTask && !isHandoverDone) {
      setError('Сначала сдайте смену');
      setShowFullShiftPlan(false);
      if (canActOnShiftTask(handoverTask)) startHandoverWizard(handoverTask);
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/workday/finish', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.code === 'OPEN_REQUIRED_ISSUES') {
          setCloseBlocked(true);
          if (Array.isArray(payload.issues)) setRequiredIssuesState(payload.issues);
          window.setTimeout(() => document.getElementById('employee-close-exception')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
          return;
        }
        throw new Error(payload.error || 'Не удалось завершить рабочий день');
      }
      if (payload.workDay.date === today) setWorkDay(payload.workDay);
      setUnfinished(null);
      setNow(new Date());
      await syncCurrentWorkdayState(true);
      setMessage('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось завершить рабочий день');
    } finally {
      setIsSaving(false);
    }
  }

  async function finishUnfinishedWorkDay() {
    if (!unfinished) return;
    setError('');
    setMessage('');
    if (!staleCloseReason) {
      setError('Выберите причину закрытия предыдущего дня без сдачи смены');
      return;
    }
    if (!staleCloseComment.trim()) {
      setError('Добавьте комментарий. Он поможет администратору разобраться в ситуации.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/workday/finish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workDayId: unfinished.id,
          closeStale: true,
          staleCloseReason,
          staleCloseComment,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (payload.code === 'OPEN_REQUIRED_ISSUES') {
          setCloseBlocked(true);
          if (Array.isArray(payload.issues)) setRequiredIssuesState(payload.issues);
          window.setTimeout(() => document.getElementById('employee-close-exception')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
          return;
        }
        throw new Error(payload.error || 'Не удалось завершить предыдущий рабочий день');
      }
      setUnfinished(null);
      setStaleCloseReason('');
      setStaleCloseComment('');
      setNow(new Date());
      await syncCurrentWorkdayState(true);
      setMessage(payload.staleClosed ? 'Предыдущий рабочий день закрыт' : 'Рабочий день завершён');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось завершить предыдущий рабочий день');
    } finally {
      setIsSaving(false);
    }
  }

  async function requestCloseException() {
    if (!closeExceptionReason) {
      setError('Выберите техническую причину');
      return;
    }
    if (!closeExceptionComment.trim()) {
      setError('Коротко опишите, почему исправить сейчас невозможно');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/employee/workday/close-exception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: closeExceptionReason, comment: closeExceptionComment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось отправить запрос');
      setCloseExceptionRequestState(payload.request);
      setMessage(payload.created === false ? 'Запрос уже ожидает решения' : 'Запрос отправлен администратору');
      await syncCurrentWorkdayState(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить запрос');
    } finally {
      setIsSaving(false);
    }
  }

  async function requestCashEncashmentException() {
    if (!cashEncashmentExceptionReason) {
      setError('Выберите причину');
      return;
    }
    if (!cashEncashmentExceptionComment.trim()) {
      setError('Коротко укажите, где сейчас деньги');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const response = await fetch('/api/employee/workday/cash-encashment-exception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: cashEncashmentExceptionReason, comment: cashEncashmentExceptionComment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось отправить запрос');
      setCashEncashmentExceptionRequestState(payload.request);
      setShowCashEncashmentExceptionForm(false);
      setMessage(payload.created === false ? 'Запрос уже ожидает решения' : 'Запрос отправлен администратору');
      await syncCurrentWorkdayState(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить запрос');
    } finally {
      setIsSaving(false);
    }
  }

  function updateShiftTaskDraft(taskId: number, patch: Partial<ShiftTaskDraft>) {
    setShiftTaskDrafts((current) => ({
      ...current,
      [taskId]: { ...emptyShiftTaskDraft(), ...current[taskId], ...patch },
    }));
    setShiftTaskErrors((current) => ({ ...current, [taskId]: {} }));
  }

  function openShiftTaskForm(task: ShiftControlTask) {
    setOpenShiftTaskId((current) => (current === task.id ? null : task.id));
    setShiftTaskDrafts((current) => ({
      ...current,
      [task.id]: current[task.id] ?? emptyShiftTaskDraft(task),
    }));
    setShiftTaskErrors((current) => ({ ...current, [task.id]: {} }));
  }

  function editCompletedShiftTask(task: ShiftControlTask) {
    if (!activeWorkDay || task.category === 'handover' || task.category === 'closing') return;
    setEditingShiftTaskId(task.id);
    setOpenShiftTaskId(task.id);
    setShiftTaskDrafts((current) => ({ ...current, [task.id]: emptyShiftTaskDraft(task) }));
    setShiftTaskErrors((current) => ({ ...current, [task.id]: {} }));
    setShowFullShiftPlan(true);
    setError('');
    setMessage('');
  }

  function firstIncompleteHandoverStep(draft: HandoverDraft) {
    const steps = buildHandoverSteps(draft);
    const index = steps.findIndex((step) => getHandoverStepError(step, draft));
    return index === -1 ? Math.max(0, steps.length - 1) : index;
  }

  function startHandoverWizard(task: ShiftControlTask) {
    const restoredDraft = isRecord(task.handoverData) ? draftFromHandoverData(task.handoverData) : emptyHandoverDraft();
    setActiveHandoverTaskId(task.id);
    setHandoverDraft(restoredDraft);
    setHandoverStep(firstIncompleteHandoverStep(restoredDraft));
    setHandoverAttemptedStep(null);
    setHandoverSaveError('');
    setShowFullShiftPlan(false);
    setError('');
    setMessage('');
  }

  function updateHandoverDraft(patch: Partial<HandoverDraft>) {
    setHandoverDraft((current) => ({ ...current, ...patch }));
    setHandoverSaveError('');
  }

  function openCashOperation(direction: CashOperation['direction']) {
    setCashOperationDraft({ direction, amount: '', comment: '', idempotencyKey: createIdempotencyKey() });
    setError('');
    setMessage('');
  }

  async function submitCashOperation(file: File | null) {
    if (!cashOperationDraft.direction) return;
    if (!file) return;

    const amount = parseMoneyInput(cashOperationDraft.amount);
    if (amount === null) {
      setError('Укажите сумму перед фото');
      return;
    }

    const formData = new FormData();
    formData.append('direction', cashOperationDraft.direction);
    formData.append('amount', cashOperationDraft.amount);
    formData.append('comment', cashOperationDraft.comment);
    formData.append('idempotencyKey', cashOperationDraft.idempotencyKey);
    formData.append('photo', file);

    const outboxItem: EmployeeCashOutboxItem = {
      id: cashOperationDraft.idempotencyKey,
      userId: user.id,
      createdAt: new Date().toISOString(),
      url: '/api/employee/cash-operations',
      direction: cashOperationDraft.direction,
      amount: cashOperationDraft.amount,
      comment: cashOperationDraft.comment,
      photo: file,
      photoName: file.name || `cash-operation-${cashOperationDraft.idempotencyKey}.jpg`,
      photoType: file.type || 'image/jpeg',
      lastError: '',
    };

    setError('');
    setIsSaving(true);
    let savedLocally = false;
    try {
      try {
        await saveEmployeeCashOutboxItem(outboxItem);
        savedLocally = true;
        await refreshCashOutboxCount();
      } catch {
        savedLocally = false;
      }
      const result = await uploadFormData<{ operation: CashOperation; message?: string }>(
        '/api/employee/cash-operations',
        'POST',
        formData,
        'Не удалось сохранить кассовую операцию',
        setUploadProgress,
      );

      if (savedLocally) await removeEmployeeCashOutboxItem(outboxItem.id);
      await refreshCashOutboxCount();
      setCashOperationsState((current) => [result.operation, ...current]);
      setCashOperationDraft({ direction: null, amount: '', comment: '', idempotencyKey: '' });
      await syncCurrentWorkdayState(true);
      setMessage(result.message ?? `Зафиксировано: ${formatCashOperationAmount(result.operation.amount)} ${cashOperationDirectionLabel(result.operation.direction)}`);
    } catch (reason) {
      if (reason instanceof EmployeeNetworkError && savedLocally) {
        setCashOperationDraft({ direction: null, amount: '', comment: '', idempotencyKey: '' });
        setMessage('Связь прервалась. Операция и фото сохранены на телефоне и отправятся автоматически.');
        await refreshCashOutboxCount();
      } else {
        if (savedLocally) {
          await removeEmployeeCashOutboxItem(outboxItem.id).catch(() => undefined);
          await refreshCashOutboxCount();
        }
        setError(reason instanceof Error ? reason.message : 'Не удалось сохранить кассовую операцию');
      }
    } finally {
      setUploadProgress(null);
      setIsSaving(false);
    }
  }

  async function saveHandoverDraft(task: ShiftControlTask, draft = handoverDraft) {
    const formData = new FormData();
    formData.append('intent', 'draft');
    ([
      'personalStatementPhoto',
      'terminalReceiptsPhoto',
      'tbankReceiptsPhoto',
      'tbankTerminalReportPhoto',
      'zReportPhoto',
      'encashmentDocumentPhoto',
    ] as HandoverPhotoKey[]).forEach((key) => {
      const file = draft[key];
      if (isHandoverFile(file)) formData.append(key, file);
    });
    formData.append('personalCashBalance', draft.personalCashBalance);
    formData.append('reserveCashBalance', draft.reserveCashBalance);
    formData.append('discrepancyType', draft.discrepancyType);
    formData.append('discrepancyAmount', draft.discrepancyAmount);
    formData.append('terminalHadOperations', draft.terminalHadOperations ? String(draft.terminalHadOperations === 'yes') : '');
    formData.append('terminalReconciliation', draft.terminalReconciliation);
    formData.append('terminalComment', draft.terminalComment);
    formData.append('hasTbankCredit', draft.hasTbankCredit ? String(draft.hasTbankCredit === 'yes') : '');
    formData.append('tbankTerminalTotal', draft.tbankTerminalTotal);
    formData.append('encashmentAmount', draft.encashmentAmount);
    formData.append('encashmentDirection', draft.encashmentDirection);
    formData.append('comment', draft.comment);

    const result = await submitFormData<{ task: ShiftControlTask }>(
      '/api/employee/shift-control/tasks/' + task.id,
      'PATCH',
      formData,
      'Не удалось сохранить шаг',
      setUploadProgress,
    );
    setShiftControlState((current) => ({
      ...current,
      tasks: current.tasks.map((item) => (item.id === result.task.id ? result.task : item)),
    }));
    return result.task as ShiftControlTask;
  }

  function shiftControlPhotoMessage(tasks: ShiftControlTask[], completedTaskId: number) {
    const pendingTasks = tasks.filter((task) => task.status !== 'done' && task.id !== completedTaskId);
    const nextActionable = pendingTasks.find((task) => task.plannedTimeMinutes === null || task.plannedTimeMinutes === undefined || getMoscowMinutes(new Date()) >= task.plannedTimeMinutes);
    if (nextActionable) return 'Фото прикреплено';

    const nextTask = pendingTasks[0];
    if (nextTask?.plannedTimeMinutes !== null && nextTask?.plannedTimeMinutes !== undefined) {
      return `Фото прикреплено. Следующая проверка в ${plannedTimeLabel(nextTask.plannedTimeMinutes)}.`;
    }
    return 'Фото прикреплено';
  }

  async function completeOpeningPhotoTask(task: ShiftControlTask, file: File) {
    setError('');
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('openingReportPhoto', file);
      const result = await uploadFormData<{ task: ShiftControlTask }>(
        `/api/employee/shift-control/tasks/${task.id}`,
        'PATCH',
        formData,
        'Не удалось обновить задачу',
        setUploadProgress,
      );

      const nextTasks = shiftControlState.tasks.map((item) => (item.id === result.task.id ? result.task : item));
      setShiftControlState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === result.task.id ? result.task : item)),
      }));
      setOpenShiftTaskId(null);
      setOpeningPhotoTaskId(null);
      setOpeningPhotoFile(null);
      setEditingShiftTaskId(null);
      setShiftTaskDrafts((current) => ({
        ...current,
        [result.task.id]: emptyShiftTaskDraft(result.task),
      }));
      await syncCurrentWorkdayState(true);
      setMessage(shiftControlPhotoMessage(nextTasks, result.task.id));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Не удалось обновить задачу';
      if (openShiftTaskId === task.id) {
        setShiftTaskErrors((current) => ({ ...current, [task.id]: { form: message } }));
      } else {
        setError(message);
      }
    } finally {
      setUploadProgress(null);
      setIsSaving(false);
    }
  }

  async function completeShiftControlTask(task: ShiftControlTask, draftOverride?: ShiftTaskDraft) {
    const draft = draftOverride ?? shiftTaskDrafts[task.id] ?? emptyShiftTaskDraft(task);
    const localErrors: Record<string, string> = {};
    const payload: {
      status: 'done';
      numericValue?: string;
      integerValue?: string;
      booleanValue?: boolean;
      comment?: string;
      textValue?: string;
    } = { status: 'done' };

    if (task.category === 'cash') {
      if (parseMoneyInput(draft.numericValue) === null) {
        localErrors.numericValue = 'Введите фактически пересчитанную сумму наличных';
      }
      payload.numericValue = draft.numericValue;
      payload.comment = draft.comment;
    } else if (task.category === 'acquiring') {
      const acquiringCheckStatus = readIntegerFromDraft(draft.integerValue);
      if (acquiringCheckStatus === null || ![0, 1, 2].includes(acquiringCheckStatus)) localErrors.integerValue = 'Ответьте на вопросы проверки терминала';
      if ((acquiringCheckStatus === 1 || acquiringCheckStatus === 2) && !draft.terminalReceiptsPhoto && !hasTaskPhoto(task, 'terminalReceipts')) {
        localErrors.form = 'Сфотографируйте новые чеки терминала';
      }
      if (acquiringCheckStatus === 2 && !draft.comment.trim()) localErrors.comment = 'Опишите расхождение по операциям терминала';
      payload.integerValue = draft.integerValue;
      payload.booleanValue = acquiringCheckStatus !== 2;
      payload.numericValue = '0';
      payload.comment = acquiringCheckStatus === 0 ? '' : draft.comment;
    } else if (task.category === 'credit') {
      const creditCheckStatus = readIntegerFromDraft(draft.integerValue);
      if (creditCheckStatus === null || ![0, 1, 2].includes(creditCheckStatus)) localErrors.integerValue = 'Выберите результат сверки';
      if (creditCheckStatus === 2 && !draft.comment.trim()) localErrors.comment = 'Опишите проблему по операциям Т-Банка';
      payload.integerValue = draft.integerValue;
      payload.booleanValue = creditCheckStatus !== 2;
      payload.comment = creditCheckStatus === 0 ? '' : draft.comment;
    } else if (task.category === 'opening') {
      if (!openingPhotoFile) {
        setError('Сделайте фото чека открытия смены');
        return;
      }
    } else if (task.category === 'handover') {
      startHandoverWizard(task);
      return;
    } else {
      payload.comment = draft.comment;
      payload.textValue = draft.comment;
    }

    if (Object.keys(localErrors).length > 0) {
      setShiftTaskErrors((current) => ({ ...current, [task.id]: localErrors }));
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      const requestBody =
        task.category === 'opening'
          ? (() => {
              const formData = new FormData();
              formData.append('openingReportPhoto', openingPhotoFile as File);
              return formData;
            })()
          : task.category === 'acquiring'
            ? (() => {
                const formData = new FormData();
                formData.append('integerValue', payload.integerValue ?? '');
                formData.append('comment', payload.comment ?? '');
                if (draft.terminalReceiptsPhoto) formData.append('terminalReceiptsPhoto', draft.terminalReceiptsPhoto);
                return formData;
              })()
          : JSON.stringify(payload);
      const result = requestBody instanceof FormData
        ? await uploadFormData<{ task: ShiftControlTask }>(
            `/api/employee/shift-control/tasks/${task.id}`,
            'PATCH',
            requestBody,
            'Не удалось обновить задачу',
            setUploadProgress,
          )
        : await (async () => {
            const response = await fetch(`/api/employee/shift-control/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: requestBody,
            });
            const responsePayload = await response.json();
            if (!response.ok) throw new Error(responsePayload.error || 'Не удалось обновить задачу');
            return responsePayload as { task: ShiftControlTask };
          })();

      if (!result) return;

      setShiftControlState((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === result.task.id ? result.task : task)),
      }));
      setOpenShiftTaskId(null);
      setOpeningPhotoTaskId(null);
      setOpeningPhotoFile(null);
      setEditingShiftTaskId(null);
      setShiftTaskErrors((current) => ({ ...current, [result.task.id]: {} }));
      setShiftTaskDrafts((current) => ({
        ...current,
        [result.task.id]: emptyShiftTaskDraft(result.task),
      }));
      await syncCurrentWorkdayState(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить задачу');
    } finally {
      setUploadProgress(null);
      setIsSaving(false);
    }
  }

  function canActOnShiftTask(task: ShiftControlTask) {
    if (task.status === 'done') return editingShiftTaskId === task.id;
    return task.plannedTimeMinutes === null || task.plannedTimeMinutes === undefined || getMoscowMinutes(displayNow) >= task.plannedTimeMinutes;
  }

  function renderShiftTaskAnswer(task: ShiftControlTask, compact = false) {
    if (task.status !== 'done') return null;

    const completedAt = formatTaskCompletedAt(task.completedAt);
    const money = formatShiftMoney(task.numericValue);

    if (compact) {
      const parts: string[] = [];
      if (task.category === 'cash') {
        if (money) parts.push(`факт наличных: ${money} ₽`);
      } else if (task.category === 'acquiring') {
        parts.push(acquiringResultLabel(task.integerValue, task.numericValue));
        if (task.category === 'acquiring' && task.comment) parts.push(task.comment);
      } else if (task.category === 'credit') {
        parts.push(creditResultLabel(task.integerValue));
        if (task.comment) parts.push(task.comment);
      } else if (task.comment) {
        parts.push(task.comment);
      }
      if (completedAt) parts.push(`выполнено ${completedAt}`);

      return (
        <div className='mt-1 grid gap-1.5'>
          <p className='text-xs font-bold leading-snug text-slate-500'>{parts.join(' · ')}</p>
          {activeWorkDay && task.category !== 'handover' && task.category !== 'closing' && (
            <button type='button' className='w-fit text-xs font-extrabold text-primary underline-offset-2 hover:underline' onClick={() => editCompletedShiftTask(task)}>
              {task.category === 'cash' ? 'Исправить ввод' : 'Исправить ответ'}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className='mt-2 rounded-lg bg-green-50 px-2.5 py-2 text-xs font-bold leading-snug text-green-900 ring-1 ring-green-100'>
        {task.category === 'cash' && money && (
          <div className='grid gap-1'>
            <p>Фактически: {money} ₽</p>
            {task.comment && <p className='text-green-800/80'>Комментарий: {task.comment}</p>}
          </div>
        )}
        {task.category === 'acquiring' && (
          <div className='grid gap-0.5'>
            <p>{acquiringResultLabel(task.integerValue, task.numericValue)}</p>
            {task.comment && <p className='text-green-800/80'>Комментарий: {task.comment}</p>}
          </div>
        )}
        {task.category === 'credit' && (
          <div className='grid gap-0.5'>
            <p>{creditResultLabel(task.integerValue)}</p>
            {task.comment && <p className='text-green-800/80'>Комментарий: {task.comment}</p>}
          </div>
        )}
        {task.category !== 'cash' && task.category !== 'acquiring' && task.category !== 'credit' && task.comment && (
          <p>Комментарий: {task.comment}</p>
        )}
        {completedAt && <p className='mt-1 text-green-800/70'>Выполнено: {completedAt}</p>}
        {activeWorkDay && task.category !== 'handover' && task.category !== 'closing' && (
          <button type='button' className='mt-1 text-xs font-extrabold text-primary underline-offset-2 hover:underline' onClick={() => editCompletedShiftTask(task)}>
            {task.category === 'cash' ? 'Исправить ввод' : 'Исправить ответ'}
          </button>
        )}
      </div>
    );
  }

  function renderShiftTaskAction(task: ShiftControlTask, compact = false) {
    const isEditing = editingShiftTaskId === task.id;
    if (task.status === 'done' && !isEditing) return renderShiftTaskAnswer(task);
    if (!canActOnShiftTask(task)) return null;

    const draft = shiftTaskDrafts[task.id] ?? emptyShiftTaskDraft(task);
    const isOpen = openShiftTaskId === task.id;
    const isCash = task.category === 'cash';
    const isAcquiring = task.category === 'acquiring';
    const isCredit = task.category === 'credit';
    const isOpening = task.category === 'opening';
    const simpleLabel = task.category === 'handover' ? 'Начать сдачу смены' : 'Подтвердить';
    const errors = shiftTaskErrors[task.id] ?? {};
    const showTerminalReconciliation = isAcquiring && draft.integerValue !== '' && draft.integerValue !== '0';
    const showTerminalPhoto = isAcquiring && ['1', '2'].includes(draft.integerValue);
    const photoCompletesTaskAutomatically = showTerminalPhoto && !hasTaskPhoto(task, 'terminalReceipts');
    const previousTerminalTask = isAcquiring
      ? shiftControlState.tasks
          .filter((item) => item.category === 'acquiring' && item.status === 'done' && item.id !== task.id && item.completedAt)
          .sort((left, right) => new Date(right.completedAt as string | Date).getTime() - new Date(left.completedAt as string | Date).getTime())[0]
      : null;
    const previousTerminalTime = terminalBoundaryTime(previousTerminalTask?.completedAt);
    const terminalPhotoHint = previousTerminalTime
      ? `Сфотографируйте чеки после ${previousTerminalTime}.`
      : previousTerminalTask
        ? 'Сфотографируйте чеки после предыдущей проверки.'
      : 'Сфотографируйте чеки с начала смены.';

    if (isOpening) {
      return (
        <div className='mt-2 grid gap-2'>
          <p className={cn('font-semibold leading-snug text-slate-500', compact ? 'text-sm' : 'text-xs')}>
            Откройте смену на кассе и сфотографируйте распечатанный чек.
          </p>
          <label className={cn('employee-material-primary-action flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#111821] px-3 font-extrabold text-white shadow-sm', compact ? 'min-h-12 text-base' : 'min-h-8 text-xs')}>
            {isSaving && openingPhotoTaskId === task.id ? photoSavingLabel(uploadProgress) : isEditing ? 'Заменить фото' : 'Сделать фото'}
            <input
              type='file'
              accept='image/*'
              capture='environment'
              className='sr-only'
              disabled={isSaving}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.currentTarget.value = '';
                if (!file) return;
                setOpeningPhotoTaskId(task.id);
                setOpeningPhotoFile(file);
                completeOpeningPhotoTask(task, file);
              }}
            />
          </label>
        </div>
      );
    }

    if (!isCash && !isAcquiring && !isCredit) {
      return (
        <Button
          className={cn('employee-material-primary-action mt-2 w-full font-extrabold', compact ? 'h-12 rounded-xl text-base' : 'h-8 text-xs')}
          onClick={() => completeShiftControlTask(task)}
          disabled={isSaving}
        >
          {simpleLabel}
        </Button>
      );
    }

    if (!isOpen) {
      return (
        <Button
          className={cn(compact ? 'employee-material-green-action' : 'employee-material-secondary-action', 'mt-2 w-full font-extrabold', compact ? 'h-12 rounded-xl text-base' : 'h-8 text-xs')}
          onClick={() => openShiftTaskForm(task)}
          disabled={isSaving}
        >
          {isCredit ? 'Сверить' : isAcquiring ? 'Сверить терминал' : 'Ввести факт'}
        </Button>
      );
    }

    return (
      <div className='employee-material-subcard mt-2 grid gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200/80'>
        {isCash && (
          <div className='grid gap-2'>
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Наличные в кассе
              <span className='text-xs font-semibold leading-snug text-slate-500'>
                Пересчитайте деньги и внесите фактическую сумму.
              </span>
              <input
                type='number'
                inputMode='decimal'
                min='0'
                step='0.01'
                value={draft.numericValue}
                onChange={(event) => updateShiftTaskDraft(task.id, { numericValue: event.target.value })}
                className='h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder='0'
              />
              {errors.numericValue && <span className='text-xs font-bold text-amber-700'>{errors.numericValue}</span>}
            </label>
          </div>
        )}

        {isAcquiring && (
          <>
            <div className='grid gap-2'>
              <p className='text-xs font-extrabold text-slate-700'>Операции терминала</p>
              <p className='text-xs font-semibold leading-snug text-slate-500'>
                {previousTerminalTask ? 'Были новые операции после предыдущей проверки?' : 'Были операции по терминалу с начала смены?'}
              </p>
              <div className='grid grid-cols-2 gap-2'>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '0' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '0', numericValue: '0', booleanValue: true, comment: '', terminalReceiptsPhoto: null })}
                >
                  Нет
                </Button>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue !== '' && draft.integerValue !== '0' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: 'yes', numericValue: '0', booleanValue: true, comment: '' })}
                >
                  Да
                </Button>
              </div>
              {errors.integerValue && <span className='text-xs font-bold text-amber-700'>{errors.integerValue}</span>}
            </div>

            {showTerminalReconciliation && (
              <div className='grid gap-2'>
                <p className='text-xs font-extrabold text-slate-700'>Сверка терминала с 1С выполнена?</p>
                <div className='grid grid-cols-2 gap-2'>
                  <Button
                    type='button'
                    className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '1' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                    onClick={() => updateShiftTaskDraft(task.id, { integerValue: '1', booleanValue: true, comment: '' })}
                  >
                    Всё совпадает
                  </Button>
                  <Button
                    type='button'
                    className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '2' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                    onClick={() => updateShiftTaskDraft(task.id, { integerValue: '2', booleanValue: false })}
                  >
                    Есть расхождение
                  </Button>
                </div>
              </div>
            )}

            {draft.integerValue === '2' && (
              <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                Комментарий
                <textarea
                  value={draft.comment}
                  onChange={(event) => updateShiftTaskDraft(task.id, { comment: event.target.value })}
                  className='min-h-14 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder='Что не совпадает?'
                />
                {errors.comment && <span className='text-xs font-bold text-amber-700'>{errors.comment}</span>}
              </label>
            )}

            {showTerminalPhoto && (
              <label className='grid gap-2 text-xs font-extrabold text-slate-700'>
                Чеки терминала
                <span className='text-xs font-semibold leading-snug text-slate-500'>{terminalPhotoHint}</span>
                <span className={cn(
                  'flex min-h-10 items-center justify-center rounded-lg px-3 text-xs font-extrabold',
                  draft.integerValue === '2' && !draft.comment.trim()
                    ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                    : 'cursor-pointer bg-[#111821] text-white',
                )}>
                  {isSaving
                    ? 'Сохраняем фото...'
                    : draft.terminalReceiptsPhoto
                      ? 'Новое фото выбрано'
                      : hasTaskPhoto(task, 'terminalReceipts')
                        ? 'Заменить фото'
                        : 'Сделать фото'}
                </span>
                {!draft.terminalReceiptsPhoto && hasTaskPhoto(task, 'terminalReceipts') && (
                  <span className='text-xs font-semibold text-green-700'>Текущее фото сохранено</span>
                )}
                {draft.integerValue === '2' && !draft.comment.trim() && (
                  <span className='text-xs font-semibold text-amber-700'>Сначала опишите расхождение</span>
                )}
                <input
                  type='file'
                  accept='image/*'
                  capture='environment'
                  className='sr-only'
                  disabled={isSaving || (draft.integerValue === '2' && !draft.comment.trim())}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    event.currentTarget.value = '';
                    if (!file) return;
                    const nextDraft = { ...draft, terminalReceiptsPhoto: file };
                    updateShiftTaskDraft(task.id, { terminalReceiptsPhoto: file });
                    completeShiftControlTask(task, nextDraft);
                  }}
                />
              </label>
            )}
          </>
        )}

        {isCredit && (
          <>
            <div className='grid gap-2'>
              <p className='text-xs font-extrabold text-slate-700'>Операции Т-Банка</p>
              <p className='text-xs font-semibold leading-snug text-slate-500'>
                Проверьте, что операции оформлены в 1С.
              </p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '0' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '0', booleanValue: true, comment: '' })}
                >
                  Операций не было
                </Button>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '1' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '1', booleanValue: true, comment: '' })}
                >
                  Проверка выполнена
                </Button>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '2' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '2', booleanValue: false })}
                >
                  Есть проблема
                </Button>
              </div>
              {errors.integerValue && <span className='text-xs font-bold text-amber-700'>{errors.integerValue}</span>}
            </div>
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Комментарий {draft.integerValue === '2' ? '(обязательно)' : '(если нужно)'}
              <textarea
                value={draft.comment}
                onChange={(event) => updateShiftTaskDraft(task.id, { comment: event.target.value })}
                className='min-h-14 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder={draft.integerValue === '2' ? 'Что именно не получилось?' : 'Необязательно'}
              />
              {errors.comment && <span className='text-xs font-bold text-amber-700'>{errors.comment}</span>}
            </label>
          </>
        )}

        {errors.form && <p className='rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200'>{errors.form}</p>}

        <div className={cn('grid gap-2', photoCompletesTaskAutomatically ? 'grid-cols-1' : 'grid-cols-2')}>
          <Button
            type='button'
            className='h-9 bg-slate-100 text-xs font-extrabold text-slate-700 shadow-none hover:bg-slate-200'
            onClick={() => {
              setOpenShiftTaskId(null);
              setEditingShiftTaskId(null);
              setShiftTaskErrors((current) => ({ ...current, [task.id]: {} }));
            }}
            disabled={isSaving}
          >
            Назад
          </Button>
          {!photoCompletesTaskAutomatically && (
            <Button type='button' className='h-9 text-xs font-extrabold' onClick={() => completeShiftControlTask(task)} disabled={isSaving}>
              {isEditing ? 'Сохранить исправление' : 'Сохранить результат'}
            </Button>
          )}
        </div>
      </div>
    );
  }

  function getHandoverStepError(step = handoverSteps[handoverStep], draft = handoverDraft) {
    const draftCashBalance = parseMoneyInput(draft.personalCashBalance);
    const draftReserveCashBalance = parseMoneyInput(draft.reserveCashBalance);

    if (step === 'personalCashBalance' && draftCashBalance === null) return 'Укажите остаток наличных в моей кассе';
    if (step === 'reserveCashBalance' && draftReserveCashBalance === null) return 'Укажите остаток наличных в резерве';
    if (step === 'discrepancy') {
      if (!draft.comment.trim()) return 'Добавьте комментарий к расхождению';
    }
    if (step === 'terminalQuestion' && !draft.terminalHadOperations) return 'Укажите, были ли новые операции терминала';
    if (step === 'terminalReconciliation') {
      if (!draft.terminalReconciliation) return 'Укажите результат сверки терминала с 1С';
      if (draft.terminalReconciliation === 'discrepancy' && !draft.terminalComment.trim()) return 'Опишите расхождение по операциям терминала';
    }
    if (step === 'terminalReceipts' && !hasHandoverPhoto(draft.terminalReceiptsPhoto)) return 'Сфотографируйте новые чеки терминала';
    if (step === 'tbankQuestion' && !draft.hasTbankCredit) return 'Укажите, были ли операции через терминал Т-Банка';
    if (step === 'tbankReceipts' && !hasHandoverPhoto(draft.tbankReceiptsPhoto)) return 'Сделайте фото чеков Т-Банка за смену';
    if (step === 'tbankTerminal') {
      if (!hasHandoverPhoto(draft.tbankTerminalReportPhoto)) return 'Сделайте фото сверки итогов Т-Банка';
      if (parseMoneyInput(draft.tbankTerminalTotal) === null) return 'Укажите сумму по сверке итогов Т-Банка';
    }
    if (step === 'zReportPhoto' && !hasHandoverPhoto(draft.zReportPhoto)) return 'Сделайте фото чека закрытия смены';
    if (step === 'encashment') {
      if (cashEncashmentExceptionRequestState?.status === 'approved') return '';
      if (parseMoneyInput(draft.encashmentAmount) === null) return 'Укажите сумму инкассации';
      if (user.department === 'retail' && !draft.encashmentDirection) return 'Выберите направление инкассации';
      if (!hasHandoverPhoto(draft.encashmentDocumentPhoto)) return user.department === 'retail'
        ? 'Сфотографируйте деньги перед помещением в резерв или депозитный сейф.'
        : 'Сфотографируйте деньги перед помещением в депозитный сейф.';
    }
    return '';
  }

  async function submitHandover(task: ShiftControlTask, draft = handoverDraft, steps = buildHandoverSteps(draft)) {
    for (const step of steps) {
      const stepError = getHandoverStepError(step, draft);
      if (stepError) {
        setHandoverAttemptedStep(step);
        setHandoverStep(Math.max(0, steps.indexOf(step)));
        return;
      }
    }

    const formData = new FormData();
    ([
      'personalStatementPhoto',
      'terminalReceiptsPhoto',
      'tbankReceiptsPhoto',
      'tbankTerminalReportPhoto',
      'zReportPhoto',
      'encashmentDocumentPhoto',
    ] as HandoverPhotoKey[]).forEach((key) => {
      const file = draft[key];
      if (isHandoverFile(file)) formData.append(key, file);
    });
    formData.append('personalCashBalance', draft.personalCashBalance);
    formData.append('reserveCashBalance', draft.reserveCashBalance);
    formData.append('discrepancyType', draft.discrepancyType);
    formData.append('discrepancyAmount', draft.discrepancyAmount);
    formData.append('terminalHadOperations', draft.terminalHadOperations ? String(draft.terminalHadOperations === 'yes') : '');
    formData.append('terminalReconciliation', draft.terminalReconciliation);
    formData.append('terminalComment', draft.terminalComment);
    formData.append('hasTbankCredit', draft.hasTbankCredit ? String(draft.hasTbankCredit === 'yes') : '');
    formData.append('tbankTerminalTotal', draft.tbankTerminalTotal);
    formData.append('encashmentAmount', draft.encashmentAmount);
    formData.append('encashmentDirection', draft.encashmentDirection);
    formData.append('comment', draft.comment);

    setError('');
    setHandoverSaveError('');
    setIsSaving(true);
    try {
      let result: {
        task: ShiftControlTask;
        tasks?: ShiftControlTask[];
        run?: ShiftControlRun | null;
        workDay?: WorkDayEntry;
        message?: string;
      } | null = null;
      while (!result) {
        try {
          result = await submitFormData<{
            task: ShiftControlTask;
            tasks?: ShiftControlTask[];
            run?: ShiftControlRun | null;
            workDay?: WorkDayEntry;
            message?: string;
          }>(
            '/api/employee/shift-control/tasks/' + task.id,
            'PATCH',
            formData,
            'Не удалось сдать смену',
          );
        } catch (reason) {
          if (reason instanceof EmployeeApiError && reason.code === 'KKM_SHIFT_CHECK_PENDING') {
            setMessage('Ожидаем подтверждение кассы · проверяем автоматически…');
            setHandoverSaveError('Касса может передать чек с небольшой задержкой. Проверяем автоматически — ничего нажимать не нужно.');
            await new Promise((resolve) => window.setTimeout(resolve, 15_000));
            continue;
          }
          throw reason;
        }
      }

      setShiftControlState((current) => ({
        run: result.run ?? current.run,
        tasks: result.tasks ?? current.tasks.map((item) => (item.id === result.task.id ? result.task : item)),
      }));
      if (result.workDay) {
        setWorkDay(result.workDay);
        setUnfinished(null);
      }
      // On iOS/PWA a partial state update after handover could leave the
      // completion banner fresh while "Детали смены" still showed the old day.
      // A full refresh uses the authoritative completed workday snapshot.
      window.location.reload();
      return;
    } catch (reason) {
      if (reason instanceof EmployeeApiError && reason.code === 'OPEN_REQUIRED_ISSUES') {
        setCloseBlocked(true);
        if (isRecord(reason.payload) && Array.isArray(reason.payload.issues)) setRequiredIssuesState(reason.payload.issues as RequiredWorkdayIssue[]);
      }
      setHandoverSaveError(reason instanceof Error ? reason.message : 'Не удалось сдать смену');
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    const request = cashEncashmentExceptionRequestState;
    const task = activeHandoverTask;
    const isApprovedEncashmentStep = request?.status === 'approved' && handoverSteps[handoverStep] === 'encashment';
    if (!isApprovedEncashmentStep || !task || isCompleted || isSaving) {
      if (request?.status !== 'approved') approvedCashExceptionAutoFinishRef.current = null;
      return;
    }

    const attemptKey = `${request.id}:${task.id}`;
    if (approvedCashExceptionAutoFinishRef.current === attemptKey) return;
    approvedCashExceptionAutoFinishRef.current = attemptKey;
    setMessage('Администратор разрешил завершение. Завершаем рабочий день…');
    void submitHandover(task);
  }, [activeHandoverTask, cashEncashmentExceptionRequestState, handoverStep, handoverSteps, isCompleted, isSaving]);

  useEffect(() => {
    const request = closeExceptionRequestState;
    const task = shiftControlTasks.find((item) => item.category === 'handover' && item.status !== 'done') ?? null;
    if (request?.status !== 'approved' || !closeExceptionMatchesCurrentIssues || isCompleted || isSaving) {
      if (request?.status !== 'approved') approvedRequiredIssuesAutoFinishRef.current = null;
      return;
    }

    const targetKey = unfinished ? `stale:${unfinished.id}` : task ? `task:${task.id}` : activeWorkDay ? `workday:${activeWorkDay.id}` : '';
    if (!targetKey) return;
    const attemptKey = `${request.id}:${targetKey}`;
    if (approvedRequiredIssuesAutoFinishRef.current === attemptKey) return;
    approvedRequiredIssuesAutoFinishRef.current = attemptKey;
    setMessage('Администратор разрешил завершение. Закрываем рабочий день…');
    if (unfinished) {
      void finishUnfinishedWorkDay();
      return;
    }
    if (!task) {
      void finishWorkDay();
      return;
    }
    const savedDraft = isRecord(task.handoverData) ? draftFromHandoverData(task.handoverData) : handoverDraft;
    setHandoverDraft(savedDraft);
    void submitHandover(task, savedDraft, buildHandoverSteps(savedDraft));
  }, [activeWorkDay, closeExceptionMatchesCurrentIssues, closeExceptionRequestState, handoverDraft, isCompleted, isSaving, shiftControlTasks, staleCloseComment, staleCloseReason, unfinished]);

  async function handleHandoverPhotoSelected(task: ShiftControlTask, field: HandoverPhotoKey, file: File | null) {
    if (!file) return;
    setHandoverAttemptedStep(null);
    setHandoverSaveError('');

    try {
      setIsSaving(true);
      const nextDraft = { ...handoverDraft, [field]: file };
      setHandoverDraft(nextDraft);
      const savedTask = await saveHandoverDraft(task, nextDraft);
      const savedDraft = isRecord(savedTask.handoverData) ? draftFromHandoverData(savedTask.handoverData) : nextDraft;
      setHandoverDraft(savedDraft);
      const nextSteps = buildHandoverSteps(savedDraft);
      const isFinalStep = handoverStep >= nextSteps.length - 1;
      if (isFinalStep) {
        await submitHandover(task, savedDraft, nextSteps);
        return;
      }
      setMessage('Фото прикреплено');
      setHandoverStep((current) => Math.min(nextSteps.length - 1, current + 1));
    } catch (reason) {
      setHandoverSaveError(reason instanceof Error ? reason.message : 'Не удалось сохранить фото');
    } finally {
      setIsSaving(false);
    }
  }

  async function sendKkmClosePhotoToAdmin(task: ShiftControlTask, file: File | null) {
    if (!file) return;
    setIsSaving(true);
    setError('');
    try {
      const nextDraft = { ...handoverDraft, zReportPhoto: file };
      setHandoverDraft(nextDraft);
      const savedTask = await saveHandoverDraft(task, nextDraft);
      const savedDraft = isRecord(savedTask.handoverData) ? draftFromHandoverData(savedTask.handoverData) : nextDraft;
      setHandoverDraft(savedDraft);
      const response = await fetch('/api/employee/workday/close-exception', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reasonCode: 'kkm', comment: 'Чек закрытия смены распечатался. Фото приложено, но портал пока не подтвердил закрытие кассы.' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось отправить фото администратору');
      setCloseExceptionRequestState(payload.request);
      setMessage('Фото отправлено администратору · ожидайте решения');
      await syncCurrentWorkdayState(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось отправить фото администратору');
    } finally {
      setIsSaving(false);
    }
  }

  function renderPhotoInput(label: string, field: HandoverPhotoKey, task: ShiftControlTask, hint?: string, fieldError?: string, disabledReason?: string) {
    const file = handoverDraft[field];
    return (
      <label className='grid gap-2 text-sm font-extrabold text-slate-800'>
        {label}
        {hint && <span className='text-xs font-semibold leading-snug text-slate-500'>{hint}</span>}
        {!file && (
          <span className={cn(
            'flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-extrabold shadow-sm',
            disabledReason ? 'cursor-not-allowed bg-slate-200 text-slate-400' : 'cursor-pointer bg-[#111821] text-white',
          )}>
            {isSaving ? photoSavingLabel(uploadProgress) : 'Сделать фото'}
          </span>
        )}
        <input
          type='file'
          accept='image/*'
          capture='environment'
          className='sr-only'
          disabled={isSaving || Boolean(disabledReason)}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.currentTarget.value = '';
            handleHandoverPhotoSelected(task, field, file);
          }}
        />
        {file && <span className='rounded-lg bg-green-50 px-2.5 py-2 text-xs font-bold text-green-700 ring-1 ring-green-100'>Фото прикреплено</span>}
        {disabledReason && <span className='text-xs font-semibold text-amber-700'>{disabledReason}</span>}
        {fieldError && <span className='text-xs font-bold text-amber-700'>{fieldError}</span>}
      </label>
    );
  }

  function renderHandoverStep(task: ShiftControlTask) {
    const step = handoverSteps[handoverStep];
    const isLastStep = handoverStep === handoverSteps.length - 1;
    const stepError = handoverAttemptedStep === step ? getHandoverStepError() : '';
    const previousTerminalTask = shiftControlState.tasks
      .filter((item) => item.category === 'acquiring' && item.status === 'done' && item.completedAt)
      .sort((left, right) => new Date(right.completedAt as string | Date).getTime() - new Date(left.completedAt as string | Date).getTime())[0];
    const previousTerminalTime = terminalBoundaryTime(previousTerminalTask?.completedAt);
    const terminalPhotoHint = previousTerminalTime
      ? `Сфотографируйте чеки после ${previousTerminalTime}.`
      : previousTerminalTask
        ? 'Сфотографируйте чеки после предыдущей проверки.'
      : 'Сфотографируйте чеки с начала смены.';
    const sectionTitle = ['terminalQuestion', 'terminalReconciliation', 'terminalReceipts', 'tbankQuestion', 'tbankReceipts', 'tbankTerminal', 'zReportPhoto'].includes(step) ? 'Закрытие магазина' : 'Сдача своей кассы';
    const handoverStepTitle: Record<string, string> = {
      personalCashBalance: 'Пересчитайте наличные',
      reserveCashBalance: 'Пересчитайте резерв',
      terminalQuestion: 'Проверка операций терминала',
      terminalReconciliation: 'Сверка терминала с 1С',
      terminalReceipts: 'Чеки терминала',
      discrepancy: 'Добавьте комментарий',
      encashment: 'Оформите инкассацию',
      tbankQuestion: 'Проверьте терминал Т-Банка',
      tbankReceipts: 'Подтвердите операции Т-Банка',
      tbankTerminal: 'Сверка итогов Т-Банка',
      zReportPhoto: 'Чек закрытия смены',
    };
    const handoverIcon =
      step === 'personalCashBalance' || step === 'reserveCashBalance' || step === 'encashment'
        ? Banknote
        : step === 'terminalQuestion' || step === 'terminalReconciliation' || step === 'terminalReceipts'
          ? CreditCard
          : step === 'tbankQuestion' || step === 'tbankReceipts' || step === 'tbankTerminal'
            ? ReceiptText
            : step === 'discrepancy'
              ? AlertTriangle
              : ReceiptText;
    const HandoverIcon = handoverIcon;
    const photoFieldForStep: Partial<Record<string, HandoverPhotoKey>> = {
      encashment: 'encashmentDocumentPhoto',
      terminalReceipts: 'terminalReceiptsPhoto',
      tbankReceipts: 'tbankReceiptsPhoto',
      tbankTerminal: 'tbankTerminalReportPhoto',
      zReportPhoto: 'zReportPhoto',
    };
    const currentPhotoField = photoFieldForStep[step];
    const approvedCashEncashmentStep = step === 'encashment' && cashEncashmentExceptionRequestState?.status === 'approved';
    const photoCompletesHandoverStep = Boolean(
      currentPhotoField
      && !hasHandoverPhoto(handoverDraft[currentPhotoField])
      && !approvedCashEncashmentStep,
    );

    return (
      <div className='employee-material-focus employee-material-focus-current employee-material-form rounded-xl border-l-[5px] p-3 ring-1'>
        <div className='mb-3 flex items-start justify-between gap-3'>
          <div className='flex items-start gap-2'>
            <span className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 ring-1 ring-green-100'>
              <HandoverIcon className='h-4 w-4' />
            </span>
            <div>
              <p className='text-xs font-extrabold uppercase text-green-700'>{sectionTitle}</p>
              <h3 className='mt-0.5 text-base font-extrabold text-slate-950'>{handoverStepTitle[step] ?? `Шаг ${handoverStep + 1} из ${handoverSteps.length}`}</h3>
              <p className='mt-1 text-xs font-semibold leading-snug text-slate-500'>
                {step === 'reserveCashBalance' ? 'Общий резерв' : 'Только ваша касса'}
              </p>
            </div>
          </div>
        </div>

        {step === 'zReportPhoto' && renderPhotoInput('Чек закрытия смены', 'zReportPhoto', task, 'Закройте смену на кассе и сфотографируйте распечатанный чек.', stepError)}

        {step === 'personalCashBalance' && (
          <label className='grid gap-2 text-sm font-extrabold text-slate-800'>
            Наличные в кассе
            <span className='text-xs font-semibold leading-snug text-slate-500'>
              Пересчитайте кассу и внесите фактический остаток.
            </span>
            <input
              type='number'
              inputMode='decimal'
              min='0'
              step='0.01'
              value={handoverDraft.personalCashBalance}
              onChange={(event) => updateHandoverDraft({ personalCashBalance: event.target.value })}
              className='h-11 rounded-lg border border-slate-200 bg-white px-3 text-base font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
              placeholder='0'
            />
            {stepError && <span className='text-xs font-bold text-amber-700'>{stepError}</span>}
          </label>
        )}

        {step === 'reserveCashBalance' && (
          <label className='grid gap-2 text-sm font-extrabold text-slate-800'>
            Наличные в резерве
            <span className='text-xs font-semibold leading-snug text-slate-500'>
              Пересчитайте резерв и внесите фактический остаток.
            </span>
            <input
              type='number'
              inputMode='decimal'
              min='0'
              step='0.01'
              value={handoverDraft.reserveCashBalance}
              onChange={(event) => updateHandoverDraft({ reserveCashBalance: event.target.value })}
              className='h-11 rounded-lg border border-slate-200 bg-white px-3 text-base font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
              placeholder='0'
            />
            {stepError && <span className='text-xs font-bold text-amber-700'>{stepError}</span>}
          </label>
        )}

        {step === 'discrepancy' && (
          <div className='grid gap-3'>
            <p className='rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-200'>Комментарий нужен для дополнительной проверки результата.</p>
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Короткий комментарий
              <textarea
                value={handoverDraft.comment}
                onChange={(event) => updateHandoverDraft({ comment: event.target.value })}
                className='min-h-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder='Кратко укажите причину'
              />
            </label>
            {stepError && <p className='text-xs font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'encashment' && (
          <div className='grid min-w-0 gap-3'>
            <p className='break-words rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-200'>
              Остаток наличных в моей кассе больше 50 000 ₽, нужна инкассация.
            </p>
            {cashEncashmentExceptionRequestState?.status === 'approved' ? (
              <p className='rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-800 ring-1 ring-green-200'>Администратор разрешил завершить день без инкассации. РКО и ПКО не будут созданы; ситуация останется на контроле.</p>
            ) : cashEncashmentExceptionRequestState?.status === 'pending' ? (
              <div className='grid min-w-0 gap-2 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200'>
                <p className='text-xs font-bold text-amber-800'>Запрос отправлен администратору · ожидает решения.</p>
                <Button type='button' className='h-9 bg-white text-xs font-extrabold text-slate-800 ring-1 ring-amber-200 shadow-none hover:bg-amber-50' onClick={() => setShowCashEncashmentExceptionForm(false)}>Выполнить инкассацию</Button>
              </div>
            ) : showCashEncashmentExceptionForm ? (
              <div className='grid min-w-0 gap-2 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200'>
                <p className='text-xs font-extrabold text-slate-800'>Не удаётся выполнить инкассацию?</p>
                <select value={cashEncashmentExceptionReason} onChange={(event) => setCashEncashmentExceptionReason(event.target.value)} className='h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold'><option value=''>Выберите причину</option><option value='safe_access'>Нет доступа к депозитному сейфу</option><option value='handover'>Деньги переданы ответственному сотруднику</option><option value='other'>Другая причина</option></select>
                <textarea value={cashEncashmentExceptionComment} onChange={(event) => setCashEncashmentExceptionComment(event.target.value)} rows={2} maxLength={1000} placeholder='Где сейчас деньги и почему инкассация невозможна' className='w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold' />
                <div className='grid grid-cols-2 gap-2'><Button type='button' className='h-10 bg-white text-xs font-extrabold text-slate-700 ring-1 ring-slate-200 shadow-none hover:bg-slate-50' disabled={isSaving} onClick={() => setShowCashEncashmentExceptionForm(false)}>Назад</Button><Button type='button' className='h-10 text-xs font-extrabold' disabled={isSaving} onClick={requestCashEncashmentException}>Отправить</Button></div>
              </div>
            ) : (
              <Button type='button' className='h-10 bg-white text-xs font-extrabold text-slate-800 ring-1 ring-slate-200 shadow-none hover:bg-slate-50' onClick={() => setShowCashEncashmentExceptionForm(true)}>Не можете выполнить инкассацию?</Button>
            )}
            {cashEncashmentExceptionRequestState?.status !== 'approved' && !showCashEncashmentExceptionForm && <>
              <label className='grid min-w-0 gap-1 text-xs font-extrabold text-slate-700'>
                Сумма инкассации
                <input
                  type='number'
                  inputMode='decimal'
                  min='0'
                  step='0.01'
                  value={handoverDraft.encashmentAmount}
                  onChange={(event) => updateHandoverDraft({ encashmentAmount: event.target.value })}
                  className='h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                  placeholder='0'
                />
                {stepError && parseMoneyInput(handoverDraft.encashmentAmount) === null && <span className='text-xs font-bold text-amber-700'>{stepError}</span>}
              </label>
            {user.department === 'retail' ? (
              <div className='grid grid-cols-2 gap-2'>
                <Button
                  type='button'
                  className={cn('h-10 px-2 text-xs shadow-none', handoverDraft.encashmentDirection === 'phone_reserve' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                  onClick={() => updateHandoverDraft({ encashmentDirection: 'phone_reserve' })}
                >
                  Резерв на телефоны
                </Button>
                <Button
                  type='button'
                  className={cn('h-10 px-2 text-xs shadow-none', handoverDraft.encashmentDirection === 'deposit_safe' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                  onClick={() => updateHandoverDraft({ encashmentDirection: 'deposit_safe' })}
                >
                  Депозитный сейф
                </Button>
              </div>
            ) : (
              <p className='rounded-lg bg-slate-50 px-3 py-2 text-xs font-extrabold text-slate-700 ring-1 ring-slate-200'>
                Направление: депозитный сейф
              </p>
            )}
            {renderPhotoInput(
              'Инкассация',
              'encashmentDocumentPhoto',
              task,
              user.department === 'retail'
                ? 'Сфотографируйте деньги перед помещением в резерв или депозитный сейф.'
                : 'Сфотографируйте деньги перед помещением в депозитный сейф.',
              stepError && parseMoneyInput(handoverDraft.encashmentAmount) !== null ? stepError : undefined,
              parseMoneyInput(handoverDraft.encashmentAmount) === null ? 'Сначала укажите сумму инкассации' : undefined,
            )}
            </>}
          </div>
        )}

        {step === 'terminalQuestion' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Операции терминала</p>
            <p className='text-xs font-semibold leading-snug text-slate-500'>
              {previousTerminalTask ? 'Были новые операции после предыдущей проверки?' : 'Были операции по терминалу с начала смены?'}
            </p>
            <div className='grid grid-cols-2 gap-2'>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.terminalHadOperations === 'yes' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ terminalHadOperations: 'yes' })}
              >
                Да
              </Button>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.terminalHadOperations === 'no' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ terminalHadOperations: 'no', terminalReconciliation: '', terminalComment: '', terminalReceiptsPhoto: null })}
              >
                Нет
              </Button>
            </div>
            {stepError && <p className='text-xs font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'terminalReconciliation' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Сверка терминала с 1С выполнена?</p>
            <div className='grid grid-cols-2 gap-2'>
              <Button type='button' className={cn('h-10 px-2 text-xs shadow-none', handoverDraft.terminalReconciliation === 'matched' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')} onClick={() => updateHandoverDraft({ terminalReconciliation: 'matched', terminalComment: '' })}>Всё совпадает</Button>
              <Button type='button' className={cn('h-10 px-2 text-xs shadow-none', handoverDraft.terminalReconciliation === 'discrepancy' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')} onClick={() => updateHandoverDraft({ terminalReconciliation: 'discrepancy' })}>Есть расхождение</Button>
            </div>
            {handoverDraft.terminalReconciliation === 'discrepancy' && (
              <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                Что не совпадает?
                <textarea value={handoverDraft.terminalComment} onChange={(event) => updateHandoverDraft({ terminalComment: event.target.value })} className='min-h-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20' placeholder='Кратко опишите расхождение' />
              </label>
            )}
            {stepError && <p className='text-xs font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'terminalReceipts' && (
          <div className='grid gap-3'>
            {renderPhotoInput('Чеки терминала', 'terminalReceiptsPhoto', task, terminalPhotoHint, stepError)}
          </div>
        )}

        {step === 'tbankQuestion' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Операции Т-Банка</p>
            <p className='text-xs font-semibold leading-snug text-slate-500'>
              Выберите “Да” для кредитов, взносов или оплат.
            </p>
            <div className='grid grid-cols-2 gap-2'>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.hasTbankCredit === 'yes' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ hasTbankCredit: 'yes' })}
              >
                Да
              </Button>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.hasTbankCredit === 'no' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ hasTbankCredit: 'no', tbankReceiptsPhoto: null, tbankTerminalReportPhoto: null, tbankTerminalTotal: '' })}
              >
                Нет
              </Button>
            </div>
            {stepError && <p className='text-xs font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'tbankReceipts' && (
          <div className='grid gap-3'>
            {renderPhotoInput(
              'Чеки Т-Банка',
              'tbankReceiptsPhoto',
              task,
              'Сфотографируйте все чеки Т-Банка за смену.',
              stepError,
            )}
          </div>
        )}

        {step === 'tbankTerminal' && (
          <div className='grid gap-3'>
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Сумма по сверке итогов Т-Банка
              <input
                type='number'
                inputMode='decimal'
                min='0'
                step='0.01'
                value={handoverDraft.tbankTerminalTotal}
                onChange={(event) => updateHandoverDraft({ tbankTerminalTotal: event.target.value })}
                className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder='0'
              />
              {stepError && hasHandoverPhoto(handoverDraft.tbankTerminalReportPhoto) && <span className='text-xs font-bold text-amber-700'>{stepError}</span>}
            </label>
            {renderPhotoInput(
              'Сверка итогов Т-Банка',
              'tbankTerminalReportPhoto',
              task,
              'Выполните «Сверку итогов» и сфотографируйте чек.',
              stepError && parseMoneyInput(handoverDraft.tbankTerminalTotal) !== null ? stepError : undefined,
              parseMoneyInput(handoverDraft.tbankTerminalTotal) === null ? 'Сначала укажите сумму по сверке итогов' : undefined,
            )}
          </div>
        )}

        {handoverSaveError && (
          <p className='mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold leading-snug text-red-800 ring-1 ring-red-200'>
            {handoverSaveError}
          </p>
        )}

        {approvedCashEncashmentStep ? (
          <p className='mt-4 rounded-lg bg-slate-50 px-3 py-2 text-center text-xs font-extrabold text-slate-600 ring-1 ring-slate-200'>Завершаем рабочий день…</p>
        ) : (
        <div className={cn('mt-4 grid gap-2', photoCompletesHandoverStep ? 'grid-cols-1' : 'grid-cols-2')}>
          <Button
            type='button'
            className='h-10 bg-slate-100 text-xs font-extrabold text-slate-700 shadow-none hover:bg-slate-200'
            onClick={() => {
              if (handoverStep === 0) {
                setActiveHandoverTaskId(null);
                setHandoverAttemptedStep(null);
                setHandoverSaveError('');
                return;
              }
              setHandoverStep((current) => Math.max(0, current - 1));
              setHandoverAttemptedStep(null);
              setHandoverSaveError('');
              setError('');
            }}
            disabled={isSaving}
          >
            {handoverStep === 0 ? 'Отмена' : 'Назад'}
          </Button>
          {!photoCompletesHandoverStep && <Button
            type='button'
            className='h-10 text-xs font-extrabold'
            onClick={async () => {
              const currentError = getHandoverStepError();
              if (currentError) {
                setHandoverAttemptedStep(step);
                return;
              }
              setHandoverAttemptedStep(null);
              setHandoverSaveError('');
              setError('');
              try {
                setIsSaving(true);
                const nextDraft = handoverDraft;
                const savedTask = await saveHandoverDraft(task, nextDraft);
                const savedDraft = isRecord(savedTask.handoverData) ? draftFromHandoverData(savedTask.handoverData) : nextDraft;
                setHandoverDraft(savedDraft);
                const nextSteps = buildHandoverSteps(savedDraft);
                if (handoverStep >= nextSteps.length - 1) {
                  await submitHandover(task, savedDraft, nextSteps);
                  return;
                }
                setHandoverStep((current) => Math.min(nextSteps.length - 1, current + 1));
              } catch (reason) {
                setHandoverSaveError(reason instanceof Error ? reason.message : 'Не удалось сохранить шаг');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isLastStep ? 'Сдать смену' : 'Далее'}
          </Button>}
        </div>
        )}
      </div>
    );
  }

  return (
    <main className='employee-material-ui min-h-[100dvh] overflow-x-clip bg-[#151a1d] text-slate-950 md:px-6 md:py-6'>
      {qrScannerOpen && (
        <WorkdayQrScanner
          userDepartment={user.department}
          onCancel={() => setQrScannerOpen(false)}
          onAccepted={handleQrAccepted}
        />
      )}
      {shiftPickerOpen && !workDay && (
        <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px]'>
          <div className='employee-material-sheet w-full max-w-[520px] rounded-t-[28px] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl'>
            <div className='mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200' />
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-xs font-black uppercase tracking-[0.18em] text-green-700'>QR подтверждён</p>
                <h2 className='mt-1 text-2xl font-black text-slate-950'>Выберите смену</h2>
                <p className='mt-1 text-sm font-semibold text-slate-500'>Рабочий день начнётся сразу после выбора.</p>
              </div>
              <button
                type='button'
                onClick={() => setShiftPickerOpen(false)}
                className='flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600'
              >
                <ChevronDown className='h-5 w-5' />
              </button>
            </div>
            <div className='mt-5 grid gap-2'>
              {availableShiftOptions.map((shift) => (
                <button
                  key={shift.code}
                  type='button'
                  disabled={isSaving}
                  onClick={() => void chooseShiftAfterQr(shift.code)}
                className='employee-material-choice flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-base font-black text-slate-950 transition active:scale-[0.99] disabled:opacity-60'
                >
                  <span>{shiftLabel(shift.code)}</span>
                  <span className='text-xs font-extrabold uppercase text-green-700'>Начать</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className='employee-material-shell relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-[#f7faf8] shadow-[0_0_70px_rgba(0,0,0,0.24)] ring-1 ring-white/10 md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[28px]'>
        <header className='employee-material-header px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]'>
          <div className='flex items-center justify-between gap-3'>
            <BrandBlock size='employee' />
            <div className='flex items-center gap-2'>
              <WorkdayNotificationsClient />
              <LogoutButton iconOnly title='Выйти' className='employee-material-header-action h-10 w-10 bg-white/[0.08] px-0 text-white ring-1 ring-white/10 hover:bg-white/[0.12]' />
            </div>
          </div>

          <div className='mt-3 grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2.5'>
            <div className='employee-material-profile-avatar flex h-8 w-8 items-center justify-center text-[11px] font-black' aria-hidden='true'>
              {initials(user.name)}
            </div>
            <div className='employee-material-profile-copy min-w-0'>
              <p className='truncate text-sm font-extrabold leading-tight text-[#273137]'>{user.name}</p>
              <p className='mt-1 truncate text-[11px] font-bold leading-none text-[#758084]'>{departmentLabel(user.department)}</p>
            </div>
            <p className='shrink-0 text-[11px] font-bold leading-none text-[#758084]'>{formatDateLabel(today)}</p>
          </div>
        </header>

        <div className='flex-1 px-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] pt-4'>
          {!isOnline || cashOutboxCount > 0 ? (
            <div className={`mb-4 rounded-2xl px-4 py-3 ${isOnline ? 'employee-material-info-card text-slate-900' : 'employee-material-alert-card text-amber-950'}`}>
              <div className='flex items-start gap-3'>
                <span className={`employee-material-status-dot mt-1 ${isOnline ? 'employee-material-status-dot-slate' : 'employee-material-status-dot-amber'}`} />
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-extrabold'>{isOnline ? (cashOutboxSyncing ? 'Отправляем инкассацию' : 'Инкассация сохранена на телефоне') : 'Нет соединения'}</p>
                  <p className='mt-0.5 text-xs font-semibold leading-relaxed opacity-80'>
                    {isOnline
                      ? cashOutboxSyncing
                        ? 'Сумма и фотография отправляются в портал.'
                        : cashOutboxError
                          ? `Не удалось отправить: ${cashOutboxError}`
                          : `Сумма и фото не потеряны. Ожидают отправки: ${cashOutboxCount}.`
                      : 'Введённые данные инкассации будут сохранены на телефоне и отправятся после восстановления связи.'}
                  </p>
                </div>
                {isOnline && cashOutboxCount > 0 && !cashOutboxSyncing ? (
                  <button type='button' className='employee-material-secondary-action h-9 shrink-0 px-3 text-xs font-extrabold' onClick={() => void flushCashOutbox()}>
                    Повторить
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          {(unfinished || (activeWorkDay && activeWorkDay.date !== today)) && (
            <Card className='employee-material-alert-card mb-4 border-amber-200 bg-amber-50'>
              <div className='flex items-start gap-3'>
                <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
                <div className='flex-1'>
                  <p className='font-extrabold text-amber-950'>Есть незавершённый рабочий день</p>
                  <p className='mt-1 text-sm font-medium text-amber-900'>
                    Предыдущая смена не была завершена.
                    Чтобы начать новый рабочий день, укажите причину и закройте предыдущий.
                    Администратор увидит причину и комментарий.
                  </p>
                  <div className='mt-3 grid gap-2'>
                    <label className='block text-sm font-bold text-amber-950'>
                      Причина
                      <select
                        value={staleCloseReason}
                        onChange={(event) => setStaleCloseReason(event.target.value)}
                        className='mt-1.5 w-full rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                      >
                        <option value=''>Выберите причину</option>
                        {staleCloseReasons.map((reason) => (
                          <option key={reason} value={reason}>{reason}</option>
                        ))}
                      </select>
                    </label>
                    <label className='block text-sm font-bold text-amber-950'>
                      Комментарий
                      <textarea
                        value={staleCloseComment}
                        onChange={(event) => setStaleCloseComment(event.target.value)}
                        className='mt-1.5 min-h-16 w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200'
                        placeholder='Например: чек закрытия смены потеряла, фото сделать уже не могу'
                      />
                    </label>
                  </div>
                  <Button className='mt-3 w-full bg-amber-600 hover:bg-amber-700' onClick={finishUnfinishedWorkDay} disabled={isSaving}>
                    Закрыть незавершённый день
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {error && (
            <div
              role='alert'
              className='employee-material-toast fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[488px] items-start gap-2.5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-extrabold leading-snug text-red-900 shadow-2xl ring-1 ring-red-200'
            >
              <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-red-700' />
              <span className='min-w-0 flex-1'>{error}</span>
              <button
                type='button'
                className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-100'
                aria-label='Закрыть сообщение об ошибке'
                onClick={() => setError('')}
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          )}

          {message && (
            <div className='employee-material-toast fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[488px] items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-slate-950 shadow-2xl ring-1 ring-green-200'>
              <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100'>
                <CheckCircle2 className='h-4 w-4' />
              </span>
              <span className='min-w-0 flex-1'>{message}</span>
              {message === 'График сохранён' && scheduleUndo && (
                <button
                  type='button'
                  className='shrink-0 rounded-lg px-2 py-1 text-xs font-extrabold text-green-700 hover:bg-green-50 disabled:opacity-50'
                  onClick={undoScheduleChange}
                  disabled={isSaving}
                >
                  Отменить
                </button>
              )}
            </div>
          )}

          {activeTab === 'day' && (
            <div className='space-y-3'>
              {!workDay && !unfinished && (
                <Card className='space-y-3 p-4'>
                  <div className='flex items-start gap-3'>
                    <span className='employee-material-heading-icon h-11 w-11 shrink-0 rounded-xl' aria-hidden='true'>
                      <span className='employee-material-brand-o' />
                    </span>
                    <div className='min-w-0'>
                      <h2 className='text-xl font-black leading-tight text-slate-950'>Начать рабочий день</h2>
                      <p className='mt-1 text-sm font-semibold leading-snug text-slate-500'>
                        Отсканируйте QR-код отдела на рабочем месте.
                      </p>
                    </div>
                  </div>
                  <Button
                    type='button'
                    className='employee-material-green-action h-14 w-full rounded-xl text-base font-black'
                    onClick={openQrStart}
                    disabled={isSaving || Boolean(unfinished)}
                  >
                    <ScanLine className='mr-2 h-5 w-5' />
                    Сканировать QR
                  </Button>
                  {unfinished && (
                    <p className='text-xs font-bold text-amber-700'>Сначала закройте предыдущий рабочий день.</p>
                  )}
                </Card>
              )}

              {activeWorkDay && (
                <div className='employee-material-status-strip flex items-center gap-2 rounded-full px-3 py-2 text-sm font-extrabold text-green-900'>
                  <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-green-700 ring-1 ring-green-100'>
                    <CheckCircle2 className='h-4 w-4' />
                  </span>
                  <span className='min-w-0 truncate'>Рабочий день · {workDay?.shiftLabel} · {activeElapsedLabel}</span>
                </div>
              )}

              {requiredIssuesForBanner.length > 0 && (
                <section className='overflow-hidden rounded-2xl border border-amber-200 bg-amber-50 text-slate-950 shadow-sm'>
                  <div className='flex items-center gap-3 px-3.5 py-3'>
                    <span className='employee-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-700'><AlertTriangle className='h-5 w-5' /></span>
                    <div className='min-w-0'>
                      <p className='text-xs font-extrabold uppercase tracking-wide text-amber-700'>Нужно исправить · {requiredIssuesForBanner.length}</p>
                      <p className='mt-0.5 text-sm font-bold leading-tight text-slate-700'>Откройте и выполните инструкцию</p>
                    </div>
                  </div>
                  <div className='divide-y divide-amber-200 border-t border-amber-200 bg-white/45'>
                    {(showAllRequiredIssues ? requiredIssuesForBanner : requiredIssuesForBanner.slice(0, 1)).map((issue) => {
                      const issueView = workdayIssueView(issue);
                      return (
                        <Link key={issue.id} href={`/employee/issues/${issue.id}`} className='flex items-center gap-3 px-3.5 py-3 transition hover:bg-white/60'>
                          <span className='min-w-0 flex-1'>
                            <span className='block text-sm font-black leading-tight'>{issueView.summaryTitle}</span>
                            {issueView.summaryMeta && <span className='mt-1 block text-xs font-extrabold text-slate-600'>{issueView.summaryMeta}</span>}
                          </span>
                          <span className='shrink-0 text-xs font-extrabold text-amber-800'>Открыть</span><ChevronRight className='h-4 w-4 shrink-0 text-amber-700' />
                        </Link>
                      );
                    })}
                    {requiredIssuesForBanner.length > 1 && (
                      <button
                        type='button'
                        onClick={() => setShowAllRequiredIssues((current) => !current)}
                        className='flex w-full items-center justify-center gap-2 px-3.5 py-3 text-sm font-extrabold text-amber-900 transition hover:bg-white/60'
                        aria-expanded={showAllRequiredIssues}
                      >
                        {showAllRequiredIssues ? 'Свернуть список' : `Показать остальные · ${requiredIssuesForBanner.length - 1}`}
                        {showAllRequiredIssues ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                      </button>
                    )}
                  </div>
                </section>
              )}

              {primaryPaymentCheck && primaryPaymentCheckView && (
                <Link href={`/employee/payment-checks/${primaryPaymentCheck.id}`} className='flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-slate-950 shadow-sm'>
                  <span className='employee-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-amber-700'><ReceiptText className='h-5 w-5' /></span>
                  <span className='min-w-0 flex-1'>
                    <span className='block text-xs font-extrabold uppercase tracking-wide text-amber-700'>Нужно проверить{paymentChecksState.length > 1 ? ` · ${paymentChecksState.length}` : ''}</span>
                    <span className='mt-0.5 block text-sm font-black leading-tight'>{primaryPaymentCheckView.title}</span>
                    <span className='mt-1 block text-xs font-extrabold text-slate-600'>{primaryPaymentCheckView.meta}</span>
                  </span>
                  <span className='shrink-0 text-xs font-extrabold text-amber-800'>Открыть</span><ChevronRight className='h-4 w-4 shrink-0 text-amber-700' />
                </Link>
              )}

              {(activeWorkDay || unfinished) && showCloseResolution && (
                <Card id='employee-close-exception' className='mb-6 space-y-3 border-amber-200 bg-white p-4 scroll-mb-[calc(7rem+env(safe-area-inset-bottom))] scroll-mt-4'>
                  <div>
                    <h2 className='text-base font-black text-slate-950'>{unfinished ? 'Как закрыть предыдущий день' : kkmCloseIssue ? 'Закрытие кассы не подтверждено' : 'Завершение рабочего дня'}</h2>
                    <p className='mt-1 text-sm font-semibold leading-relaxed text-slate-600'>
                      {unfinished
                        ? 'В закрываемой смене осталась обязательная проблема. Откройте её выше и исправьте. Если это технически невозможно, отправьте администратору запрос — после одобрения портал закроет именно предыдущий день.'
                        : kkmCloseIssue
                          ? 'Рабочий день пока нельзя завершить.'
                          : 'Исправьте проблему или сообщите администратору.'}
                    </p>
                  </div>
                  {kkmCloseIssue && handoverTask && !hasHandoverPhoto(handoverDraft.zReportPhoto) && (
                    <div className='space-y-2 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200'>
                      <p className='text-sm font-black text-slate-950'>Чек закрытия смены распечатался?</p>
                      <p className='text-xs font-semibold leading-relaxed text-slate-600'>Да — сфотографируйте чек. Нет — выберите причину ниже.</p>
                      <label className='block'>
                        <span className='employee-material-secondary-action flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-extrabold text-slate-800 shadow-sm ring-1 ring-slate-200'>
                          <Camera className='h-4 w-4 text-green-700' />
                          {isSaving ? photoSavingLabel(uploadProgress) : 'Сфотографировать чек'}
                        </span>
                        <input type='file' accept='image/*' capture='environment' className='sr-only' disabled={isSaving} onChange={(event) => { const file = event.target.files?.[0] ?? null; event.currentTarget.value = ''; void sendKkmClosePhotoToAdmin(handoverTask, file); }} />
                      </label>
                    </div>
                  )}
                  {kkmCloseIssue && hasHandoverPhoto(handoverDraft.zReportPhoto) && <p className='rounded-xl bg-green-50 px-3 py-2 text-sm font-extrabold text-green-800'>Фото чека прикреплено и будет доступно администратору.</p>}
                  {closeExceptionRequestState?.status === 'pending' && closeExceptionMatchesCurrentIssues && <p className='rounded-xl bg-amber-50 px-3 py-2 text-sm font-extrabold text-amber-800'>Запрос отправлен · ожидает решения администратора</p>}
                  {closeExceptionRequestState?.status === 'approved' && closeExceptionMatchesCurrentIssues && <p className='rounded-xl bg-green-50 px-3 py-2 text-sm font-extrabold text-green-800'>Администратор разрешил завершить день. Портал завершает смену автоматически; сами проблемы останутся открытыми.</p>}
                  {closeExceptionRequestState?.status === 'rejected' && closeExceptionMatchesCurrentIssues && <p className='rounded-xl bg-red-50 px-3 py-2 text-sm font-extrabold text-red-800'>Запрос не согласован{closeExceptionRequestState.decisionComment ? `: ${closeExceptionRequestState.decisionComment}` : ''}</p>}
                  {closeExceptionRequestState && !closeExceptionMatchesCurrentIssues && <p className='rounded-xl bg-amber-50 px-3 py-2 text-sm font-extrabold leading-relaxed text-amber-800'>После предыдущего запроса появилась новая обязательная проблема. Старое разрешение её не включает — отправьте новый запрос по текущим проблемам.</p>}
                  {(!closeExceptionRequestState || closeExceptionRequestState.status === 'rejected' || !closeExceptionMatchesCurrentIssues) && (
                    <div className='space-y-2'>
                      <select value={closeExceptionReason} onChange={(event) => setCloseExceptionReason(event.target.value)} className='h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold'><option value=''>Выберите техническую причину</option><option value='power'>Нет света</option><option value='internet'>Нет интернета</option><option value='one_c'>Не работает 1С</option><option value='kkm'>Не работает касса</option><option value='other'>Другая причина</option></select>
                      <textarea value={closeExceptionComment} onChange={(event) => setCloseExceptionComment(event.target.value)} rows={3} maxLength={1000} className='w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold' placeholder='Что произошло? Коротко' />
                      <Button type='button' className='employee-material-primary-action h-11 w-full font-extrabold' disabled={isSaving || !closeExceptionReason} onClick={requestCloseException}>Сообщить администратору</Button>
                    </div>
                  )}
                </Card>
              )}

              {activeWorkDay && !showShiftControl && (
                <Card className='space-y-3 border-green-100 bg-white p-4'>
                  <div className='flex items-start gap-3'>
                    <span className='employee-material-heading-icon h-11 w-11 shrink-0 rounded-xl text-green-700'>
                      <Clock className='h-5 w-5' />
                    </span>
                    <div className='min-w-0'>
                      <h2 className='text-lg font-black leading-tight text-slate-950'>Отметка рабочего дня</h2>
                      <p className='mt-1 text-sm font-semibold leading-snug text-slate-500'>
                        Для вашей роли сегодня нужен только старт и конец рабочего дня.
                      </p>
                    </div>
                  </div>
                  <Button
                    type='button'
                    className='h-12 w-full rounded-xl bg-slate-950 text-sm font-black hover:bg-slate-800'
                    onClick={finishWorkDay}
                    disabled={isSaving}
                  >
                    Завершить рабочий день
                  </Button>
                </Card>
              )}

              {isCompleted && (
                <Card className='flex items-center gap-3 p-3.5'>
                  <span className='employee-material-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-green-700'>
                    <Check className='h-5 w-5' />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-sm font-black text-slate-950'>Рабочий день завершён</p>
                    {kkmClosureConfirmed ? <p className='mt-0.5 text-xs font-extrabold text-green-700'>Касса подтверждена · смена сдана</p> : null}
                    <p className='mt-0.5 text-xs font-bold text-slate-500'>
                      {formatTime(workDay?.startedAt)}–{formatTime(workDay?.endedAt)} · {elapsedLabel}
                    </p>
                  </div>
                </Card>
              )}

              {showShiftControl && !(activeHandoverTask && showCloseResolution) && (
                <Card className='space-y-3 bg-white p-4'>
                  <div>
                    <div>
                      <h2 className='text-xl font-black text-slate-950'>
                        {activeHandoverTask || actionableShiftControlTask ? 'Сейчас нужно' : 'Следующая проверка'}
                      </h2>
                      <p className='mt-0.5 text-xs font-bold text-slate-500'>
                        {activeHandoverTask ? `Сдача смены: шаг ${handoverStep + 1} из ${handoverSteps.length}` : remainingTasksLabel(remainingShiftControlCount, primaryShiftControlTask?.category)}
                      </p>
                    </div>
                  </div>

                  {activeHandoverTask ? null : (
                    <div className={cn('employee-material-focus rounded-2xl border-l-4 px-3.5 py-3 ring-1', actionableShiftControlTask ? 'employee-material-focus-current border-green-500 bg-white ring-green-200 shadow-sm' : 'employee-material-focus-upcoming border-transparent bg-slate-50 ring-slate-200')}>
                      <p className={cn('text-xs font-extrabold uppercase', actionableShiftControlTask ? 'employee-material-current-label text-green-700' : 'text-slate-500')}>
                        {actionableShiftControlTask ? 'Текущий шаг' : 'Следующая проверка'}
                      </p>
                      <div className='mt-1 flex items-center gap-2'>
                        {primaryShiftControlTask && (() => {
                          const Icon = shiftTaskIcon(primaryShiftControlTask);
                          return (
                            <span className={cn('employee-material-icon flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1', shiftTaskIconClass(primaryShiftControlTask.category))}>
                              <Icon className='h-6 w-6' />
                            </span>
                          );
                        })()}
                        <p className='min-w-0 text-lg font-black leading-tight text-slate-950'>
                          {primaryShiftControlTask ? shiftTaskTitle(primaryShiftControlTask) : 'Все задачи выполнены'}
                        </p>
                      </div>
                      {primaryShiftControlTask && (
                        <div className='mt-2 flex flex-wrap items-center gap-2'>
                          <span className='text-xs font-bold text-slate-500'>
                            {shiftTaskStatusLabel(shiftTaskStatus(primaryShiftControlTask, displayNow))}
                          </span>
                          <span className='text-xs font-bold text-slate-500'>
                            {plannedTimeLabel(primaryShiftControlTask.plannedTimeMinutes)}
                          </span>
                          {!actionableShiftControlTask && (
                            <span className='text-xs font-bold text-slate-500'>{timeUntilLabel(primaryShiftControlTask.plannedTimeMinutes, displayNow)}</span>
                          )}
                        </div>
                      )}
                      {actionableShiftControlTask && renderShiftTaskAction(actionableShiftControlTask, true)}
                    </div>
                  )}

                  {activeHandoverTask && renderHandoverStep(activeHandoverTask)}

                  {!activeHandoverTask && otherShiftControlTaskCount > 0 && (
                    <Button
                      type='button'
                      className='employee-material-primary-action h-10 w-full text-xs font-extrabold'
                      onClick={() => setShowFullShiftPlan((current) => !current)}
                    >
                      {showFullShiftPlan ? 'Скрыть план смены' : `Показать остальные задачи (${otherShiftControlTaskCount})`}
                    </Button>
                  )}

                  {!activeHandoverTask && showFullShiftPlan && (
                    <div className='grid gap-2'>
                      {visibleShiftControlTasks.filter((task) => task.id !== primaryShiftControlTask?.id).map((task) => {
                      const uiStatus = shiftTaskStatus(task, displayNow);
                      const Icon = shiftTaskIcon(task);
                      return (
                        <div key={task.id} className={cn('flex gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600 ring-1 ring-slate-200/80', uiStatus === 'done' && 'opacity-75')}>
                          <div className={cn('employee-material-icon mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', shiftTaskIconClass(task.category))}>
                            {uiStatus === 'done' ? <CheckCircle2 className='h-4 w-4' /> : <Icon className='h-4 w-4' />}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='flex items-start justify-between gap-2'>
                              <div className='min-w-0'>
                                <p className='text-sm font-extrabold leading-tight text-slate-700'>{shiftTaskTitle(task)}</p>
                                <p className='mt-1 text-xs font-bold text-slate-500'>План: {plannedTimeLabel(task.plannedTimeMinutes)}</p>
                              </div>
                              <Badge className='shrink-0 bg-white px-2 py-0.5 text-[11px] text-slate-500 ring-1 ring-slate-200'>
                                {shiftTaskStatusLabel(uiStatus)}
                              </Badge>
                            </div>
                            {uiStatus === 'done' && editingShiftTaskId !== task.id
                              ? renderShiftTaskAnswer(task, true)
                              : task.id === actionableShiftControlTask?.id
                                ? null
                                : renderShiftTaskAction(task)}
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                </Card>
              )}

              {canUseCashOperations && activeWorkDay && !activeHandoverTask && (
                <Card className='space-y-2.5 bg-white/80 p-3.5'>
                  <div className='flex items-start justify-between gap-3'>
                    <div>
                      <h2 className='text-base font-extrabold text-slate-950'>Инкассация</h2>
                      <p className='mt-0.5 text-xs font-semibold leading-snug text-slate-500'>Только если переложили деньги</p>
                      <p className='mt-0.5 text-xs font-bold text-slate-500'>
                        {cashOperationsState.length} операций · {formatCashOperationAmount(cashOperationTotal)}
                      </p>
                    </div>
                    <span className='employee-material-heading-icon'><Banknote className='h-5 w-5 text-primary' /></span>
                  </div>

                  <div className={cn('grid gap-2', user.department === 'retail' ? 'grid-cols-2' : 'grid-cols-1')}>
                    {user.department === 'retail' && (
                      <Button
                        type='button'
                        className='employee-material-secondary-action h-9 px-2 text-xs font-extrabold'
                        onClick={() => openCashOperation('phone_reserve')}
                        disabled={!workDay || isSaving}
                      >
                        Пополнить резерв
                      </Button>
                    )}
                    <Button
                      type='button'
                      className='employee-material-secondary-action h-9 px-2 text-xs font-extrabold'
                      onClick={() => openCashOperation('deposit_safe')}
                      disabled={!workDay || isSaving}
                    >
                      В депозитный сейф
                    </Button>
                  </div>

                  {!workDay && (
                    <p className='rounded-lg bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-500 ring-1 ring-slate-200/80'>
                      Сначала начните рабочий день.
                    </p>
                  )}

                  {cashOperationDraft.direction && (
                    <div className='employee-material-form grid gap-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200/80'>
                      <div className='flex items-center justify-between gap-2'>
                        <p className='text-sm font-extrabold text-slate-950'>
                          {cashOperationDraft.direction === 'phone_reserve' ? 'Пополнить резерв' : 'В депозитный сейф'}
                        </p>
                        <button
                          type='button'
                          className='text-xs font-extrabold text-slate-400 hover:text-slate-700'
                          onClick={() => setCashOperationDraft({ direction: null, amount: '', comment: '', idempotencyKey: '' })}
                        >
                          Отмена
                        </button>
                      </div>
                      <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                        Сумма
                        <input
                          type='number'
                          inputMode='decimal'
                          min='0'
                          step='0.01'
                          value={cashOperationDraft.amount}
                          onChange={(event) => setCashOperationDraft((current) => ({ ...current, amount: event.target.value }))}
                          className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                          placeholder='0'
                        />
                      </label>
                      <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                        Комментарий
                        <textarea
                          value={cashOperationDraft.comment}
                          onChange={(event) => setCashOperationDraft((current) => ({ ...current, comment: event.target.value }))}
                          className='min-h-14 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                          placeholder='Необязательно'
                        />
                      </label>
                      <label
                        className={cn(
                          'flex min-h-10 items-center justify-center rounded-lg px-3 text-sm font-extrabold shadow-sm',
                          parseMoneyInput(cashOperationDraft.amount) === null || isSaving
                            ? 'cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'cursor-pointer bg-[#111821] text-white',
                        )}
                      >
                        {isSaving ? photoSavingLabel(uploadProgress) : 'Сделать фото'}
                        <input
                          type='file'
                          accept='image/*'
                          capture='environment'
                          className='sr-only'
                          disabled={parseMoneyInput(cashOperationDraft.amount) === null || isSaving}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            event.currentTarget.value = '';
                            submitCashOperation(file);
                          }}
                        />
                      </label>
                    </div>
                  )}

                  {cashOperationsState.length > 0 && (
                    <div className='grid gap-1.5'>
                      {cashOperationsState.map((operation) => (
                        <div key={operation.id} className='flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-200/80'>
                          <div className='min-w-0'>
                            <p className='text-xs font-extrabold text-slate-900'>
                              {formatCashOperationAmount(operation.amount)} {cashOperationDirectionLabel(operation.direction)}
                            </p>
                            <p className='mt-0.5 text-xs font-bold text-slate-400'>{formatTime(operation.createdAt)}</p>
                          </div>
                          <Badge
                            className={cn(
                              'shrink-0 px-2 py-0.5 text-[11px] ring-1',
                              operation.status === 'posted_1c_pair' || operation.status === 'resolved_manual'
                                ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                                : operation.status === 'one_c_error'
                                  ? 'bg-amber-50 text-amber-800 ring-amber-200'
                                  : 'bg-amber-50 text-amber-800 ring-amber-200',
                            )}
                          >
                            {operation.status === 'posted_1c_pair'
                              ? 'Проведено в 1С'
                              : operation.status === 'resolved_manual'
                                ? 'Подтверждено'
                              : operation.status === 'one_c_error'
                                ? 'У администратора'
                                : 'Обрабатывается'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              <Card className='bg-slate-50 p-4'>
                <div className='mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2'>
                  <h2 className='text-base font-extrabold text-slate-950'>Детали смены</h2>
                  <Badge className={cn('max-w-full shrink-0 whitespace-nowrap px-2 py-0.5 text-xs', factTone(displayedWorkDayStatus))}>
                    {factLabel(displayedWorkDayStatus)}
                  </Badge>
                </div>
                <div className='grid grid-cols-2 gap-1.5'>
                  <DetailItem label='Смена' value={workDay ? workDay.shiftLabel : selectedShift ? shiftLabel(selectedShift) : 'не выбрана'} />
                  <DetailItem label='Начало' value={workDay ? formatTime(workDay.startedAt) : minutesToTime(shiftStart)} />
                  <DetailItem label='Окончание' value={workDay?.endedAt ? formatTime(workDay.endedAt) : 'не указано'} />
                  <DetailItem label='Опоздание' value={workDay?.lateMinutes ? `${workDay.lateMinutes} мин` : 'нет'} />
                </div>
              </Card>

              <Card className='space-y-2.5 p-4'>
                <div className='flex items-center gap-2'>
                  <span className='employee-material-heading-icon'><Users className='h-5 w-5 text-primary' /></span>
                  <h2 className='text-base font-extrabold text-slate-950'>Коллеги сегодня</h2>
                </div>
                <ColleagueGroup title='Работают сейчас' people={workingColleagues} tone='green' emptyLabel='Сейчас никто не работает' />
                {completedColleagues.length > 0 && <ColleagueGroup title='Завершили день' people={completedColleagues} tone='slate' />}
                {scheduledColleagues.length > 0 && <ColleagueGroup title='Ожидаются сегодня' people={scheduledColleagues} tone='amber' />}
                {offColleagues.length + missingColleagues.length > 0 && (
                  <Button
                    type='button'
                    className='employee-material-secondary-action h-10 w-full gap-2 text-xs font-extrabold'
                    onClick={() => setShowInactiveColleagues((current) => !current)}
                    aria-expanded={showInactiveColleagues}
                  >
                    {showInactiveColleagues ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                    {showInactiveColleagues ? 'Скрыть неработающих' : `Не работают сегодня · ${offColleagues.length + missingColleagues.length}`}
                  </Button>
                )}
                {showInactiveColleagues && offColleagues.length > 0 && <ColleagueGroup title='Выходной' people={offColleagues} tone='slate' />}
                {showInactiveColleagues && missingColleagues.length > 0 && <ColleagueGroup title='График не заполнен' people={missingColleagues} tone='amber' />}
              </Card>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className='space-y-3'>
              <Card className='space-y-3 p-3.5'>
                <div className='flex items-center gap-2'>
                  <span className='employee-material-heading-icon'><CalendarDays className='h-5 w-5 text-primary' /></span>
                  <h2 className='text-xl font-extrabold text-slate-950'>График</h2>
                </div>

                <div className='employee-material-segment grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1'>
                  {[
                    { id: 'list' as const, label: 'Список' },
                    { id: 'month' as const, label: 'Месяц' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type='button'
                      onClick={() => setScheduleMode(mode.id)}
                      className={cn(
                        'h-10 rounded-lg text-sm font-extrabold transition',
                        scheduleMode === mode.id ? 'bg-[#111821] text-white shadow-[0_8px_18px_rgba(15,23,42,0.16)]' : 'text-slate-600 hover:bg-white',
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </Card>

              {scheduleMode === 'list' && (
                <>
                  <div className='grid gap-2.5'>
                    {visibleDates.map((date) => (
                      <ScheduleDayCard key={date} date={date} />
                    ))}
                  </div>

                  <Button className='employee-material-secondary-action w-full gap-2' onClick={() => setShowFullSchedule((current) => !current)}>
                    {showFullSchedule ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                    {showFullSchedule ? 'Свернуть график' : 'Открыть полный график'}
                  </Button>
                </>
              )}

              {scheduleMode === 'month' && (
                <Card className='space-y-3 p-3'>
                  <div className='flex items-center justify-between gap-2'>
                    <button
                      type='button'
                      className='employee-material-calendar-nav flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200'
                      onClick={() => {
                        const next = addMonths(calendarMonth, -1);
                        setCalendarMonth(next);
                        setSelectedScheduleDate(`${next}-01`);
                      }}
                      aria-label='Предыдущий месяц'
                    >
                      <ChevronLeft className='h-5 w-5' />
                    </button>
                    <p className='text-base font-extrabold text-slate-950'>{monthTitle(calendarMonth)}</p>
                    <button
                      type='button'
                      className='employee-material-calendar-nav flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200'
                      onClick={() => {
                        const next = addMonths(calendarMonth, 1);
                        setCalendarMonth(next);
                        setSelectedScheduleDate(`${next}-01`);
                      }}
                      aria-label='Следующий месяц'
                    >
                      <ChevronRight className='h-5 w-5' />
                    </button>
                  </div>

                  <div className='flex min-h-7 items-center justify-center'>
                    {calendarMonth !== monthKeyFromDate(today) ? (
                      <button
                        type='button'
                        className='rounded-lg px-3 py-1 text-xs font-extrabold text-green-700 hover:bg-green-50'
                        onClick={() => {
                          setCalendarMonth(monthKeyFromDate(today));
                          setSelectedScheduleDate(today);
                        }}
                      >
                        Перейти к сегодня
                      </button>
                    ) : (
                      <span className='text-xs font-bold text-slate-400'>{scheduleMonthLoading ? 'Обновляем график…' : 'Текущий месяц'}</span>
                    )}
                  </div>

                  <div className='grid grid-cols-7 gap-1 text-center text-xs font-extrabold text-slate-500'>
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>

                  <div className='grid grid-cols-7 gap-1'>
                    {calendarDays.map((cell) => {
                      const ownEntry = ownScheduleByDate.get(cell.date);
                      const workingInitials = getWorkingInitials(cell.date);
                      const selected = selectedScheduleDate === cell.date;
                      const statusClass =
                        !scheduleMonthLoaded
                          ? 'bg-slate-50 text-slate-400 ring-slate-100'
                          : ownEntry?.status === 'working'
                          ? 'bg-green-50 text-green-900 ring-green-100'
                          : ownEntry?.status === 'off'
                            ? 'bg-slate-100 text-slate-700 ring-slate-200'
                            : 'bg-amber-50 text-amber-800 ring-amber-100';

                      return (
                        <button
                          key={cell.date}
                          type='button'
                          onClick={() => setSelectedScheduleDate(cell.date)}
                          className={cn(
                            'employee-material-calendar-day flex min-h-[60px] min-w-0 flex-col rounded-md p-1 text-left ring-1 transition hover:scale-[1.01]',
                            statusClass,
                            !cell.inMonth && 'opacity-40',
                            selected && 'ring-2 ring-primary shadow-[0_8px_18px_rgba(81,180,17,0.16)]',
                          )}
                        >
                          <span className='text-[13px] font-extrabold leading-none'>{cell.day}</span>
                          <span className='mt-0.5 text-[11px] font-extrabold leading-none'>{scheduleMonthLoaded ? scheduleCellLabel(ownEntry?.status) : '…'}</span>
                          <span className='mt-auto flex max-w-full flex-wrap gap-x-1 gap-y-0.5 overflow-hidden leading-none'>
                            {scheduleMonthLoaded && workingInitials.initials.map((letter, index) => (
                              <span key={`${letter}-${index}`} className='text-[9px] font-extrabold leading-none text-green-800'>
                                {letter}
                              </span>
                            ))}
                            {scheduleMonthLoaded && workingInitials.extraCount > 0 && (
                              <span className='text-[9px] font-extrabold leading-none text-green-800'>+{workingInitials.extraCount}</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {scheduleMonthLoaded ? (
                    <ScheduleDayCard date={selectedScheduleDate} selected />
                  ) : (
                    <div className='rounded-lg bg-slate-50 px-3 py-4 text-center text-sm font-bold text-slate-500'>
                      Загружаем выбранный месяц…
                    </div>
                  )}
                </Card>
              )}
            </div>
          )}

        </div>

        <nav className='employee-material-nav fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2'>
          <div className='grid grid-cols-2 gap-1'>
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'employee-material-tab flex min-h-[52px] flex-col items-center justify-center gap-1 px-2 text-xs font-extrabold transition',
                    active ? 'is-active' : 'text-slate-500',
                  )}
                >
                  <span className='relative flex h-6 w-6 items-center justify-center' aria-hidden='true'>
                    <Icon className='h-5 w-5' strokeWidth={2.15} />
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </main>
  );
}
