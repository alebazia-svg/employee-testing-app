'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

export default function CreateAttestation() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [passingScore, setPassingScore] = useState(80);
  const [status, setStatus] = useState('DRAFT');
  const [type, setType] = useState('PRACTICE');

  async function save() {
    const response = await fetch('/api/admin/attestations', {
      method: 'POST',
      body: JSON.stringify({ title, passingScore, status, type }),
    });
    const attestation = await response.json();

    setOpen(false);
    router.push(`/admin/attestations/${attestation.id}`);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Создать аттестацию</Button>
      <Dialog open={open}>
        <h3 className='mb-3 text-lg font-semibold text-slate-900'>Новая аттестация</h3>
        <div className='space-y-3'>
          <Input placeholder='Название аттестации' value={title} onChange={(event) => setTitle(event.target.value)} />
          <label className='block text-sm font-medium text-slate-700'>
            Проходной балл
            <Input className='mt-1' type='number' min={0} max={100} value={passingScore} onChange={(event) => setPassingScore(Number(event.target.value))} />
          </label>
          <div className='grid gap-3 md:grid-cols-2'>
            <label className='block text-sm font-medium text-slate-700'>
              Статус
              <select className='mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm' value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value='DRAFT'>Черновик</option>
                <option value='ACTIVE'>Активна</option>
              </select>
            </label>
            <label className='block text-sm font-medium text-slate-700'>
              Тип
              <select className='mt-1 w-full rounded-lg border border-border bg-white px-3 py-2.5 text-sm' value={type} onChange={(event) => setType(event.target.value)}>
                <option value='PRACTICE'>Пробная</option>
                <option value='CONTROL'>Контрольная</option>
              </select>
            </label>
          </div>
          <div className='flex gap-2'>
            <Button disabled={!title.trim()} onClick={save}>Сохранить</Button>
            <Button className='bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-800' onClick={() => setOpen(false)}>Отмена</Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
