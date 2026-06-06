'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function DevMakeShiftTasksAvailableButton({
  userId,
  userName,
  date,
  disabled,
}: {
  userId: number;
  userName: string;
  date: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);

  async function makeAvailable() {
    const confirmed = window.confirm(
      `Dev/Test: сделать невыполненные задачи контроля смены сотрудника ${userName} за ${date} доступными сейчас? Шаблоны не изменятся.`,
    );
    if (!confirmed) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/workday/dev-make-shift-tasks-available', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось обновить задачи');
      window.alert(payload.message || `Обновлено задач: ${payload.updatedTasks ?? 0}`);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось обновить задачи');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Button
      type='button'
      className='h-8 whitespace-nowrap bg-amber-50 px-2.5 text-[11px] font-extrabold text-amber-800 shadow-none ring-1 ring-amber-200 hover:bg-amber-100'
      onClick={makeAvailable}
      disabled={disabled || isSaving}
      title={`Dev/Test: сдвинуть plannedTimeMinutes невыполненных задач за ${date}`}
    >
      Dev/Test: сделать задачи доступными
    </Button>
  );
}
