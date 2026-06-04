'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Home,
  MessageSquare,
  Play,
  Power,
  Users,
} from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildDateRange, formatDateLabel, formatTime, getMoscowMinutes, shiftOptions } from '@/lib/workday';
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

type Props = {
  user: UserSummary;
  today: string;
  ownSchedule: ScheduleEntry[];
  departmentSchedule: ScheduleEntry[];
  departmentUsers: UserSummary[];
  todayWorkDay: WorkDayEntry | null;
  unfinishedWorkDay: WorkDayEntry | null;
  attestations: AttestationSummary[];
};

type Tab = 'day' | 'schedule' | 'attestations';

const tabs: Array<{ id: Tab; label: string; icon: typeof Home }> = [
  { id: 'day', label: 'Рабочий день', icon: Home },
  { id: 'schedule', label: 'График', icon: CalendarDays },
  { id: 'attestations', label: 'Аттестации', icon: GraduationCap },
];

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

function shiftLabel(code: string) {
  const shift = shiftOptions.find((option) => option.code === code);
  if (!shift) return 'не выбрана';
  return shift.code === 'other' ? 'Другая смена' : shift.label;
}

function getElapsed(workDay: WorkDayEntry | null, now: Date) {
  if (!workDay) return 0;
  const start = new Date(workDay.startedAt).getTime();
  const end = workDay.endedAt ? new Date(workDay.endedAt).getTime() : now.getTime();
  return Math.max(0, end - start);
}

