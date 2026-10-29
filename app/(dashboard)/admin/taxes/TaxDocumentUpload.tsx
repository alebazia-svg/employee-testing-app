'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Upload } from 'lucide-react';
import { taxDocumentTypes } from '@/lib/tax-document-types';

const monthLabel = (key: string) => { const text = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)).replace(/ г\.$/, ''); return text.charAt(0).toUpperCase() + text.slice(1); };
function monthsUpTo(last: string) {
  if (!/^20\d{2}-\d{2}$/.test(last)) return [];
  const result: string[] = [];
  for (let [year, month] = [2026, 4]; `${year}-${String(month).padStart(2, '0')}` <= last; month === 12 ? (year += 1, month = 1) : (month += 1)) result.push(`${year}-${String(month).padStart(2, '0')}`);
  return result.reverse();
}

export function TaxDocumentUpload({ defaultPeriod, latestDuePeriod = defaultPeriod, defaultDocumentType = 'USN_DECLARATION', fixedType }: { defaultPeriod: string; latestDuePeriod?: string; defaultDocumentType?: keyof typeof taxDocumentTypes; fixedType?: keyof typeof taxDocumentTypes }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [changes, setChanges] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<keyof typeof taxDocumentTypes>(defaultDocumentType);
  const [period, setPeriod] = useState(defaultDocumentType === 'AUSN_CALCULATION' ? latestDuePeriod : defaultPeriod);

  // Excel «Доходы АУСН» and the ENS ZIP carry their own months: the server reads
  // the coverage from the file, so the user is not asked for a period.
  const autoPeriod = documentType === 'AUSN_INCOME' || documentType === 'ENS_OPERATIONS';
  const periodOptions = monthsUpTo(latestDuePeriod > defaultPeriod ? latestDuePeriod : defaultPeriod);
  function selectDocumentType(value: string) {
    setDocumentType(value as keyof typeof taxDocumentTypes);
    if (value === 'USN_DECLARATION') setPeriod('2026-03');
    else if (value === 'AUSN_TRANSITION_NOTICE') setPeriod('2026-04');
    else if (value === 'AUSN_CALCULATION') setPeriod(latestDuePeriod);
    else setPeriod(defaultPeriod);
  }

  async function submit(form: FormData) {
    setBusy(true); setMessage(''); setChanges([]);
    try {
      const response = await fetch('/api/admin/taxes/documents', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить документ.');
      const range = payload.coverage?.coverageFrom === payload.coverage?.coverageTo ? payload.coverage?.coverageTo : `${payload.coverage?.coverageFrom}–${payload.coverage?.coverageTo}`;
      setMessage(`${payload.processing?.message || 'Документ сохранён в архиве.'} Покрытие: ${range}. ${payload.coverage?.note || ''}`);
      setChanges(Array.isArray(payload.changes) ? payload.changes.filter((item: unknown): item is string => typeof item === 'string') : []);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось загрузить документ.'); }
    finally { setBusy(false); }
  }

  return <form action={submit} className={`grid gap-3 lg:items-end ${fixedType ? 'lg:grid-cols-[180px_1.3fr_auto]' : 'lg:grid-cols-[1.2fr_180px_1.3fr_auto]'}`}>
    {fixedType ? <input type='hidden' name='documentType' value={fixedType} /> : <>
    <label className='text-[13px] font-semibold text-[#4c443c]'>Тип документа
      <select name='documentType' defaultValue={defaultDocumentType} onChange={(event) => selectDocumentType(event.target.value)} className='mt-1.5 h-10 w-full rounded-lg border border-[#d8d1c6] bg-white px-3 font-semibold text-slate-900' required>
        {Object.entries(taxDocumentTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
    </label>
    </>}
    {autoPeriod ? <><input type='hidden' name='periodKey' value={period} /><p className='self-center text-[13px] text-[#796e64]'>Месяцы — автоматически по файлу</p></> : /^20\d{2}-\d{2}$/.test(period) && periodOptions.includes(period) ? <label className='text-[13px] font-semibold text-[#4c443c]'>{documentType === 'AUSN_CALCULATION' ? 'Последний месяц в справке' : 'За какой месяц'}
      <select name='periodKey' value={period} onChange={(event) => setPeriod(event.target.value)} className='mt-1.5 h-10 w-full rounded-lg border border-[#d8d1c6] bg-white px-3 font-semibold text-slate-900' required>{periodOptions.map((key) => <option key={key} value={key}>{monthLabel(key)}</option>)}</select>
    </label> : <label className='text-[13px] font-semibold text-[#4c443c]'>Период (год или ГГГГ-ММ)
      <input name='periodKey' value={period} onChange={(event) => setPeriod(event.target.value)} pattern='20\d{2}(-\d{2})?' className='mt-1.5 h-10 w-full rounded-lg border border-[#d8d1c6] bg-white px-3 font-semibold text-slate-900' required />
    </label>}
    <label className='text-[13px] font-semibold text-[#4c443c]'>Файл
      <input ref={fileRef} name='file' type='file' accept='.pdf,.xls,.xlsx,.zip,.xml,.csv,text/csv,application/pdf,application/xml,application/zip' className='mt-1.5 block h-10 w-full rounded-lg border border-[#d8d1c6] bg-white px-3 py-2 text-sm' required />
    </label>
    <button disabled={busy} className='inline-flex h-10 items-center justify-center gap-2 admin-material-primary rounded-lg px-5 text-[13px] font-semibold text-white disabled:opacity-50'><Upload className='h-4 w-4' />{busy ? 'Загрузка…' : 'Загрузить'}</button>
    {!autoPeriod && documentType === 'AUSN_CALCULATION' && <p className='text-xs leading-relaxed text-[#796e64] col-span-full'>Выберите самый поздний месяц, который есть в справке. Повторная загрузка той же справки просто расширит период.</p>}
    {busy && <p className='text-sm font-semibold text-slate-600 col-span-full'>Сервер пересчитывает АУСН с новым документом — это может занять несколько минут. Не закрывайте страницу.</p>}
    {changes.length > 0 && <UploadChanges changes={changes} />}
    {message && <p className={`text-sm font-semibold col-span-full ${message.includes('не обновился') || message.includes('не подключена') || message.includes('нужна выгрузка') ? 'text-amber-700' : 'text-green-700'}`}>{message}</p>}
  </form>;
}

export function UploadChanges({ changes, title = 'Что изменилось после загрузки' }: { changes: string[]; title?: string }) {
  return <div className='tax-callout col-span-full' data-tone='ok'><p><strong>{title}</strong></p><ul className='mt-1 space-y-1'>{changes.map((change, index) => <li key={index}>• {change}</li>)}</ul></div>;
}
