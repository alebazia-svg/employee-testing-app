'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

const decisions = [
  { key: 'normal', label: 'Всё верно' },
  { key: 'clarification_required', label: 'Уточнение действительно нужно' },
  { key: 'hint_unnecessary', label: 'Уточнение не требуется' },
  { key: 'rule_change_required', label: 'Нужно изменить правило' },
] as const;

export function ExpenseRequestFeedbackClient({ caseId, reasonCodes }: { caseId: string; reasonCodes: string[] }) {
  const router = useRouter();
  const [decision, setDecision] = useState('');
  const [comment, setComment] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(scope: 'overall' | 'reason') {
    setError('');
    if (!decision) { setError('Выберите решение.'); return; }
    if (decision === 'rule_change_required' && !comment.trim()) { setError('Опишите, как нужно изменить правило.'); return; }
    if (scope === 'reason' && !reasonCode) { setError('Выберите конкретную подсказку.'); return; }
    setSaving(true);
    const response = await fetch(`/api/admin/expense-requests/${encodeURIComponent(caseId)}/feedback`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope, decision, reasonCode: scope === 'reason' ? reasonCode : null, comment }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    setSaving(false);
    if (!response?.ok) { setError(payload?.error || 'Не удалось сохранить вывод.'); return; }
    setDecision(''); setComment(''); setReasonCode(''); setDetailOpen(false); router.refresh();
  }

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-sm font-extrabold text-slate-950'>Оценка автоматической подсказки</p>
        <p className='mt-1 text-xs font-medium text-slate-500'>Оценка помогает улучшать правила проверки. Статус заявки в 1С не изменится.</p>
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {decisions.map((item) => (
          <button key={item.key} type='button' onClick={() => setDecision(item.key)} className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${decision === item.key ? 'border-green-600 bg-green-50 text-green-900 ring-2 ring-green-100' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
            {item.label}
          </button>
        ))}
      </div>
      {decision === 'rule_change_required' && (
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={3} placeholder='Как именно нужно изменить правило?' className='w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-green-600 focus:ring-2 focus:ring-green-100' />
      )}
      <Button type='button' disabled={saving} onClick={() => void save('overall')}>{saving ? 'Сохраняем…' : 'Сохранить оценку'}</Button>
      {reasonCodes.length > 0 && (
        <div className='border-t border-slate-200 pt-4'>
          <button type='button' onClick={() => setDetailOpen((value) => !value)} className='text-sm font-bold text-green-700 hover:text-green-800'>
            {detailOpen ? 'Скрыть детализацию' : 'При желании уточнить конкретную подсказку'}
          </button>
          {detailOpen && (
            <div className='mt-3 space-y-3 rounded-xl bg-slate-50 p-4'>
              <select value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} className='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm'>
                <option value=''>Выберите подсказку</option>
                {reasonCodes.map((code) => <option key={code} value={code}>{code}</option>)}
              </select>
              {decision !== 'rule_change_required' && <textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={1000} rows={2} placeholder='Комментарий необязателен' className='w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm' />}
              <Button type='button' className='bg-slate-800 hover:bg-slate-900' disabled={saving} onClick={() => void save('reason')}>Сохранить детализацию</Button>
            </div>
          )}
        </div>
      )}
      {error && <p className='text-sm font-bold text-red-700'>{error}</p>}
    </div>
  );
}