function getShiftProgress(workDay: WorkDayEntry | null, selectedShift: string, now: Date) {
  const shift =
    workDay?.shiftStartMinutes !== undefined
      ? { startMinutes: workDay.shiftStartMinutes, endMinutes: workDay.shiftEndMinutes }
      : shiftOptions.find((option) => option.code === selectedShift);

  if (!shift) return 0;
  if (shift.startMinutes === null || shift.endMinutes === null || shift.startMinutes === undefined || shift.endMinutes === undefined) {
    return workDay?.status === 'completed' ? 100 : 0;
  }
  if (workDay?.status === 'completed') return 100;

  const currentMinutes = getMoscowMinutes(now);
  const duration = Math.max(1, shift.endMinutes - shift.startMinutes);
  const progress = ((currentMinutes - shift.startMinutes) / duration) * 100;
  return Math.min(100, Math.max(0, progress));
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
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('day');
  const [ownScheduleState, setOwnScheduleState] = useState(ownSchedule);
  const [departmentScheduleState, setDepartmentScheduleState] = useState(departmentSchedule);
  const [workDay, setWorkDay] = useState(todayWorkDay);
  const [unfinished, setUnfinished] = useState(unfinishedWorkDay);
  const [selectedShift, setSelectedShift] = useState('');
  const [comment, setComment] = useState('');
  const [showLateComment, setShowLateComment] = useState(false);
  const [showFullSchedule, setShowFullSchedule] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

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

  const todaySchedule = ownScheduleByDate.get(today);
  const activeWorkDay = workDay && workDay.status !== 'completed' ? workDay : null;
  const isCompleted = workDay?.status === 'completed';
  const selectedShiftOption = shiftOptions.find((shift) => shift.code === selectedShift);
  const canStartWorkDay = Boolean(selectedShift) && !workDay && !isSaving;
  const predictedLate =
    selectedShiftOption?.startMinutes !== null &&
    selectedShiftOption?.startMinutes !== undefined &&
    getMoscowMinutes(now) > selectedShiftOption.startMinutes &&
    !workDay;
  const elapsedMs = getElapsed(workDay, now);
  const elapsedLabel = formatDuration(elapsedMs);
  const activeElapsedLabel = formatDurationWithSeconds(elapsedMs);
  const progress = getShiftProgress(workDay, selectedShift, now);
  const ringProgress = !workDay && selectedShift ? 100 : progress;
  const ringStyle = {
    background: `conic-gradient(#51b411 ${ringProgress * 3.6}deg, #dfe6e1 0deg)`,
  };
  const shiftStart = workDay ? workDay.shiftStartMinutes : selectedShiftOption?.startMinutes;
  const shiftEnd = workDay ? workDay.shiftEndMinutes : selectedShiftOption?.endMinutes;

  const todayDepartmentEntries = departmentScheduleByDate.get(today) ?? [];
  const todayEntryByUser = new Map(todayDepartmentEntries.map((entry) => [entry.userId, entry]));
  const colleagueUsers = departmentUsers.filter((person) => person.id !== user.id).sort(byName);
  const workingColleagues = colleagueUsers.filter((person) => todayEntryByUser.get(person.id)?.status === 'working');
  const offColleagues = colleagueUsers.filter((person) => todayEntryByUser.get(person.id)?.status === 'off');
  const missingColleagues = colleagueUsers.filter((person) => !todayEntryByUser.has(person.id));

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
      setMessage('График обновлен');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось обновить график');
    } finally {
      setIsSaving(false);
    }
  }

  async function startWorkDay() {
    setError('');
    setMessage('');
    if (!selectedShift) {
      setError('Выберите смену перед началом рабочего дня');
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/workday/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftCode: selectedShift, comment }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось начать рабочий день');
      setWorkDay(payload.workDay);
      setNow(new Date());
      setMessage('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось начать рабочий день');
    } finally {
      setIsSaving(false);
    }
  }

  async function finishWorkDay() {
    setError('');
    setMessage('');
    setIsSaving(true);
    try {
      const response = await fetch('/api/employee/workday/finish', { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось завершить рабочий день');
      if (payload.workDay.date === today) setWorkDay(payload.workDay);
      setUnfinished(null);
      setNow(new Date());
      setMessage('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Не удалось завершить рабочий день');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className='min-h-screen overflow-x-hidden bg-[#111821] text-slate-950 md:px-6 md:py-6'>
      <div className='mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-[#f7faf8] shadow-[0_0_70px_rgba(0,0,0,0.24)] ring-1 ring-white/10 md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[24px]'>
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
            <p className='shrink-0 text-xs font-semibold text-green-300'>{formatDateLabel(today)}</p>
          </div>
        </header>

        <div className='flex-1 px-4 pb-[calc(8.75rem+env(safe-area-inset-bottom))] pt-4'>
          {(unfinished || (activeWorkDay && activeWorkDay.date !== today)) && (
            <Card className='mb-4 border-amber-200 bg-amber-50'>
              <div className='flex items-start gap-3'>
                <AlertTriangle className='mt-0.5 h-5 w-5 shrink-0 text-amber-700' />
                <div className='flex-1'>
                  <p className='font-extrabold text-amber-950'>Есть незавершенный рабочий день</p>
                  <p className='mt-1 text-sm font-medium text-amber-900'>Завершите предыдущую отметку, чтобы статус был корректным.</p>
                  <Button className='mt-3 w-full bg-amber-600 hover:bg-amber-700' onClick={finishWorkDay} disabled={isSaving}>
                    Завершить
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {(message || error) && (
            <div
              className={cn(
                'mb-4 rounded-lg px-4 py-3 text-sm font-semibold',
                error ? 'bg-red-50 text-red-800 ring-1 ring-red-200' : 'bg-green-50 text-green-800 ring-1 ring-green-200',
              )}
            >
              {error || message}
            </div>
          )}

          {activeTab === 'day' && (
            <div className='space-y-3'>
              <Card className='space-y-2 p-3.5'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <h2 className='text-base font-extrabold text-slate-950'>Смена</h2>
                    <p className='mt-0.5 text-xs font-medium leading-snug text-slate-500'>
                      {workDay ? 'Смена зафиксирована.' : 'Выберите смену.'}
                    </p>
                  </div>
                  <Badge className={cn('shrink-0 whitespace-nowrap px-2 py-0.5 text-[11px]', scheduleTone(todaySchedule?.status))}>
                    {scheduleLabel(todaySchedule?.status)}
                  </Badge>
                </div>

                {!workDay ? (
                  <label className='block text-sm font-bold text-slate-700'>
                    Фактическая смена
                    <select
                      value={selectedShift}
                      onChange={(event) => setSelectedShift(event.target.value)}
                      className='mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                    >
                      <option value=''>Выберите смену</option>
                      {shiftOptions.map((shift) => (
                        <option key={shift.code} value={shift.code}>
                          {shiftLabel(shift.code)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className='rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-slate-200/80'>
                    <p className='text-xs font-extrabold uppercase text-slate-400'>Выбранная смена</p>
                    <p className='mt-1 text-base font-extrabold text-slate-950'>{workDay.shiftLabel}</p>
                  </div>
                )}

                {!workDay && (
                  <>
                    {predictedLate && !showLateComment && (
                      <div className='flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 ring-1 ring-amber-200'>
                        <span>Поздняя отметка</span>
                        <button type='button' className='text-primary hover:text-green-800' onClick={() => setShowLateComment(true)}>
                          + Комментарий
                        </button>
                      </div>
                    )}
                    {showLateComment ? (
                      <label className='block text-sm font-bold text-slate-700'>
                        Комментарий
                        {predictedLate && (
                          <span className='mt-1 block text-xs font-medium leading-snug text-slate-500'>
                            Комментарий не отменяет опоздание, но поможет объяснить причину.
                          </span>
                        )}
                        <textarea
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          className='mt-1.5 min-h-14 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20'
                          placeholder='Например: задержал транспорт'
                        />
                      </label>
                    ) : !predictedLate ? (
                      <button type='button' className='inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-primary' onClick={() => setShowLateComment(true)}>
                        <MessageSquare className='h-4 w-4' />
                        Добавить комментарий
                      </button>
                    ) : null}
                  </>
                )}
              </Card>

              <Card className='p-3.5 text-center'>
                <div
                  className={cn(
                    'mx-auto flex h-[178px] w-[178px] items-center justify-center rounded-full p-1.5 transition',
                    canStartWorkDay && 'shadow-[0_0_28px_rgba(81,180,17,0.14)]',
                  )}
                  style={ringStyle}
                >
                  <div className='flex h-full w-full items-center justify-center rounded-full bg-white ring-1 ring-slate-200/90'>
                    {!workDay && (
                      <button
                        type='button'
                        onClick={startWorkDay}
                        disabled={!canStartWorkDay}
                        className={cn(
                          'flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-full text-white transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-green-200',
                          canStartWorkDay
                            ? 'bg-[linear-gradient(145deg,#6bd730,#28ad22_54%,#128b2d)] shadow-[0_14px_26px_rgba(81,180,17,0.32),inset_0_3px_8px_rgba(255,255,255,0.42),inset_0_-8px_14px_rgba(5,92,36,0.26),0_0_0_9px_rgba(81,180,17,0.08)] ring-1 ring-green-700/30'
                            : 'cursor-not-allowed bg-[linear-gradient(145deg,#eef2f5,#cfd6dc_58%,#aeb7c0)] text-white shadow-[0_12px_22px_rgba(15,23,42,0.14),inset_0_3px_8px_rgba(255,255,255,0.55),inset_0_-7px_13px_rgba(71,85,105,0.18)] ring-1 ring-slate-300',
                        )}
                        title='Начать'
                      >
                        <Play className='ml-1 h-11 w-11 fill-current drop-shadow-[0_2px_4px_rgba(15,23,42,0.22)]' />
                      </button>
                    )}

                    {activeWorkDay && (
                      <button
                        type='button'
                        onClick={finishWorkDay}
                        disabled={isSaving}
                        className='flex h-[7.5rem] w-[7.5rem] flex-col items-center justify-center rounded-full bg-[linear-gradient(145deg,#465160,#17212b_58%,#0d141c)] text-white shadow-[0_14px_26px_rgba(15,23,42,0.32),inset_0_3px_8px_rgba(255,255,255,0.18),inset_0_-8px_14px_rgba(0,0,0,0.34)] ring-1 ring-slate-950/40 transition disabled:opacity-60'
                        title='Завершить'
                      >
                        <Power className='h-8 w-8 text-white/90' />
                        <span className='mt-2 text-xl font-extrabold tabular-nums'>{activeElapsedLabel}</span>
                        <span className='mt-0.5 text-xs font-extrabold text-primary'>Идёт</span>
                      </button>
                    )}

                    {isCompleted && (
                      <div className='flex h-[7.5rem] w-[7.5rem] items-center justify-center rounded-full bg-[linear-gradient(145deg,#a8e7b8,#55bc72_58%,#2d8b52)] text-white shadow-[0_13px_24px_rgba(45,139,82,0.26),inset_0_3px_8px_rgba(255,255,255,0.36),inset_0_-8px_14px_rgba(21,94,50,0.22)] ring-1 ring-green-700/20'>
                        <Check className='h-[3.25rem] w-[3.25rem] drop-shadow-[0_2px_4px_rgba(15,23,42,0.24)]' />
                      </div>
                    )}
                  </div>
                </div>

                {!workDay && (
                  <>
                    <p className={cn('mt-3 text-2xl font-extrabold leading-tight', canStartWorkDay ? 'text-slate-950' : 'text-slate-400')}>Начать</p>
                    <p className={cn('mt-1 text-sm font-medium leading-snug', selectedShift ? 'text-slate-500' : 'text-slate-400')}>
                      {selectedShift ? 'Рабочий день' : 'Сначала выберите смену'}
                    </p>
                  </>
                )}

                {activeWorkDay && (
                  <>
                    <p className='mt-3 text-2xl font-extrabold leading-tight text-slate-950'>Завершить</p>
                    <p className='mt-1 text-sm font-medium leading-snug text-slate-500'>Рабочий день</p>
                  </>
                )}

                {isCompleted && (
                  <>
                    <p className='mt-3 text-2xl font-extrabold leading-tight text-slate-950'>Завершён</p>
                    <p className='mt-1 text-sm font-medium leading-snug text-slate-500'>Рабочий день</p>
                    <p className='mt-1 text-xs font-bold leading-snug text-slate-500'>
                      {formatTime(workDay?.startedAt)}–{formatTime(workDay?.endedAt)} ({elapsedLabel})
                    </p>
                  </>
                )}
              </Card>

              <Card className='bg-slate-50 p-4'>
                <div className='mb-2.5 flex items-center justify-between gap-3'>
                  <h2 className='text-base font-extrabold text-slate-950'>Детали смены</h2>
                  <Badge className={cn('shrink-0 whitespace-nowrap px-2 py-0.5 text-[11px]', factTone(workDay?.status))}>
                    {factLabel(workDay?.status)}
                  </Badge>
                </div>
                <div className='grid grid-cols-2 gap-1.5'>
                  <DetailItem label='Смена' value={workDay ? workDay.shiftLabel : selectedShift ? shiftLabel(selectedShift) : 'не выбрана'} />
                  <DetailItem label='Начало' value={workDay ? formatTime(workDay.startedAt) : minutesToTime(shiftStart)} />
                  <DetailItem label='Окончание' value={workDay?.endedAt ? formatTime(workDay.endedAt) : minutesToTime(shiftEnd)} />
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
            <Card>
              <div className='mb-4 flex items-center gap-2'>
                <CalendarDays className='h-5 w-5 text-primary' />
                <div>
                  <h2 className='text-lg font-extrabold text-slate-950'>График</h2>
                  <p className='mt-1 text-sm font-medium text-slate-500'>Логика графика сохранена: можно отметить рабочие и выходные дни.</p>
                </div>
              </div>

              <div className='grid gap-3'>
                {visibleDates.map((date) => {
                  const ownEntry = ownScheduleByDate.get(date);
                  const colleagues = (departmentScheduleByDate.get(date) ?? [])
                    .filter((entry) => entry.userId !== user.id)
                    .sort((a, b) => (a.user?.name ?? '').localeCompare(b.user?.name ?? '', 'ru'));
                  return (
                    <div key={date} className='rounded-lg border border-slate-200 bg-white p-3'>
                      <div className='mb-3 flex items-center justify-between gap-3'>
                        <p className='font-extrabold text-slate-950'>{formatDateLabel(date)}</p>
                        <Badge className={scheduleTone(ownEntry?.status)}>Я: {scheduleLabel(ownEntry?.status)}</Badge>
                      </div>
                      <div className='grid grid-cols-2 gap-2'>
                        <Button
                          className={cn('h-10', ownEntry?.status !== 'working' && 'bg-slate-100 text-slate-700 shadow-none hover:bg-green-100 hover:text-green-800')}
                          onClick={() => updateSchedule(date, 'working')}
                          disabled={isSaving}
                        >
                          Работаю
                        </Button>
                        <Button
                          className={cn('h-10', ownEntry?.status === 'off' ? 'bg-slate-700 hover:bg-slate-800' : 'bg-slate-100 text-slate-700 shadow-none hover:bg-slate-200')}
                          onClick={() => updateSchedule(date, 'off')}
                          disabled={isSaving}
                        >
                          Выходной
                        </Button>
                      </div>
                      <div className='mt-3 border-t border-slate-100 pt-3'>
                        <p className='mb-2 text-xs font-extrabold uppercase text-slate-400'>Коллеги</p>
                        {colleagues.length ? (
                          <div className='flex flex-wrap gap-2'>
                            {colleagues.map((entry) => (
                              <span key={entry.id} className='rounded-full bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700 ring-1 ring-slate-200'>
                                {entry.user?.name}: {scheduleLabel(entry.status)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className='text-sm font-medium text-slate-400'>Нет заполненных дней коллег.</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button className='mt-4 w-full gap-2 bg-slate-100 text-slate-800 shadow-none hover:bg-slate-200' onClick={() => setShowFullSchedule((current) => !current)}>
                {showFullSchedule ? <ChevronUp className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                {showFullSchedule ? 'Свернуть график' : 'Открыть полный график месяца'}
              </Button>
            </Card>
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

        <nav className='fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] border-t border-slate-200 bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_34px_rgba(15,23,42,0.12)] backdrop-blur md:bottom-6'>
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
