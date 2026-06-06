'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const shiftsByDepartment: Record<string, Array<{ code: string; label: string }>> = {
  retail: [
    { code: '09_18', label: 'Retail 09–18' },
    { code: '11_20', label: 'Retail 11–20' },
  ],
  wholesale: [
    { code: '09_18', label: 'Wholesale 09–18' },
    { code: '10_19', label: 'Wholesale 10–19' },
    { code: '09_19', label: 'Wholesale 09–19' },
  ],
};

export function DevCreateTestShiftButtons({
  userId,
  userName,
  department,
  date,
  disabled,
}: {
  userId: number;
  userName: string;
  department: string;
  date: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [savingShiftCode, setSavingShiftCode] = useState<string | null>(null);
  const shifts = shiftsByDepartment[department] ?? [];

  if (!shifts.length) return null;

  async function createShift(shiftCode: string, label: string) {
    const confirmed = window.confirm(
      `Dev/Test: создать тестовую смену ${label} для ${userName} за ${date}? Если день уже есть, сначала используйте "Сброс смены".`,
    );
    if (!confirmed) return;

    setSavingShiftCode(shiftCode);
    try {
      const response = await fetch('/api/admin/workday/dev-create-test-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, date, shiftCode }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось создать тестовую смену');
      window.alert(payload.message || 'Dev/Test: смена создана');
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось создать тестовую смену');
    } finally {
      setSavingShiftCode(null);
    }
  }

  return (
    <div className='grid gap-1.5'>
      {shifts.map((shift) => (
        <Button
          key={shift.code}
          type='button'
          className='h-8 whitespace-nowrap bg-blue-50 px-2.5 text-[11px] font-extrabold text-blue-800 shadow-none ring-1 ring-blue-200 hover:bg-blue-100'
          onClick={() => createShift(shift.code, shift.label)}
          disabled={disabled || savingShiftCode !== null}
          title={`Dev/Test: создать тестовую смену ${shift.label} за ${date}`}
        >
          {savingShiftCode === shift.code ? 'Создаём...' : `Dev/Test: ${shift.label}`}
        </Button>
      ))}
    </div>
  );
}
