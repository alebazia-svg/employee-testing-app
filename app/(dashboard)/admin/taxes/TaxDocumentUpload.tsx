'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { taxDocumentTypes } from '@/lib/tax-document-types';

export function TaxDocumentUpload({ defaultPeriod }: { defaultPeriod: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(form: FormData) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/taxes/documents', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить документ.');
      setMessage('Документ сохранён. Он появился в журнале и доступен для серверной сверки.');
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить документ.'); }
    finally { setBusy(false); }
  }

  return <form action={submit} className='grid gap-3 lg:grid-cols-[1.2fr_180px_1.3fr_auto] lg:items-end'>
    <label className='text-sm font-bold text-slate-700'>Тип документа
      <select name='documentType' className='mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-900' required>
        {Object.entries(taxDocumentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    <label className='text-sm font-bold text-slate-700'>Период
      <input name='periodKey' defaultValue={defaultPeriod} pattern='20\d{2}(-\d{2})?' className='mt-1.5 h-11 w-full rounded-xl border border-slate-300 bg-white px-3 font-semibold text-slate-900' required />
    </label>
    <label className='text-sm font-bold text-slate-700'>Файл PDF, XLSX, XML или CSV
      <input ref={fileRef} name='file' type='file' accept='.pdf,.xlsx,.xml,.csv,text/csv,application/pdf,application/xml' className='mt-1.5 block h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm' required />
    </label>
    <button disabled={busy} className='inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 text-sm font-extrabold text-white disabled:opacity-50'><Upload className='h-4 w-4' />{busy ? 'Загрузка…' : 'Загрузить'}</button>
    {message && <p className={`text-sm font-semibold lg:col-span-4 ${message.startsWith('Документ сохранён') ? 'text-green-700' : 'text-red-700'}`}>{message}</p>}
  </form>;
}
