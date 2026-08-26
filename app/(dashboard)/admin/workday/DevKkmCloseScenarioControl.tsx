'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const scenarios = [
  ['confirmed', 'Успешно сразу'],
  ['delayed', 'Чек через 45 секунд'],
  ['one_c_open', 'Касса не закрыта'],
  ['ofd_missing', 'Чек закрытия не найден'],
  ['one_c_unavailable', 'Нет связи с 1С'],
  ['ofd_unavailable', 'Нет связи с проверкой чеков'],
] as const;

export function DevKkmCloseScenarioControl({ taskId, initialScenario }: { taskId: number; initialScenario: string | null }) {
  const router = useRouter();
  const [scenario, setScenario] = useState(initialScenario ?? 'confirmed');
  const [saving, setSaving] = useState(false);

  async function applyScenario() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/workday/dev-kkm-close-scenario', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, scenario }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Не удалось установить сценарий');
      window.alert(payload.message);
      router.refresh();
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Не удалось установить сценарий');
    } finally {
      setSaving(false);
    }
  }

  return <div className='grid gap-1.5 rounded-lg bg-violet-50 p-2 ring-1 ring-violet-200'>
    <p className='text-[10px] font-black uppercase tracking-wide text-violet-800'>Dev/Test · закрытие кассы</p>
    <p className='text-[10px] font-bold text-violet-700'>Активно: {scenarios.find(([value]) => value === initialScenario)?.[1] ?? 'сценарий не установлен'}</p>
    <select value={scenario} onChange={(event) => setScenario(event.target.value)} className='h-8 rounded-md border border-violet-200 bg-white px-2 text-[11px] font-bold text-slate-800'>{scenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
    <button type='button' disabled={saving} onClick={applyScenario} className='h-8 rounded-md bg-violet-700 px-2 text-[11px] font-extrabold text-white disabled:opacity-60'>{saving ? 'Устанавливаем…' : 'Применить сценарий'}</button>
  </div>;
}
