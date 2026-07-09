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
  GraduationCap,
  Home,
  ReceiptText,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildDateRange, formatDateLabel, formatTime, getMoscowMinutes, getShiftOptionsForDepartment, shiftOptions, usesWorkdayShiftControl } from '@/lib/workday';
import { cn } from '@/lib/utils';

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

type AttestationSummary = {
  id: number;
  title: string;
  resultStatus: string | null;
  hasProgress: boolean;
};

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

type Props = {
  user: UserSummary;
  today: string;
  ownSchedule: ScheduleEntry[];
  departmentSchedule: ScheduleEntry[];
  departmentUsers: UserSummary[];
  todayWorkDay: WorkDayEntry | null;
  unfinishedWorkDay: WorkDayEntry | null;
  attestations: AttestationSummary[];
  shiftControl: ShiftControlState;
  cashOperations: CashOperation[];
};

type Tab = 'day' | 'schedule' | 'attestations';
type ScheduleMode = 'list' | 'month';
type QrScannerState = 'idle' | 'starting' | 'scanning' | 'found' | 'error';
type ShiftTaskDraft = {
  numericValue: string;
  integerValue: string;
  booleanValue: boolean;
  comment: string;
};
type HandoverPhotoKey =
  | 'personalStatementPhoto'
  | 'personalAcquiringReceiptsPhoto'
  | 'sberbankTerminalReportPhoto'
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
  personalAcquiringReceiptsPhoto: HandoverPhotoValue;
  personalCashBalance: string;
  discrepancyType: '' | 'none' | 'surplus' | 'shortage';
  discrepancyAmount: string;
  hadWithdrawal: '' | 'yes' | 'no';
  withdrawalAmount: string;
  cashOrderAmount: string;
  sberbankTerminalReportPhoto: HandoverPhotoValue;
  hasSberbankAcquiring: '' | 'yes' | 'no';
  sberbankTerminalTotal: string;
  hasTbankCredit: '' | 'yes' | 'no';
  tbankReceiptsPhoto: HandoverPhotoValue;
  tbankTerminalReportPhoto: HandoverPhotoValue;
  tbankTerminalTotal: string;
  zReportPhoto: HandoverPhotoValue;
  encashmentAmount: string;
  encashmentDocumentPhoto: HandoverPhotoValue;
  comment: string;
};
type CashOperationDraft = {
  direction: CashOperation['direction'] | null;
  amount: string;
  comment: string;
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
  { id: 'attestations', label: 'Аттестации', icon: GraduationCap },
];

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
    <div className='fixed inset-0 z-50 bg-slate-950 text-white'>
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

        <div className='relative flex-1 overflow-hidden rounded-3xl bg-black shadow-2xl shadow-black/40'>
          <video ref={videoRef} className='h-full w-full object-cover' muted playsInline autoPlay />
          <canvas ref={canvasRef} className='hidden' />
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center'>
            <div className='h-56 w-56 rounded-3xl border-4 border-green-300 shadow-[0_0_0_999px_rgba(2,6,23,0.42)]' />
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
          <div className='mt-4 rounded-2xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm font-bold text-amber-50'>
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
  if (status === 'working') return 'bg-green-100 text-green-800 ring-1 ring-green-200';
  if (status === 'off') return 'bg-slate-100 text-slate-700 ring-1 ring-slate-200';
  return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
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
  if (status === 'active') return 'bg-green-100 text-green-800 ring-1 ring-green-200';
  if (status === 'completed') return 'bg-green-100 text-green-800 ring-1 ring-green-200';
  if (status === 'missing_checkout') return 'bg-amber-100 text-amber-800 ring-1 ring-amber-200';
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
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
  if (task.category === 'acquiring') return task.title.replace('Проверить эквайринг', 'Сверить оплаты по терминалу').replace('Повторно проверить эквайринг', 'Повторно сверить оплаты по терминалу').replace('эквайринг', 'оплаты по терминалу');
  if (task.category === 'credit') return task.title.replace('Проверить кредиты и рассрочки', 'Сверить кредиты / рассрочки').replace('Повторно проверить кредиты и рассрочки', 'Повторно сверить кредиты / рассрочки').replace('кредиты и рассрочки', 'кредиты / рассрочки').replace('Кредиты', 'Кредиты / рассрочки');
  return task.title;
}

function shiftTaskIconClass(category: string) {
  if (category === 'cash') return 'bg-green-50 text-green-700 ring-green-100';
  if (category === 'credit') return 'bg-blue-50 text-blue-700 ring-blue-100';
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
  if (hours > 0 && restMinutes > 0) return `примерно через ${hours} ч ${restMinutes} мин`;
  if (hours > 0) return `примерно через ${hours} ч`;
  return `примерно через ${restMinutes} мин`;
}

function formatShiftMoney(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
}

function formatTaskCompletedAt(value: string | Date | null | undefined) {
  if (!value) return null;
  return formatTime(value);
}

function emptyShiftTaskDraft(task?: ShiftControlTask): ShiftTaskDraft {
  return {
    numericValue: task?.numericValue !== null && task?.numericValue !== undefined ? String(task.numericValue) : '',
    integerValue: task?.integerValue !== null && task?.integerValue !== undefined ? String(task.integerValue) : '',
    booleanValue: task?.booleanValue ?? false,
    comment: task?.comment ?? '',
  };
}

