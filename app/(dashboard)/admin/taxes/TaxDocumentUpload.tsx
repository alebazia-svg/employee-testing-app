'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Upload, XCircle } from 'lucide-react';
import { taxDocumentTypes } from '@/lib/tax-document-types';

const monthLabel = (key: string) => { const text = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}-01T12:00:00Z`)).replace(/ г\.$/, ''); return text.charAt(0).toUpperCase() + text.slice(1); };
function monthsUpTo(last: string) {
  if (!/^20\d{2}-\d{2}$/.test(last)) return [];
  const result: string[] = [];
  for (let [year, month] = [2026, 4]; `${year}-${String(month).padStart(2, '0')}` <= last; month === 12 ? (year += 1, month = 1) : (month += 1)) result.push(`${year}-${String(month).padStart(2, '0')}`);
  return result.reverse();
}

// One upload status for the whole page. The form that started an upload may
// disappear after a refresh (the file closes its own «Что загрузить» item), so
// the status lives here and TaxUploadStatus shows it in a fixed place.
type UploadStatus = { progress: '' | 'sending' | 'processing' | 'done' | 'failed'; fileName: string; message: string; changes: string[]; owner: string; ownerVisible: boolean };
const idle: UploadStatus = { progress: '', fileName: '', message: '', changes: [], owner: '', ownerVisible: false };
let uploadStatus = idle;
const listeners = new Set<() => void>();
function setUploadStatus(next: Partial<UploadStatus>) { uploadStatus = { ...uploadStatus, ...next }; listeners.forEach((listener) => listener()); }
function subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
const useUploadStatus = () => useSyncExternalStore(subscribe, () => uploadStatus, () => idle);

async function followProcessing(id: string, since: string, refresh: () => void) {
  const started = Date.now();
  while (Date.now() - started < 25 * 60_000) {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    const response = await fetch(`/api/admin/taxes/documents/status?id=${encodeURIComponent(id)}&since=${encodeURIComponent(since)}`, { cache: 'no-store' }).catch(() => null);
    if (!response?.ok) continue;
    const payload = await response.json().catch(() => ({}));
    if (payload.state === 'done') {
      setUploadStatus({ progress: 'done', message: 'Файл учтён, цифры и сверка пересчитаны.', changes: Array.isArray(payload.changes) ? payload.changes.filter((item: unknown): item is string => typeof item === 'string') : [] });
      refresh();
      return;
    }
    if (payload.state === 'failed') {
      setUploadStatus({ progress: 'failed', message: payload.message || 'Сервер не смог обработать файл. Загрузите его ещё раз.' });
      refresh();
      return;
    }
  }
  setUploadStatus({ progress: 'failed', message: 'Пересчёт идёт дольше обычного. Результат появится в «Истории загрузок»; если там будет «Не обработан» — загрузите файл ещё раз.' });
}

// placement='page' is the fallback spot at the top of «Документы»; it stays
// empty while the form that started the upload is still on screen.
export function TaxUploadStatus({ placement = 'form' }: { placement?: 'form' | 'page' }) {
  const status = useUploadStatus();
  if (!status.progress || status.progress === 'sending') return null;
  if (placement === 'page' && status.ownerVisible) return null;
  const tone = status.progress === 'failed' ? 'error' : 'ok';
  const Icon = status.progress === 'processing' ? Loader2 : status.progress === 'failed' ? XCircle : CheckCircle2;
  const title = status.progress === 'processing' ? 'Файл принят' : status.progress === 'failed' ? 'Файл не обработан' : 'Готово';
  return <div className='tax-callout' data-tone={tone} role='status' aria-live='polite'>
    <p className='flex items-start gap-2'><Icon className={`mt-0.5 h-4 w-4 shrink-0 ${status.progress === 'processing' ? 'animate-spin' : ''}`} /><span><strong>{title}{status.fileName ? `: «${status.fileName}»` : ''}.</strong> {status.progress === 'processing' ? 'Пересчитываем цифры и сверку — обычно 3–5 минут. Страницу можно закрыть: результат будет в «Истории загрузок».' : status.message}</span></p>
    {status.changes.length > 0 && <ul className='mt-1 space-y-1 pl-6'>{status.changes.map((change, index) => <li key={index}>• {change}</li>)}</ul>}
  </div>;
}

export function TaxDocumentUpload({ defaultPeriod, latestDuePeriod = defaultPeriod, defaultDocumentType = 'USN_DECLARATION', fixedType }: { defaultPeriod: string; latestDuePeriod?: string; defaultDocumentType?: keyof typeof taxDocumentTypes; fixedType?: keyof typeof taxDocumentTypes }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const status = useUploadStatus();
  const [error, setError] = useState('');
  const [formId] = useState(() => Math.random().toString(36).slice(2));
  const mine = status.owner === formId;
  useEffect(() => {
    if (!mine) return;
    setUploadStatus({ ownerVisible: true });
    return () => { if (uploadStatus.owner === formId) setUploadStatus({ ownerVisible: false }); };
  }, [mine, formId]);
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

  const busy = mine && (status.progress === 'sending' || status.progress === 'processing');

  async function submit(form: FormData) {
    const file = form.get('file');
    setError('');
    setUploadStatus({ progress: 'sending', fileName: file instanceof File ? file.name : '', message: '', changes: [], owner: formId });
    try {
      const response = await fetch('/api/admin/taxes/documents', { method: 'POST', body: form });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Не удалось загрузить документ.');
      if (fileRef.current) fileRef.current.value = '';
      if (payload.accepted && payload.document?.id) {
        setUploadStatus({ progress: 'processing' });
        router.refresh();
        void followProcessing(payload.document.id, payload.acceptedAt, () => router.refresh());
        return;
      }
      setUploadStatus({ progress: 'done', message: 'Документ сохранён в архиве.' });
      router.refresh();
    } catch (failure) {
      setUploadStatus({ ...idle });
      setError(failure instanceof Error ? failure.message : 'Не удалось загрузить документ.');
    }
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
    <button disabled={busy} className='inline-flex h-10 items-center justify-center gap-2 admin-material-primary rounded-lg px-5 text-[13px] font-semibold text-white disabled:opacity-50'><Upload className='h-4 w-4' />{busy && status.progress === 'sending' ? 'Отправляем…' : busy ? 'Пересчитываем…' : 'Загрузить'}</button>
    {!autoPeriod && documentType === 'AUSN_CALCULATION' && <p className='text-xs leading-relaxed text-[#796e64] col-span-full'>Выберите самый поздний месяц, который есть в справке. Повторная загрузка той же справки просто расширит период.</p>}
    {mine && status.progress === 'sending' && <p role='status' className='col-span-full text-sm font-semibold text-[#796e64]'>Отправляем файл…</p>}
    {mine && <div className='col-span-full'><TaxUploadStatus /></div>}
    {error && <p role='alert' className='col-span-full text-sm font-semibold text-[#a3342d]'>{error}</p>}
  </form>;
}

export function UploadChanges({ changes, title = 'Что изменилось после загрузки' }: { changes: string[]; title?: string }) {
  return <div className='tax-callout col-span-full' data-tone='ok'><p><strong>{title}</strong></p><ul className='mt-1 space-y-1'>{changes.map((change, index) => <li key={index}>• {change}</li>)}</ul></div>;
}
