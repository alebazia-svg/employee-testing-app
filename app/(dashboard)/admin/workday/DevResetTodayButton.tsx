'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function DevResetTodayButton({ userId, userName, date }: { userId: number; userName: string; date: string }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function resetSelectedDate() {
    const confirmed = window.confirm(
      `Dev/Test: сбросить рабочий день и задачи сотрудника ${userName} за ${date}? История других дней не будет затронута.`,
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/workday/dev-reset-today', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось сбросить день');
      window.alert(
        `${payload.message || 'Сброс выполнен'}\nWorkDayEntry: ${payload.deletedWorkDays ?? 0}\nShiftControlRun: ${payload.deletedRuns ?? 0}\nShiftControlTask: ${payload.deletedTasks ?? 0}`,
      );
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось сбросить день');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Button
      type='button'
      className='h-8 whitespace-nowrap bg-red-50 px-2.5 text-[11px] font-extrabold text-red-700 shadow-none ring-1 ring-red-200 hover:bg-red-100'
      onClick={resetSelectedDate}
      disabled={isSaving}
      title={`Dev/Test: удалить workday и связанные задачи контроля смены за ${date}`}
    >
      Dev/Test: сбросить
    </Button>
  );
}