function emptyHandoverDraft(): HandoverDraft {
  return {
    personalStatementPhoto: null,
    personalAcquiringReceiptsPhoto: null,
    personalCashBalance: '',
    discrepancyType: '',
    discrepancyAmount: '',
    hadWithdrawal: '',
    withdrawalAmount: '',
    cashOrderAmount: '',
    sberbankTerminalReportPhoto: null,
    hasSberbankAcquiring: '',
    sberbankTerminalTotal: '',
    hasTbankCredit: '',
    tbankReceiptsPhoto: null,
    tbankTerminalReportPhoto: null,
    tbankTerminalTotal: '',
    zReportPhoto: null,
    encashmentAmount: '',
    encashmentDocumentPhoto: null,
    comment: '',
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readRecord(value: unknown, key: string) {
  return isRecord(value) && isRecord(value[key]) ? (value[key] as Record<string, unknown>) : null;
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
  const storeClosing = readRecord(data, 'storeClosing');
  if (personalCash) {
    draft.personalCashBalance = stringFromUnknown(personalCash.cashBalance);
    draft.discrepancyType = ['none', 'surplus', 'shortage'].includes(String(personalCash.discrepancyType)) ? String(personalCash.discrepancyType) as HandoverDraft['discrepancyType'] : '';
    draft.discrepancyAmount = stringFromUnknown(personalCash.discrepancyAmount);
    draft.hadWithdrawal = booleanDraftValue(personalCash.hadWithdrawal);
    draft.withdrawalAmount = stringFromUnknown(personalCash.withdrawalAmount);
    draft.cashOrderAmount = stringFromUnknown(personalCash.cashOrderAmount);
    draft.encashmentAmount = stringFromUnknown(personalCash.encashmentAmount);
  }
  if (storeClosing) {
    draft.hasSberbankAcquiring = booleanDraftValue(storeClosing.hasSberbankAcquiring);
    draft.sberbankTerminalTotal = stringFromUnknown(storeClosing.sberbankTerminalTotal);
    draft.hasTbankCredit = booleanDraftValue(storeClosing.hasTbankCredit);
    draft.tbankTerminalTotal = stringFromUnknown(storeClosing.tbankTerminalTotal);
  }
  if (isRecord(data) && typeof data.comment === 'string') draft.comment = data.comment;
  draft.personalStatementPhoto = readSavedPhoto(data, 'personalStatement');
  draft.personalAcquiringReceiptsPhoto = readSavedPhoto(data, 'personalAcquiringReceipts');
  draft.sberbankTerminalReportPhoto = readSavedPhoto(data, 'sberbankTerminalReport');
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
  if (integerValue === 0) return 'оплат картой не было';
  if (integerValue === 1) return 'оплаты картой сверены';
  if (integerValue === 2) return 'есть расхождение по оплатам картой';
  if (numericValue !== null && numericValue !== undefined) return 'оплаты картой сверены';
  return 'результат сверки не указан';
}

function creditResultLabel(integerValue: number | null | undefined) {
  if (integerValue === 0) return 'операций Т-Банка не было';
  if (integerValue === 1) return 'операции Т-Банка сверены';
  if (integerValue === 2) return 'есть расхождение по операциям Т-Банка';
  return 'результат сверки не указан';
}

function isClosingShift(shiftCode: string | null | undefined) {
  return shiftCode === '11_20';
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
    <div className='rounded-lg bg-white/80 px-2.5 py-1.5 ring-1 ring-slate-200/80'>
      <p className='text-[11px] font-extrabold uppercase text-slate-400'>{label}</p>
      <p className='mt-0.5 text-sm font-extrabold text-slate-950'>{value}</p>
    </div>
  );
}

function ColleagueGroup({ title, people, tone }: { title: string; people: UserSummary[]; tone: 'green' | 'slate' | 'amber' }) {
  const dotClass = tone === 'green' ? 'bg-primary' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <section className='rounded-lg bg-white/90 p-2.5 ring-1 ring-slate-200/80'>
      <div className='mb-1.5 flex items-center justify-between gap-3'>
        <div className='flex items-center gap-2'>
          <span className={cn('h-2.5 w-2.5 rounded-full', dotClass)} />
          <h3 className='text-sm font-extrabold text-slate-950'>{title}</h3>
        </div>
        <span className='text-xs font-extrabold text-slate-400'>{people.length}</span>
      </div>
      {people.length ? (
        <div className='grid gap-1.5'>
          {people.map((person) => (
            <div key={person.id} className='flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5'>
              <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#111821] text-[11px] font-extrabold text-white'>
                {initials(person.name)}
              </span>
              <span className='min-w-0 truncate text-sm font-bold text-slate-800'>{person.name}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className='text-sm font-medium text-slate-400'>Нет сотрудников</p>
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
  todayWorkDay,
  unfinishedWorkDay,
  attestations,
  shiftControl,
  cashOperations,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('day');
  const [ownScheduleState, setOwnScheduleState] = useState(ownSchedule);
  const [departmentScheduleState, setDepartmentScheduleState] = useState(departmentSchedule);
  const [workDay, setWorkDay] = useState(todayWorkDay);
  const [unfinished, setUnfinished] = useState(unfinishedWorkDay);
  const [shiftControlState, setShiftControlState] = useState(shiftControl);
  const [cashOperationsState, setCashOperationsState] = useState(cashOperations);
  const [cashOperationDraft, setCashOperationDraft] = useState<CashOperationDraft>({ direction: null, amount: '', comment: '' });
  const [selectedShift, setSelectedShift] = useState('');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrDepartmentConfirmed, setQrDepartmentConfirmed] = useState<string | null>(null);
  const [shiftPickerOpen, setShiftPickerOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [staleCloseReason, setStaleCloseReason] = useState('');
  const [staleCloseComment, setStaleCloseComment] = useState('');
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(monthKeyFromDate(today));
  const [selectedScheduleDate, setSelectedScheduleDate] = useState(today);
  const [openShiftTaskId, setOpenShiftTaskId] = useState<number | null>(null);
  const [shiftTaskDrafts, setShiftTaskDrafts] = useState<Record<number, ShiftTaskDraft>>({});
  const [shiftTaskErrors, setShiftTaskErrors] = useState<Record<number, Record<string, string>>>({});
  const [showFullShiftPlan, setShowFullShiftPlan] = useState(false);
  const [activeHandoverTaskId, setActiveHandoverTaskId] = useState<number | null>(null);
  const [handoverStep, setHandoverStep] = useState(0);
  const [handoverAttemptedStep, setHandoverAttemptedStep] = useState<string | null>(null);
  const [handoverDraft, setHandoverDraft] = useState<HandoverDraft>(() => emptyHandoverDraft());
  const [openingPhotoTaskId, setOpeningPhotoTaskId] = useState<number | null>(null);
  const [openingPhotoFile, setOpeningPhotoFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(''), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

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
  const elapsedMs = getElapsed(workDay, now);
  const elapsedLabel = formatDuration(elapsedMs);
  const activeElapsedLabel = formatDurationWithSeconds(elapsedMs);
  const shiftStart = workDay ? workDay.shiftStartMinutes : selectedShiftOption?.startMinutes;
  const shiftEnd = workDay ? workDay.shiftEndMinutes : selectedShiftOption?.endMinutes;
  const shiftControlEnabled = usesWorkdayShiftControl(user);
  const canUseCashOperations = shiftControlEnabled;
  const cashOperationTotal = cashOperationsState.reduce((sum, operation) => sum + operation.amount, 0);

  const syncCurrentWorkdayState = useCallback(async () => {
    try {
      const response = await fetch('/api/employee/workday/today', { cache: 'no-store' });
      if (!response.ok) {
        router.refresh();
        return;
      }

      const payload: unknown = await response.json();
      if (!isRecord(payload)) {
        router.refresh();
        return;
      }

      setWorkDay(isRecord(payload.workDay) ? (payload.workDay as WorkDayEntry) : null);
      setUnfinished(isRecord(payload.unfinishedWorkDay) ? (payload.unfinishedWorkDay as WorkDayEntry) : null);
      if (isRecord(payload.shiftControl)) {
        setShiftControlState({
          run: isRecord(payload.shiftControl.run) ? (payload.shiftControl.run as ShiftControlRun) : null,
          tasks: Array.isArray(payload.shiftControl.tasks) ? (payload.shiftControl.tasks as ShiftControlTask[]) : [],
        });
      }
      if (Array.isArray(payload.cashOperations)) setCashOperationsState(payload.cashOperations as CashOperation[]);
    } catch {
      // Keep the optimistic UI state, but still ask Next to refresh server props.
    } finally {
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncCurrentWorkdayState();
    };

    window.addEventListener('focus', syncWhenVisible);
    document.addEventListener('visibilitychange', syncWhenVisible);
    return () => {
      window.removeEventListener('focus', syncWhenVisible);
      document.removeEventListener('visibilitychange', syncWhenVisible);
    };
  }, [syncCurrentWorkdayState]);

  const todayDepartmentEntries = departmentScheduleByDate.get(today) ?? [];
  const todayEntryByUser = new Map(todayDepartmentEntries.map((entry) => [entry.userId, entry]));
  const colleagueUsers = departmentUsers.filter((person) => person.id !== user.id).sort(byName);
  const workingColleagues = colleagueUsers.filter((person) => todayEntryByUser.get(person.id)?.status === 'working');
  const offColleagues = colleagueUsers.filter((person) => todayEntryByUser.get(person.id)?.status === 'off');
  const missingColleagues = colleagueUsers.filter((person) => !todayEntryByUser.has(person.id));
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
    pendingShiftControlTasks.find((task) => task.plannedTimeMinutes === null || task.plannedTimeMinutes === undefined || getMoscowMinutes(now) >= task.plannedTimeMinutes) ?? null;
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
  const handoverPersonalCashBalance = parseMoneyInput(handoverDraft.personalCashBalance);
  const handoverDiscrepancyAmount = parseMoneyInput(handoverDraft.discrepancyAmount);
  const handoverIsClosingEmployee = isClosingShift(activeWorkDay?.shiftCode ?? workDay?.shiftCode);
  const handoverRequiresEncashment = handoverPersonalCashBalance !== null && handoverPersonalCashBalance > 50000;
  const handoverWithdrawalAmount = parseMoneyInput(handoverDraft.withdrawalAmount);
  const handoverCashOrderAmount = parseMoneyInput(handoverDraft.cashOrderAmount);
  const handoverWithdrawalDifference =
    handoverDraft.hadWithdrawal === 'yes' && handoverWithdrawalAmount !== null && handoverCashOrderAmount !== null
      ? Math.abs(handoverWithdrawalAmount - handoverCashOrderAmount)
      : 0;
  const handoverHasDaytimeAcquiringPayments =
    user.department === 'retail' &&
    shiftControlState.tasks.some((task) => {
      if (task.category !== 'acquiring') return false;
      if (task.integerValue === 1 || task.integerValue === 2) return true;
      return task.integerValue === null && task.numericValue !== null && task.numericValue > 0;
    });
  function buildHandoverSteps(draft = handoverDraft) {
    const draftCashBalance = parseMoneyInput(draft.personalCashBalance);
    const draftRequiresEncashment = draftCashBalance !== null && draftCashBalance > 50000;
    const isClosingEmployee = isClosingShift(activeWorkDay?.shiftCode ?? workDay?.shiftCode);
    const requiresAcquiringReceiptsPhoto = handoverHasDaytimeAcquiringPayments || draft.hasSberbankAcquiring === 'yes';
    return [
      'personalCashBalance',
      'discrepancy',
      ...(!isClosingEmployee && requiresAcquiringReceiptsPhoto ? ['personalAcquiringReceiptsPhoto'] : []),
      ...(user.department === 'retail' ? ['withdrawal'] : []),
      ...(draftRequiresEncashment ? ['encashment'] : []),
      ...(isClosingEmployee ? ['sberbankQuestion'] : []),
      ...(isClosingEmployee && requiresAcquiringReceiptsPhoto ? ['personalAcquiringReceiptsPhoto'] : []),
      ...(isClosingEmployee && draft.hasSberbankAcquiring === 'yes' ? ['sberbankTerminal'] : []),
      ...(isClosingEmployee ? ['tbankQuestion'] : []),
      ...(isClosingEmployee && draft.hasTbankCredit === 'yes' ? ['tbankReceipts'] : []),
      ...(isClosingEmployee && draft.hasTbankCredit === 'yes' ? ['tbankTerminal'] : []),
      ...(isClosingEmployee ? ['zReportPhoto'] : []),
    ] as const;
  }
  const handoverSteps = buildHandoverSteps(handoverDraft);
  const calendarDays = useMemo(() => buildCalendarMonth(calendarMonth), [calendarMonth]);
  const scheduleLegendUsers = useMemo(() => [...departmentUsers].filter((person) => person.id !== user.id).sort(byName), [departmentUsers, user.id]);

  useEffect(() => {
    if (!handoverTask || handoverTask.status === 'done' || activeHandoverTaskId) return;
    if (isRecord(handoverTask.handoverData) && handoverTask.handoverData.draft !== false) {
      startHandoverWizard(handoverTask);
    }
  }, [activeHandoverTaskId, handoverTask?.id, handoverTask?.status]);

  function getColleagueRows(date: string) {
    const entries = departmentScheduleByDate.get(date) ?? [];
    const entryByUser = new Map(entries.map((entry) => [entry.userId, entry]));
    return colleagueUsers.map((person) => ({
      person,
      entry: entryByUser.get(person.id),
    }));
  }

  function getWorkingInitials(date: string) {
    const entries = departmentScheduleByDate.get(date) ?? [];
    const entryByUser = new Map(entries.map((entry) => [entry.userId, entry]));
    return colleagueUsers
      .filter((person) => entryByUser.get(person.id)?.status === 'working')
      .slice(0, 4)
      .map((person) => initials(person.name));
  }

  function ScheduleDayCard({ date, selected = false }: { date: string; selected?: boolean }) {
    const ownEntry = ownScheduleByDate.get(date);
    const colleagueRows = getColleagueRows(date);
    const selectedWorkingRows = colleagueRows.filter(({ entry }) => entry?.status === 'working');
    const selectedOffRows = colleagueRows.filter(({ entry }) => entry?.status === 'off');
    const selectedMissingRows = colleagueRows.filter(({ entry }) => !entry);

    function SelectedColleagueGroup({ title, rows, tone }: { title: string; rows: typeof colleagueRows; tone: 'green' | 'slate' | 'amber' }) {
      const dotClass = tone === 'green' ? 'bg-primary' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400';

      return (
        <div className='rounded-lg bg-slate-50 px-2.5 py-2'>
          <div className='mb-1.5 flex items-center justify-between gap-2'>
            <span className='inline-flex items-center gap-2 text-xs font-extrabold text-slate-700'>
              <span className={cn('h-2 w-2 rounded-full', dotClass)} />
              {title}
            </span>
            <span className='text-[11px] font-extrabold text-slate-400'>{rows.length}</span>
          </div>
          {rows.length ? (
            <div className='grid gap-1'>
              {rows.map(({ person }) => (
                <div key={person.id} className='flex min-w-0 items-center gap-2'>
                  <span className='flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[9px] font-extrabold text-green-800 ring-1 ring-green-100'>
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
      <div className={cn('rounded-lg border bg-white p-3', selected ? 'border-primary/40 ring-2 ring-primary/10' : 'border-slate-200')}>
        <div className='mb-2.5 flex items-center justify-between gap-3'>
          <div className='min-w-0'>
            <p className='truncate text-base font-extrabold text-slate-950'>{formatDateLabel(date)}</p>
            {ownEntry?.status === 'working' && <p className='mt-0.5 text-xs font-bold text-green-700'>Рабочий день</p>}
          </div>
          <Badge className={cn('shrink-0 whitespace-nowrap px-2 py-0.5 text-[11px]', scheduleTone(ownEntry?.status))}>
            Я: {scheduleWorkLabel(ownEntry?.status)}
          </Badge>
        </div>

        <div className='grid grid-cols-2 gap-2'>
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
          <p className='mb-2 text-[11px] font-extrabold uppercase leading-none text-slate-400'>
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
                <div key={person.id} className='flex min-w-0 items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5'>
                  <div className='flex min-w-0 items-center gap-2'>
                    <span className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-[10px] font-extrabold text-green-800'>
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
      </div>
    );
  }

  async function updateSchedule(date: string, status: 'working' | 'off') {
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
      setOwnScheduleState(payload.ownSchedule);
      setDepartmentScheduleState(payload.departmentSchedule);
      router.refresh();
      setMessage('График обновлен');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить график');
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
      setWorkDay(payload.workDay);
      if (payload.shiftControlRun) {
        const { tasks, ...run } = payload.shiftControlRun;
        setShiftControlState({ run, tasks: tasks ?? [] });
      }
      setNow(new Date());
      setMessage('');
      setQrDepartmentConfirmed(null);
      await syncCurrentWorkdayState();
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
      if (!response.ok) throw new Error(payload.error || 'Не удалось завершить рабочий день');
      if (payload.workDay.date === today) setWorkDay(payload.workDay);
      setUnfinished(null);
      setNow(new Date());
      await syncCurrentWorkdayState();
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
      if (!response.ok) throw new Error(payload.error || 'Не удалось завершить предыдущий рабочий день');
      setUnfinished(null);
      setStaleCloseReason('');
      setStaleCloseComment('');
      setNow(new Date());
      await syncCurrentWorkdayState();
      setMessage(payload.staleClosed ? 'Предыдущий рабочий день закрыт' : 'Рабочий день завершён');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось завершить предыдущий рабочий день');
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
    setShowFullShiftPlan(false);
    setError('');
    setMessage('');
  }

  function updateHandoverDraft(patch: Partial<HandoverDraft>) {
    setHandoverDraft((current) => ({ ...current, ...patch }));
  }

  function openCashOperation(direction: CashOperation['direction']) {
    setCashOperationDraft({ direction, amount: '', comment: '' });
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
    formData.append('photo', file);

    setError('');
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/cash-operations', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сохранить кассовую операцию');

      setCashOperationsState((current) => [result.operation, ...current]);
      setCashOperationDraft({ direction: null, amount: '', comment: '' });
      await syncCurrentWorkdayState();
      setMessage(`Зафиксировано: ${formatCashOperationAmount(result.operation.amount)} ${cashOperationDirectionLabel(result.operation.direction)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить кассовую операцию');
    } finally {
      setIsSaving(false);
    }
  }

  async function saveHandoverDraft(task: ShiftControlTask, draft = handoverDraft) {
    const formData = new FormData();
    formData.append('intent', 'draft');
    ([
      'personalStatementPhoto',
      'personalAcquiringReceiptsPhoto',
      'sberbankTerminalReportPhoto',
      'tbankReceiptsPhoto',
      'tbankTerminalReportPhoto',
      'zReportPhoto',
      'encashmentDocumentPhoto',
    ] as HandoverPhotoKey[]).forEach((key) => {
      const file = draft[key];
      if (isHandoverFile(file)) formData.append(key, file);
    });
    formData.append('personalCashBalance', draft.personalCashBalance);
    formData.append('discrepancyType', draft.discrepancyType);
    formData.append('discrepancyAmount', draft.discrepancyAmount);
    formData.append('hadWithdrawal', draft.hadWithdrawal ? String(draft.hadWithdrawal === 'yes') : '');
    formData.append('withdrawalAmount', draft.withdrawalAmount);
    formData.append('cashOrderAmount', draft.cashOrderAmount);
    formData.append('hasSberbankAcquiring', draft.hasSberbankAcquiring ? String(draft.hasSberbankAcquiring === 'yes') : '');
    formData.append('sberbankTerminalTotal', draft.sberbankTerminalTotal);
    formData.append('hasTbankCredit', draft.hasTbankCredit ? String(draft.hasTbankCredit === 'yes') : '');
    formData.append('tbankTerminalTotal', draft.tbankTerminalTotal);
    formData.append('encashmentAmount', draft.encashmentAmount);
    formData.append('comment', draft.comment);

    const response = await fetch('/api/employee/shift-control/tasks/' + task.id, {
      method: 'PATCH',
      body: formData,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Не удалось сохранить шаг');
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
    const formData = new FormData();
    formData.append('openingReportPhoto', file);

    setError('');
    setIsSaving(true);
    try {
      const response = await fetch(`/api/employee/shift-control/tasks/${task.id}`, {
        method: 'PATCH',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось обновить задачу');

      const nextTasks = shiftControlState.tasks.map((item) => (item.id === result.task.id ? result.task : item));
      setShiftControlState((current) => ({
        ...current,
        tasks: current.tasks.map((item) => (item.id === result.task.id ? result.task : item)),
      }));
      setOpenShiftTaskId(null);
      setOpeningPhotoTaskId(null);
      setOpeningPhotoFile(null);
      setShiftTaskDrafts((current) => ({
        ...current,
        [result.task.id]: emptyShiftTaskDraft(result.task),
      }));
      await syncCurrentWorkdayState();
      setMessage(shiftControlPhotoMessage(nextTasks, result.task.id));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Не удалось обновить задачу';
      if (openShiftTaskId === task.id) {
        setShiftTaskErrors((current) => ({ ...current, [task.id]: { form: message } }));
      } else {
        setError(message);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function completeShiftControlTask(task: ShiftControlTask) {
    const draft = shiftTaskDrafts[task.id] ?? emptyShiftTaskDraft(task);
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
    } else if (task.category === 'acquiring') {
      const acquiringCheckStatus = readIntegerFromDraft(draft.integerValue);
      if (acquiringCheckStatus === null || ![0, 1, 2].includes(acquiringCheckStatus)) localErrors.integerValue = 'Выберите результат сверки оплат картой';
      if ((acquiringCheckStatus === 1 || acquiringCheckStatus === 2) && parseMoneyInput(draft.numericValue) === null) localErrors.numericValue = 'Укажите сумму оплат по терминалу';
      if (acquiringCheckStatus === 2 && !draft.comment.trim()) localErrors.comment = 'Опишите расхождение по оплатам картой';
      payload.integerValue = draft.integerValue;
      payload.booleanValue = acquiringCheckStatus !== 2;
      payload.numericValue = acquiringCheckStatus === 0 ? '0' : draft.numericValue;
      payload.comment = acquiringCheckStatus === 0 ? '' : draft.comment;
    } else if (task.category === 'credit') {
      const creditCheckStatus = readIntegerFromDraft(draft.integerValue);
      if (creditCheckStatus === null || ![0, 1, 2].includes(creditCheckStatus)) localErrors.integerValue = 'Выберите результат сверки';
      if (creditCheckStatus === 2 && !draft.comment.trim()) localErrors.comment = 'Опишите расхождение по операциям Т-Банка';
      payload.integerValue = draft.integerValue;
      payload.booleanValue = creditCheckStatus !== 2;
      payload.comment = creditCheckStatus === 0 ? '' : draft.comment;
    } else if (task.category === 'opening') {
      if (!openingPhotoFile) {
        setError('Сделайте фото X-отчёта / чека открытия смены');
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
          : JSON.stringify(payload);
      const response = await fetch(`/api/employee/shift-control/tasks/${task.id}`, {
        method: 'PATCH',
        headers: task.category === 'opening' ? undefined : { 'Content-Type': 'application/json' },
        body: requestBody,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось обновить задачу');

      setShiftControlState((current) => ({
        ...current,
        tasks: current.tasks.map((task) => (task.id === result.task.id ? result.task : task)),
      }));
      setOpenShiftTaskId(null);
      setOpeningPhotoTaskId(null);
      setOpeningPhotoFile(null);
      setShiftTaskErrors((current) => ({ ...current, [result.task.id]: {} }));
      setShiftTaskDrafts((current) => ({
        ...current,
        [result.task.id]: emptyShiftTaskDraft(result.task),
      }));
      await syncCurrentWorkdayState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить задачу');
    } finally {
      setIsSaving(false);
    }
  }

  function canActOnShiftTask(task: ShiftControlTask) {
    if (task.status === 'done') return false;
    return task.plannedTimeMinutes === null || task.plannedTimeMinutes === undefined || getMoscowMinutes(now) >= task.plannedTimeMinutes;
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
        if (money && task.integerValue !== 0) parts.push(`сумма: ${money} ₽`);
        if (task.category === 'acquiring' && task.comment) parts.push(task.comment);
      } else if (task.category === 'credit') {
        parts.push(creditResultLabel(task.integerValue));
        if (task.comment) parts.push(task.comment);
      } else if (task.comment) {
        parts.push(task.comment);
      }
      if (completedAt) parts.push(`выполнено ${completedAt}`);

      return <p className='mt-1 text-xs font-bold leading-snug text-slate-500'>{parts.join(' · ')}</p>;
    }

    return (
      <div className='mt-2 rounded-lg bg-green-50 px-2.5 py-2 text-xs font-bold leading-snug text-green-900 ring-1 ring-green-100'>
        {task.category === 'cash' && money && <p>Факт наличных: {money} ₽</p>}
        {task.category === 'acquiring' && (
          <div className='grid gap-0.5'>
            <p>{acquiringResultLabel(task.integerValue, task.numericValue)}</p>
            {money && task.integerValue !== 0 && <p>Сумма оплат картой: {money} ₽</p>}
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
      </div>
    );
  }

  function renderShiftTaskAction(task: ShiftControlTask, compact = false) {
    if (task.status === 'done') return renderShiftTaskAnswer(task);
    if (!canActOnShiftTask(task)) return null;

    const draft = shiftTaskDrafts[task.id] ?? emptyShiftTaskDraft(task);
    const isOpen = openShiftTaskId === task.id;
    const isCash = task.category === 'cash';
    const isAcquiring = task.category === 'acquiring';
    const isCredit = task.category === 'credit';
    const isOpening = task.category === 'opening';
    const simpleLabel = task.category === 'handover' ? 'Начать сдачу смены' : 'Подтвердить';
    const errors = shiftTaskErrors[task.id] ?? {};
    const showAcquiringAmount = isAcquiring && ['1', '2'].includes(draft.integerValue);

    if (isOpening) {
      return (
        <label className={cn('mt-2 flex w-full cursor-pointer items-center justify-center rounded-xl bg-[#111821] px-3 font-extrabold text-white shadow-sm', compact ? 'min-h-12 text-base' : 'min-h-8 text-xs')}>
          {isSaving && openingPhotoTaskId === task.id ? 'Сохраняем фото...' : 'Сделать фото'}
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
      );
    }

    if (!isCash && !isAcquiring && !isCredit) {
      return (
        <Button
          className={cn('mt-2 w-full font-extrabold', compact ? 'h-12 rounded-xl text-base' : 'h-8 text-xs')}
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
          className={cn('mt-2 w-full font-extrabold', compact ? 'h-12 rounded-xl text-base' : 'h-8 bg-slate-100 text-xs text-slate-800 shadow-none hover:bg-green-100 hover:text-green-800')}
          onClick={() => openShiftTaskForm(task)}
          disabled={isSaving}
        >
          {isCredit ? 'Сверить' : isAcquiring ? 'Сверить терминал' : 'Ввести факт'}
        </Button>
      );
    }

    return (
      <div className='mt-2 grid gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200/80'>
        {isCash && (
          <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
            Фактически пересчитано наличных
            <span className='text-[11px] font-semibold leading-snug text-slate-500'>
              Пересчитайте реальные деньги в своей кассе и внесите фактическую сумму. Не переписывайте остаток из 1С без пересчёта.
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
            {errors.numericValue && <span className='text-[11px] font-bold text-amber-700'>{errors.numericValue}</span>}
          </label>
        )}

        {isAcquiring && (
          <>
            <div className='grid gap-2'>
              <p className='text-xs font-extrabold text-slate-700'>Результат сверки оплат картой</p>
              <p className='text-[11px] font-semibold leading-snug text-slate-500'>
                Проверьте чеки оплат картой по своей кассе. Сумму вводите только если оплаты были.
              </p>
              <div className='grid grid-cols-1 gap-2 sm:grid-cols-3'>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '0' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '0', numericValue: '0', booleanValue: true, comment: '' })}
                >
                  Оплат не было
                </Button>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '1' ? '' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '1', numericValue: draft.numericValue === '0' ? '' : draft.numericValue, booleanValue: true, comment: '' })}
                >
                  Сверено
                </Button>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '2' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '2', numericValue: draft.numericValue === '0' ? '' : draft.numericValue, booleanValue: false })}
                >
                  Есть расхождение
                </Button>
              </div>
              {errors.integerValue && <span className='text-[11px] font-bold text-amber-700'>{errors.integerValue}</span>}
            </div>

            {showAcquiringAmount && (
              <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                Сумма оплат картой
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
                {errors.numericValue && <span className='text-[11px] font-bold text-amber-700'>{errors.numericValue}</span>}
              </label>
            )}

            {draft.integerValue === '2' && (
              <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                Комментарий
                <textarea
                  value={draft.comment}
                  onChange={(event) => updateShiftTaskDraft(task.id, { comment: event.target.value })}
                  className='min-h-14 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                  placeholder='Что именно не сходится?'
                />
                {errors.comment && <span className='text-[11px] font-bold text-amber-700'>{errors.comment}</span>}
              </label>
            )}
          </>
        )}

        {isCredit && (
          <>
            <div className='grid gap-2'>
              <p className='text-xs font-extrabold text-slate-700'>Результат сверки операций Т-Банка</p>
              <p className='text-[11px] font-semibold leading-snug text-slate-500'>
                Проверьте кредиты, первоначальные взносы и полные оплаты через Т-Банк. Если операций не было, так и отметьте.
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
                  Сверено
                </Button>
                <Button
                  type='button'
                  className={cn('h-9 px-2 text-xs shadow-none', draft.integerValue === '2' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100')}
                  onClick={() => updateShiftTaskDraft(task.id, { integerValue: '2', booleanValue: false })}
                >
                  Есть расхождение
                </Button>
              </div>
              {errors.integerValue && <span className='text-[11px] font-bold text-amber-700'>{errors.integerValue}</span>}
            </div>
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Комментарий {draft.integerValue === '2' ? '(обязательно)' : '(если нужно)'}
              <textarea
                value={draft.comment}
                onChange={(event) => updateShiftTaskDraft(task.id, { comment: event.target.value })}
                className='min-h-14 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder={draft.integerValue === '2' ? 'Что именно не сходится?' : 'Необязательно'}
              />
              {errors.comment && <span className='text-[11px] font-bold text-amber-700'>{errors.comment}</span>}
            </label>
          </>
        )}

        {errors.form && <p className='rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-800 ring-1 ring-amber-200'>{errors.form}</p>}

        <div className='grid grid-cols-2 gap-2'>
          <Button
            type='button'
            className='h-9 bg-slate-100 text-xs font-extrabold text-slate-700 shadow-none hover:bg-slate-200'
            onClick={() => {
              setOpenShiftTaskId(null);
              setShiftTaskErrors((current) => ({ ...current, [task.id]: {} }));
            }}
            disabled={isSaving}
          >
            Назад
          </Button>
          <Button type='button' className='h-9 text-xs font-extrabold' onClick={() => completeShiftControlTask(task)} disabled={isSaving}>
            Сохранить
          </Button>
        </div>
      </div>
    );
  }

  function getHandoverStepError(step = handoverSteps[handoverStep], draft = handoverDraft) {
    const draftCashBalance = parseMoneyInput(draft.personalCashBalance);
    const draftDiscrepancyAmount = parseMoneyInput(draft.discrepancyAmount);
    const draftWithdrawalAmount = parseMoneyInput(draft.withdrawalAmount);
    const draftCashOrderAmount = parseMoneyInput(draft.cashOrderAmount);
    const draftWithdrawalDifference =
      draft.hadWithdrawal === 'yes' && draftWithdrawalAmount !== null && draftCashOrderAmount !== null
        ? Math.abs(draftWithdrawalAmount - draftCashOrderAmount)
        : 0;

    if (step === 'personalCashBalance' && draftCashBalance === null) return 'Укажите остаток наличных в моей кассе';
    if (step === 'discrepancy') {
      if (!draft.discrepancyType) return 'Укажите расхождение по моей кассе';
      if (draft.discrepancyType !== 'none') {
        if (draftDiscrepancyAmount === null) return 'Укажите сумму расхождения';
        if (draftDiscrepancyAmount > 300 && !draft.comment.trim()) return 'Комментарий обязателен: расхождение больше 300 ₽';
      }
    }
    if (step === 'personalAcquiringReceiptsPhoto' && !hasHandoverPhoto(draft.personalAcquiringReceiptsPhoto)) return 'Сделайте фото чеков оплат картой за смену';
    if (step === 'sberbankQuestion' && !draft.hasSberbankAcquiring) return 'Укажите, были ли операции по терминалу Сбербанка';
    if (step === 'sberbankTerminal') {
      if (!hasHandoverPhoto(draft.sberbankTerminalReportPhoto)) return 'Сделайте фото отчёта терминала Сбербанка';
      if (parseMoneyInput(draft.sberbankTerminalTotal) === null) return 'Укажите итоговую сумму по отчёту терминала Сбербанка';
    }
    if (step === 'tbankQuestion' && !draft.hasTbankCredit) return 'Укажите, были ли операции через терминал Т-Банка';
    if (step === 'tbankReceipts' && !hasHandoverPhoto(draft.tbankReceiptsPhoto)) return 'Сделайте фото чеков / слипов Т-Банка за смену';
    if (step === 'tbankTerminal') {
      if (!hasHandoverPhoto(draft.tbankTerminalReportPhoto)) return 'Сделайте фото отчёта терминала Т-Банка';
      if (parseMoneyInput(draft.tbankTerminalTotal) === null) return 'Укажите итоговую сумму по отчёту терминала Т-Банка';
    }
    if (step === 'zReportPhoto' && !hasHandoverPhoto(draft.zReportPhoto)) return 'Сделайте фото Z-отчёта / чека закрытия смены';
    if (step === 'withdrawal') {
      if (!draft.hadWithdrawal) return 'Укажите, была ли выемка';
      if (draft.hadWithdrawal === 'yes') {
        if (draftWithdrawalAmount === null) return 'Укажите сумму выемки';
        if (draftCashOrderAmount === null) return 'Укажите сумму приходника';
        if (draftWithdrawalDifference > 0 && !draft.comment.trim()) return 'Добавьте комментарий к расхождению выемки';
      }
    }
    if (step === 'encashment') {
      if (parseMoneyInput(draft.encashmentAmount) === null) return 'Укажите сумму инкассации';
      if (!hasHandoverPhoto(draft.encashmentDocumentPhoto)) return 'Сфотографируйте деньги перед помещением в резерв или депозитный сейф.';
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
      'personalAcquiringReceiptsPhoto',
      'sberbankTerminalReportPhoto',
      'tbankReceiptsPhoto',
      'tbankTerminalReportPhoto',
      'zReportPhoto',
      'encashmentDocumentPhoto',
    ] as HandoverPhotoKey[]).forEach((key) => {
      const file = draft[key];
      if (isHandoverFile(file)) formData.append(key, file);
    });
    formData.append('personalCashBalance', draft.personalCashBalance);
    formData.append('discrepancyType', draft.discrepancyType);
    formData.append('discrepancyAmount', draft.discrepancyAmount);
    formData.append('hadWithdrawal', draft.hadWithdrawal ? String(draft.hadWithdrawal === 'yes') : '');
    formData.append('withdrawalAmount', draft.withdrawalAmount);
    formData.append('cashOrderAmount', draft.cashOrderAmount);
    formData.append('hasSberbankAcquiring', draft.hasSberbankAcquiring ? String(draft.hasSberbankAcquiring === 'yes') : '');
    formData.append('sberbankTerminalTotal', draft.sberbankTerminalTotal);
    formData.append('hasTbankCredit', draft.hasTbankCredit ? String(draft.hasTbankCredit === 'yes') : '');
    formData.append('tbankTerminalTotal', draft.tbankTerminalTotal);
    formData.append('encashmentAmount', draft.encashmentAmount);
    formData.append('comment', draft.comment);

    setError('');
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/shift-control/tasks/' + task.id, {
        method: 'PATCH',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Не удалось сдать смену');

      setShiftControlState((current) => ({
        run: result.run ?? current.run,
        tasks: result.tasks ?? current.tasks.map((item) => (item.id === result.task.id ? result.task : item)),
      }));
      if (result.workDay) {
        setWorkDay(result.workDay);
        setUnfinished(null);
      }
      setActiveHandoverTaskId(null);
      setHandoverAttemptedStep(null);
      setHandoverStep(0);
      setHandoverDraft(emptyHandoverDraft());
      setMessage(result.message || 'Смена сдана, рабочий день завершён');
      setNow(new Date());
      await syncCurrentWorkdayState();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сдать смену');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleHandoverPhotoSelected(task: ShiftControlTask, field: HandoverPhotoKey, file: File | null) {
    if (!file) return;

    const nextDraft = { ...handoverDraft, [field]: file };
    setHandoverDraft(nextDraft);
    setHandoverAttemptedStep(null);
    setError('');

    try {
      setIsSaving(true);
      await saveHandoverDraft(task, nextDraft);
      const nextSteps = buildHandoverSteps(nextDraft);
      const isFinalStep = handoverStep >= nextSteps.length - 1;
      const purePhotoStep =
        field === 'zReportPhoto' ||
        (field === 'encashmentDocumentPhoto' && isFinalStep);
      if (purePhotoStep) {
        if (isFinalStep) {
          await submitHandover(task, nextDraft, nextSteps);
          return;
        }
        setMessage('Фото прикреплено');
        setHandoverStep((current) => Math.min(nextSteps.length - 1, current + 1));
      } else {
        setMessage('Фото прикреплено');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось сохранить фото');
    } finally {
      setIsSaving(false);
    }
  }

  function renderPhotoInput(label: string, field: HandoverPhotoKey, task: ShiftControlTask, hint?: string, fieldError?: string) {
    const file = handoverDraft[field];
    return (
      <label className='grid gap-2 text-sm font-extrabold text-slate-800'>
        {label}
        {hint && <span className='text-xs font-semibold leading-snug text-slate-500'>{hint}</span>}
        {!file && (
          <span className='flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-[#111821] px-3 text-sm font-extrabold text-white shadow-sm'>
            Сделать фото
          </span>
        )}
        <input
          type='file'
          accept='image/*'
          capture='environment'
          className='sr-only'
          disabled={isSaving}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.currentTarget.value = '';
            handleHandoverPhotoSelected(task, field, file);
          }}
        />
        {file && <span className='rounded-lg bg-green-50 px-2.5 py-2 text-xs font-bold text-green-700 ring-1 ring-green-100'>Фото прикреплено</span>}
        {fieldError && <span className='text-[11px] font-bold text-amber-700'>{fieldError}</span>}
      </label>
    );
  }

  function renderHandoverStep(task: ShiftControlTask) {
    const step = handoverSteps[handoverStep];
    const isLastStep = handoverStep === handoverSteps.length - 1;
    const stepError = handoverAttemptedStep === step ? getHandoverStepError() : '';
    const sectionTitle = ['sberbankQuestion', 'sberbankTerminal', 'tbankQuestion', 'tbankReceipts', 'tbankTerminal', 'zReportPhoto'].includes(step) ? 'Закрытие магазина' : 'Сдача своей кассы';
    const reportMissingHint = 'Если фото или отчёт не получается, сообщите администратору.';
    const handoverStepTitle: Record<string, string> = {
      personalCashBalance: 'Пересчитайте наличные',
      personalAcquiringReceiptsPhoto: 'Подтвердите оплаты картой',
      discrepancy: 'Укажите расхождение',
      withdrawal: 'Проверьте выемку',
      encashment: 'Оформите инкассацию',
      sberbankQuestion: 'Проверьте терминал Сбербанка',
      sberbankTerminal: 'Сверьте терминал Сбербанка',
      tbankQuestion: 'Проверьте терминал Т-Банка',
      tbankReceipts: 'Подтвердите операции Т-Банка',
      tbankTerminal: 'Сверьте терминал Т-Банка',
      zReportPhoto: 'Закройте кассовую смену',
    };
    const handoverIcon =
      step === 'personalCashBalance' || step === 'withdrawal' || step === 'encashment'
        ? Banknote
        : step === 'personalAcquiringReceiptsPhoto' || step === 'sberbankQuestion' || step === 'sberbankTerminal'
          ? CreditCard
          : step === 'tbankQuestion' || step === 'tbankReceipts' || step === 'tbankTerminal'
            ? ReceiptText
            : step === 'discrepancy'
              ? AlertTriangle
              : ReceiptText;
    const HandoverIcon = handoverIcon;

    return (
      <div className='rounded-xl bg-white p-3 ring-1 ring-slate-200/80'>
        <div className='mb-3 flex items-start justify-between gap-3'>
          <div className='flex items-start gap-2'>
            <span className='mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700 ring-1 ring-green-100'>
              <HandoverIcon className='h-4 w-4' />
            </span>
            <div>
              <p className='text-[11px] font-extrabold uppercase text-green-700'>{sectionTitle}</p>
              <h3 className='mt-0.5 text-base font-extrabold text-slate-950'>{handoverStepTitle[step] ?? `Шаг ${handoverStep + 1} из ${handoverSteps.length}`}</h3>
              <p className='mt-1 text-xs font-semibold leading-snug text-slate-500'>Только ваша касса</p>
            </div>
          </div>
        </div>

        {step === 'zReportPhoto' && renderPhotoInput('Z-отчёт', 'zReportPhoto', task, `Сфотографируйте Z-отчёт закрытия кассы. ${reportMissingHint}`, stepError)}

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
            {stepError && <span className='text-[11px] font-bold text-amber-700'>{stepError}</span>}
          </label>
        )}

        {step === 'discrepancy' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Расхождение</p>
            <p className='text-xs font-semibold leading-snug text-slate-500'>
              Есть излишек или недостача? Укажите сумму.
            </p>
            <div className='grid grid-cols-3 gap-2'>
              {[
                ['none', 'Нет'],
                ['surplus', 'Излишек'],
                ['shortage', 'Недостача'],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type='button'
                  className={cn('h-10 px-2 text-xs shadow-none', handoverDraft.discrepancyType === value ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                  onClick={() => updateHandoverDraft({ discrepancyType: value as HandoverDraft['discrepancyType'], discrepancyAmount: value === 'none' ? '' : handoverDraft.discrepancyAmount, comment: value === 'none' ? '' : handoverDraft.comment })}
                >
                  {label}
                </Button>
              ))}
            </div>
            {handoverDraft.discrepancyType && handoverDraft.discrepancyType !== 'none' && (
              <div className='grid gap-2'>
                <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                  {handoverDraft.discrepancyType === 'surplus' ? 'Сумма излишка' : 'Сумма недостачи'}
                  <input
                    type='number'
                    inputMode='decimal'
                    min='0'
                    step='0.01'
                    value={handoverDraft.discrepancyAmount}
                    onChange={(event) => updateHandoverDraft({ discrepancyAmount: event.target.value })}
                    className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                    placeholder='0'
                  />
                </label>
                <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                  Комментарий к расхождению {handoverDiscrepancyAmount !== null && handoverDiscrepancyAmount > 300 ? '(обязательно)' : '(необязательно)'}
                  <textarea
                    value={handoverDraft.comment}
                    onChange={(event) => updateHandoverDraft({ comment: event.target.value })}
                    className='min-h-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                    placeholder='Причина расхождения'
                  />
                </label>
              </div>
            )}
            {stepError && <p className='text-[11px] font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'personalAcquiringReceiptsPhoto' && (
          <div className='grid gap-3'>
            {renderPhotoInput(
              'Чеки оплат картой',
              'personalAcquiringReceiptsPhoto',
              task,
              'Сфотографируйте все чеки оплат картой по вашей кассе за смену.',
              stepError,
            )}
          </div>
        )}

        {step === 'withdrawal' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Была выемка?</p>
            <p className='text-xs font-semibold leading-snug text-slate-500'>
              Если деньги забирали из кассы, укажите суммы.
            </p>
            <div className='grid grid-cols-2 gap-2'>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.hadWithdrawal === 'yes' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ hadWithdrawal: 'yes' })}
              >
                Была
              </Button>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.hadWithdrawal === 'no' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ hadWithdrawal: 'no', withdrawalAmount: '', cashOrderAmount: '' })}
              >
                Не было
              </Button>
            </div>
            {handoverDraft.hadWithdrawal === 'yes' && (
              <div className='grid gap-2'>
                <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                  Сумма выемки
                  <input
                    type='number'
                    inputMode='decimal'
                    min='0'
                    step='0.01'
                    value={handoverDraft.withdrawalAmount}
                    onChange={(event) => updateHandoverDraft({ withdrawalAmount: event.target.value })}
                    className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                    placeholder='0'
                  />
                </label>
                <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                  Сумма приходника
                  <input
                    type='number'
                    inputMode='decimal'
                    min='0'
                    step='0.01'
                    value={handoverDraft.cashOrderAmount}
                    onChange={(event) => updateHandoverDraft({ cashOrderAmount: event.target.value })}
                    className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                    placeholder='0'
                  />
                </label>
                {handoverWithdrawalDifference > 0 && (
                  <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
                    Комментарий к расхождению выемки
                    <textarea
                      value={handoverDraft.comment}
                      onChange={(event) => updateHandoverDraft({ comment: event.target.value })}
                      className='min-h-16 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                      placeholder={`Расхождение ${formatShiftMoney(handoverWithdrawalDifference)} ₽`}
                    />
                  </label>
                )}
              </div>
            )}
            {stepError && <p className='text-[11px] font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'encashment' && (
          <div className='grid gap-3'>
            <p className='rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-200'>
              Остаток наличных в моей кассе больше 50 000 ₽, нужна инкассация.
            </p>
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Сумма инкассации
              <input
                type='number'
                inputMode='decimal'
                min='0'
                step='0.01'
                value={handoverDraft.encashmentAmount}
                onChange={(event) => updateHandoverDraft({ encashmentAmount: event.target.value })}
                className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder='0'
              />
              {stepError && parseMoneyInput(handoverDraft.encashmentAmount) === null && <span className='text-[11px] font-bold text-amber-700'>{stepError}</span>}
            </label>
            {renderPhotoInput(
              'Инкассация',
              'encashmentDocumentPhoto',
              task,
              'Сфотографируйте деньги перед помещением в сейф.',
              stepError && parseMoneyInput(handoverDraft.encashmentAmount) !== null ? stepError : undefined,
            )}
          </div>
        )}

        {step === 'sberbankQuestion' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Были операции по терминалу Сбербанка?</p>
            <p className='text-xs font-semibold leading-snug text-slate-500'>
              Если операций не было, выберите “Нет” и идите дальше.
            </p>
            <div className='grid grid-cols-2 gap-2'>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.hasSberbankAcquiring === 'yes' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ hasSberbankAcquiring: 'yes' })}
              >
                Да
              </Button>
              <Button
                type='button'
                className={cn('h-10 shadow-none', handoverDraft.hasSberbankAcquiring === 'no' ? '' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                onClick={() => updateHandoverDraft({ hasSberbankAcquiring: 'no', sberbankTerminalReportPhoto: null, sberbankTerminalTotal: '0' })}
              >
                Нет
              </Button>
            </div>
            {stepError && <p className='text-[11px] font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'sberbankTerminal' && (
          <div className='grid gap-3'>
            {renderPhotoInput('Отчёт Сбербанка', 'sberbankTerminalReportPhoto', task, `Фото отчёта терминала. ${reportMissingHint}`, stepError && !hasHandoverPhoto(handoverDraft.sberbankTerminalReportPhoto) ? stepError : undefined)}
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Сумма по отчёту Сбербанка
              <input
                type='number'
                inputMode='decimal'
                min='0'
                step='0.01'
                value={handoverDraft.sberbankTerminalTotal}
                onChange={(event) => updateHandoverDraft({ sberbankTerminalTotal: event.target.value })}
                className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                placeholder='0'
              />
              {stepError && hasHandoverPhoto(handoverDraft.sberbankTerminalReportPhoto) && <span className='text-[11px] font-bold text-amber-700'>{stepError}</span>}
            </label>
          </div>
        )}

        {step === 'tbankQuestion' && (
          <div className='grid gap-3'>
            <p className='text-sm font-extrabold text-slate-800'>Были операции через терминал Т-Банка?</p>
            <p className='text-xs font-semibold leading-snug text-slate-500'>
              Кредиты, первоначальные взносы и полные оплаты через Т-Банк — это “Да”.
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
            {stepError && <p className='text-[11px] font-bold text-amber-700'>{stepError}</p>}
          </div>
        )}

        {step === 'tbankReceipts' && (
          <div className='grid gap-3'>
            {renderPhotoInput(
              'Чеки / слипы Т-Банка',
              'tbankReceiptsPhoto',
              task,
              'Сфотографируйте чеки и слипы Т-Банка за смену: кредиты, первоначальные взносы и полные оплаты.',
              stepError,
            )}
          </div>
        )}

        {step === 'tbankTerminal' && (
          <div className='grid gap-3'>
            {renderPhotoInput('Отчёт Т-Банка', 'tbankTerminalReportPhoto', task, `Фото отчёта терминала. ${reportMissingHint}`, stepError && !hasHandoverPhoto(handoverDraft.tbankTerminalReportPhoto) ? stepError : undefined)}
            <label className='grid gap-1 text-xs font-extrabold text-slate-700'>
              Сумма по отчёту Т-Банка
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
              {stepError && hasHandoverPhoto(handoverDraft.tbankTerminalReportPhoto) && <span className='text-[11px] font-bold text-amber-700'>{stepError}</span>}
            </label>
          </div>
        )}

        <div className='mt-4 grid grid-cols-2 gap-2'>
          <Button
            type='button'
            className='h-10 bg-slate-100 text-xs font-extrabold text-slate-700 shadow-none hover:bg-slate-200'
            onClick={() => {
              if (handoverStep === 0) {
                setActiveHandoverTaskId(null);
                setHandoverAttemptedStep(null);
                return;
              }
              setHandoverStep((current) => Math.max(0, current - 1));
              setHandoverAttemptedStep(null);
              setError('');
            }}
            disabled={isSaving}
          >
            {handoverStep === 0 ? 'Отмена' : 'Назад'}
          </Button>
          <Button
            type='button'
            className='h-10 text-xs font-extrabold'
            onClick={async () => {
              const currentError = getHandoverStepError();
              if (currentError) {
                setHandoverAttemptedStep(step);
                return;
              }
              setHandoverAttemptedStep(null);
              setError('');
              try {
                setIsSaving(true);
                const nextDraft = handoverDraft;
                await saveHandoverDraft(task, nextDraft);
                const nextSteps = buildHandoverSteps(nextDraft);
                if (handoverStep >= nextSteps.length - 1) {
                  await submitHandover(task, nextDraft, nextSteps);
                  return;
                }
                setHandoverStep((current) => Math.min(nextSteps.length - 1, current + 1));
              } catch (reason) {
                setError(reason instanceof Error ? reason.message : 'Не удалось сохранить шаг');
              } finally {
                setIsSaving(false);
              }
            }}
            disabled={isSaving}
          >
            {isLastStep ? 'Сдать смену' : 'Далее'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className='min-h-screen overflow-x-hidden bg-[#111821] text-slate-950 md:px-6 md:py-6'>
      {qrScannerOpen && (
        <WorkdayQrScanner
          userDepartment={user.department}
          onCancel={() => setQrScannerOpen(false)}
          onAccepted={handleQrAccepted}
        />
      )}
      {shiftPickerOpen && !workDay && (
        <div className='fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px]'>
          <div className='w-full max-w-[520px] rounded-t-[28px] bg-white px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-5 shadow-2xl'>
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
                  className='flex min-h-14 items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left text-base font-black text-slate-950 transition active:scale-[0.99] disabled:opacity-60'
                >
                  <span>{shiftLabel(shift.code)}</span>
                  <span className='text-xs font-extrabold uppercase text-green-700'>Начать</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className='relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-[#f7faf8] shadow-[0_0_70px_rgba(0,0,0,0.24)] ring-1 ring-white/10 md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[24px]'>
        <header className='bg-[#111821] px-4 pb-4 pt-4 text-white'>
          <div className='flex items-center justify-between gap-3'>
            <BrandBlock size='header' />
            <div className='flex items-center gap-2'>
              <div className='flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.08] text-xs font-extrabold text-white ring-1 ring-white/10'>
                {initials(user.name)}
              </div>
              <LogoutButton iconOnly title='Выйти' className='h-10 w-10 bg-white/[0.08] px-0 text-white ring-1 ring-white/10 hover:bg-white/[0.12]' />
            </div>
          </div>

          <div className='mt-3 flex items-end justify-between gap-3'>
            <p className='min-w-0 truncate text-sm font-bold text-slate-100'>{user.name} · {departmentLabel(user.department)}</p>
            <p className='shrink-0 text-xs font-semibold text-slate-300'>{formatDateLabel(today)}</p>
          </div>
        </header>

        <div className='flex-1 px-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] pt-4'>
          {(unfinished || (activeWorkDay && activeWorkDay.date !== today)) && (
            <Card className='mb-4 border-amber-200 bg-amber-50'>
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
                        placeholder='Например: Z-отчёт выбросила, фото сделать уже не могу'
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
              className='mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-800 ring-1 ring-red-200'
            >
              {error}
            </div>
          )}

          {message && (
            <div className='fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[488px] items-center gap-2.5 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-slate-950 shadow-2xl ring-1 ring-green-200'>
              <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100'>
                <CheckCircle2 className='h-4 w-4' />
              </span>
              <span className='min-w-0'>{message}</span>
            </div>
          )}

          {activeTab === 'day' && (
            <div className='space-y-3'>
              {!workDay && (
                <Card className='space-y-3 p-4'>
                  <div className='flex items-start gap-3'>
                    <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100'>
                      <Camera className='h-6 w-6' />
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
                    className='h-14 w-full rounded-xl text-base font-black'
                    onClick={openQrStart}
                    disabled={isSaving || Boolean(unfinished)}
                  >
                    <Camera className='mr-2 h-5 w-5' />
                    Сканировать QR
                  </Button>
                  {unfinished && (
                    <p className='text-xs font-bold text-amber-700'>Сначала закройте предыдущий рабочий день.</p>
                  )}
                </Card>
              )}

              {activeWorkDay && (
                <div className='flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-sm font-extrabold text-green-900 ring-1 ring-green-100'>
                  <span className='flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-green-700 ring-1 ring-green-100'>
                    <CheckCircle2 className='h-4 w-4' />
                  </span>
                  <span className='min-w-0 truncate'>Рабочий день · {workDay?.shiftLabel} · {activeElapsedLabel}</span>
                </div>
              )}

              {activeWorkDay && !showShiftControl && (
                <Card className='space-y-3 border-green-100 bg-white p-4'>
                  <div className='flex items-start gap-3'>
                    <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700 ring-1 ring-green-100'>
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
                  <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-700'>
                    <Check className='h-5 w-5' />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-sm font-black text-slate-950'>Рабочий день завершён</p>
                    <p className='mt-0.5 text-xs font-bold text-slate-500'>
                      {formatTime(workDay?.startedAt)}–{formatTime(workDay?.endedAt)} · {elapsedLabel}
                    </p>
                  </div>
                </Card>
              )}

              {showShiftControl && (
                <Card className='space-y-3 bg-white p-4'>
                  <div>
                    <div>
                      <h2 className='text-xl font-black text-slate-950'>Сейчас нужно</h2>
                      <p className='mt-0.5 text-xs font-bold text-slate-500'>
                        {activeHandoverTask ? `Сдача смены: шаг ${handoverStep + 1} из ${handoverSteps.length}` : remainingTasksLabel(remainingShiftControlCount, primaryShiftControlTask?.category)}
                      </p>
                    </div>
                  </div>

                  {activeHandoverTask ? null : (
                    <div className={cn('rounded-2xl border-l-4 px-3.5 py-3 ring-1', actionableShiftControlTask ? 'border-green-500 bg-white ring-green-200 shadow-sm' : 'border-transparent bg-slate-50 ring-slate-200')}>
                      <p className={cn('text-[11px] font-extrabold uppercase', actionableShiftControlTask ? 'text-green-700' : 'text-slate-400')}>
                        {actionableShiftControlTask ? 'Текущий шаг' : 'Следующая проверка'}
                      </p>
                      <div className='mt-1 flex items-center gap-2'>
                        {primaryShiftControlTask && (() => {
                          const Icon = shiftTaskIcon(primaryShiftControlTask);
                          return (
                            <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1', shiftTaskIconClass(primaryShiftControlTask.category))}>
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
                            {shiftTaskStatusLabel(shiftTaskStatus(primaryShiftControlTask, now))}
                          </span>
                          <span className='text-xs font-bold text-slate-500'>
                            {plannedTimeLabel(primaryShiftControlTask.plannedTimeMinutes)}
                          </span>
                          {!actionableShiftControlTask && (
                            <span className='text-xs font-bold text-slate-500'>{timeUntilLabel(primaryShiftControlTask.plannedTimeMinutes, now)}</span>
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
                      className='h-9 w-full bg-slate-100 text-xs font-extrabold text-slate-800 shadow-none hover:bg-slate-200'
                      onClick={() => setShowFullShiftPlan((current) => !current)}
                    >
                      {showFullShiftPlan ? 'Скрыть план смены' : `Показать остальные задачи (${otherShiftControlTaskCount})`}
                    </Button>
                  )}

                  {!activeHandoverTask && showFullShiftPlan && (
                    <div className='grid gap-2'>
                      {visibleShiftControlTasks.filter((task) => task.id !== primaryShiftControlTask?.id).map((task) => {
                      const uiStatus = shiftTaskStatus(task, now);
                      const Icon = shiftTaskIcon(task);
                      return (
                        <div key={task.id} className={cn('flex gap-2 rounded-lg bg-slate-50 px-2.5 py-2 text-slate-600 ring-1 ring-slate-200/80', uiStatus === 'done' && 'opacity-75')}>
                          <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1', shiftTaskIconClass(task.category))}>
                            {uiStatus === 'done' ? <CheckCircle2 className='h-4 w-4' /> : <Icon className='h-4 w-4' />}
                          </div>
                          <div className='min-w-0 flex-1'>
                            <div className='flex items-start justify-between gap-2'>
                              <div className='min-w-0'>
                                <p className='text-sm font-extrabold leading-tight text-slate-700'>{shiftTaskTitle(task)}</p>
                                <p className='mt-1 text-xs font-bold text-slate-500'>План: {plannedTimeLabel(task.plannedTimeMinutes)}</p>
                              </div>
                              <Badge className='shrink-0 bg-white px-2 py-0.5 text-[10px] text-slate-500 ring-1 ring-slate-200'>
                                {shiftTaskStatusLabel(uiStatus)}
                              </Badge>
                            </div>
                            {uiStatus === 'done'
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
                    <Banknote className='h-5 w-5 text-primary' />
                  </div>

                  <div className={cn('grid gap-2', user.department === 'retail' ? 'grid-cols-2' : 'grid-cols-1')}>
                    {user.department === 'retail' && (
                      <Button
                        type='button'
                        className='h-9 border border-slate-200 bg-white px-2 text-xs font-extrabold text-slate-800 shadow-none hover:bg-slate-50 hover:text-slate-950'
                        onClick={() => openCashOperation('phone_reserve')}
                        disabled={!workDay || isSaving}
                      >
                        Пополнить резерв
                      </Button>
                    )}
                    <Button
                      type='button'
                      className='h-9 border border-slate-200 bg-white px-2 text-xs font-extrabold text-slate-800 shadow-none hover:bg-slate-50 hover:text-slate-950'
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
                    <div className='grid gap-2 rounded-lg bg-slate-50 p-2.5 ring-1 ring-slate-200/80'>
                      <div className='flex items-center justify-between gap-2'>
                        <p className='text-sm font-extrabold text-slate-950'>
                          {cashOperationDraft.direction === 'phone_reserve' ? 'Пополнить резерв' : 'В депозитный сейф'}
                        </p>
                        <button
                          type='button'
                          className='text-xs font-extrabold text-slate-400 hover:text-slate-700'
                          onClick={() => setCashOperationDraft({ direction: null, amount: '', comment: '' })}
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
                        {isSaving ? 'Сохраняем фото...' : 'Сделать фото'}
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
                            <p className='mt-0.5 text-[11px] font-bold text-slate-400'>{formatTime(operation.createdAt)}</p>
                          </div>
                          <Badge className='shrink-0 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800 ring-1 ring-amber-200'>
                            ожидает 1С
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              <Card className='bg-slate-50 p-4'>
                <div className='mb-2.5 flex items-center justify-between gap-3'>
                  <h2 className='text-base font-extrabold text-slate-950'>Детали смены</h2>
                  <Badge className={cn('shrink-0 whitespace-nowrap px-2 py-0.5 text-[11px]', factTone(displayedWorkDayStatus))}>
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
                  <Users className='h-5 w-5 text-primary' />
                  <h2 className='text-base font-extrabold text-slate-950'>Коллеги сегодня</h2>
                </div>
                <ColleagueGroup title='Работают' people={workingColleagues} tone='green' />
                <ColleagueGroup title='Выходной' people={offColleagues} tone='slate' />
                <ColleagueGroup title='График не заполнен' people={missingColleagues} tone='amber' />
              </Card>
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className='space-y-3'>
              <Card className='space-y-3 p-3.5'>
                <div className='flex items-center gap-2'>
                  <CalendarDays className='h-5 w-5 text-primary' />
                  <h2 className='text-xl font-extrabold text-slate-950'>График</h2>
                </div>

                <div className='grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1'>
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

                  <Button className='w-full gap-2 bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200' onClick={() => setShowFullSchedule((current) => !current)}>
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
                      className='flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200'
                      onClick={() => setCalendarMonth((current) => addMonths(current, -1))}
                      aria-label='Предыдущий месяц'
                    >
                      <ChevronLeft className='h-5 w-5' />
                    </button>
                    <p className='text-base font-extrabold text-slate-950'>{monthTitle(calendarMonth)}</p>
                    <button
                      type='button'
                      className='flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-800 hover:bg-slate-200'
                      onClick={() => setCalendarMonth((current) => addMonths(current, 1))}
                      aria-label='Следующий месяц'
                    >
                      <ChevronRight className='h-5 w-5' />
                    </button>
                  </div>

                  <div className='grid grid-cols-7 gap-1 text-center text-[11px] font-extrabold text-slate-500'>
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
                        ownEntry?.status === 'working'
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
                            'flex min-h-[60px] min-w-0 flex-col rounded-md p-1 text-left ring-1 transition hover:scale-[1.01]',
                            statusClass,
                            !cell.inMonth && 'opacity-40',
                            selected && 'ring-2 ring-primary shadow-[0_8px_18px_rgba(81,180,17,0.16)]',
                          )}
                        >
                          <span className='text-[13px] font-extrabold leading-none'>{cell.day}</span>
                          <span className='mt-0.5 text-[10px] font-extrabold leading-none'>{scheduleCellLabel(ownEntry?.status)}</span>
                          <span className='mt-auto flex max-w-full flex-wrap gap-x-1 gap-y-0.5 overflow-hidden leading-none'>
                            {workingInitials.map((letter, index) => (
                              <span key={`${letter}-${index}`} className='text-[8px] font-extrabold leading-none text-green-800'>
                                {letter}
                              </span>
                            ))}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className='rounded-lg border border-slate-200 bg-white p-2.5'>
                    <p className='mb-2 text-sm font-extrabold text-slate-950'>Обозначения</p>
                    <div className='grid gap-1.5'>
                      {scheduleLegendUsers.map((person) => (
                        <div key={person.id} className='flex min-w-0 items-baseline gap-2 text-xs font-bold text-slate-700'>
                          <span className='shrink-0 font-extrabold text-green-800'>
                            {initials(person.name)}
                          </span>
                          <span className='shrink-0 text-slate-300'>—</span>
                          <span className='min-w-0 leading-tight'>{personDisplayName(person.name)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <ScheduleDayCard date={selectedScheduleDate} selected />
                </Card>
              )}
            </div>
          )}

          {activeTab === 'attestations' && (
            <Card>
              <div className='mb-4 flex items-center gap-2'>
                <GraduationCap className='h-5 w-5 text-primary' />
                <h2 className='text-lg font-extrabold text-slate-950'>Аттестации</h2>
              </div>
              {attestations.length ? (
                <div className='grid gap-3'>
                  {attestations.map((attestation) => (
                    <Link
                      key={attestation.id}
                      href={`/employee/attestations/${attestation.id}`}
                      className='flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 transition hover:border-primary/40 hover:bg-green-50'
                    >
                      <div>
                        <p className='font-extrabold text-slate-950'>{attestation.title}</p>
                        <p className='mt-1 text-sm font-medium text-slate-500'>
                          {attestation.resultStatus ? 'Уже пройдена' : attestation.hasProgress ? 'Можно продолжить' : 'Доступна'}
                        </p>
                      </div>
                      <CheckCircle2 className='h-5 w-5 text-primary' />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className='text-sm font-medium text-slate-500'>Сейчас нет доступных аттестаций.</p>
              )}
            </Card>
          )}
        </div>

        <nav className='fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[520px] border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_34px_rgba(15,23,42,0.12)] backdrop-blur md:absolute'>
          <div className='grid grid-cols-3 gap-1'>
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    'flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-lg px-2 text-[11px] font-extrabold transition',
                    active ? 'bg-[#111821] text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'text-primary')} />
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
