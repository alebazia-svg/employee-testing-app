'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ChangeEvent } from 'react';
import { Camera, X } from 'lucide-react';
import { decodeWorkdayQrPhoto } from '@/lib/workday-qr-photo';

export type WorkdayQrPhotoHandle = { openCamera: () => void };

export const WorkdayQrPhotoScanner = forwardRef<WorkdayQrPhotoHandle, {
  open: boolean;
  userDepartment: string;
  onCancel: () => void;
  onAccepted: (result: { department: string; qrPayload: string }) => void;
}>(function WorkdayQrPhotoScanner({ open, userDepartment, onCancel, onAccepted }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => { attemptRef.current += 1; }, []);

  function openCamera() {
    setError('');
    inputRef.current?.click();
  }

  // Called synchronously from the original start-button gesture: iOS may block
  // a file chooser opened later from an effect or after an awaited request.
  useImperativeHandle(ref, () => ({ openCamera }));

  function close() {
    attemptRef.current += 1;
    setBusy(false);
    setError('');
    onCancel();
  }


  async function readPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || !open) return;
    const attempt = ++attemptRef.current;
    setBusy(true);
    setError('');
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (attempt !== attemptRef.current) return;
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Не удалось обработать фото. Попробуйте ещё раз.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = decodeWorkdayQrPhoto(pixels.data, pixels.width, pixels.height, userDepartment);
      if (attempt === attemptRef.current) onAccepted(result);
    } catch (reason) {
      if (attempt === attemptRef.current) {
        setError(reason instanceof Error && !(reason instanceof DOMException)
          ? reason.message : 'Не удалось прочитать фото. Сфотографируйте QR ещё раз.');
      }
    } finally {
      URL.revokeObjectURL(url);
      if (attempt === attemptRef.current) setBusy(false);
    }
  }

  return (
    <>
      <input ref={inputRef} type='file' accept='image/*' capture='environment' className='hidden' onChange={(event) => void readPhoto(event)} />
      {open && <div className='employee-material-scanner fixed inset-0 z-50 overflow-y-auto bg-slate-950 text-white' role='dialog' aria-modal='true' aria-labelledby='qr-photo-title'>
        <div className='mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] pb-[calc(1.25rem+env(safe-area-inset-bottom))]'>
          <div className='mb-6 flex items-start justify-between gap-3'>
            <div>
              <p className='text-xs font-black uppercase tracking-[0.22em] text-green-300'>Начало дня</p>
              <h2 id='qr-photo-title' className='mt-1 text-2xl font-black leading-tight'>{busy ? 'Считываем QR…' : 'Фото QR-кода'}</h2>
            </div>
            <button type='button' onClick={close} className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10' aria-label='Закрыть сканер'><X className='h-6 w-6' /></button>
          </div>
          <div className='my-auto rounded-3xl bg-white/10 p-6'>
            <Camera className='mb-5 h-12 w-12 text-green-300' aria-hidden='true' />
            {busy ? <p role='status' className='text-base font-bold'>Считываем QR…</p> : <>
              <p className='text-sm leading-relaxed text-slate-200'>Снимите QR целиком и подтвердите фото.</p>
              <button type='button' onClick={openCamera} className='employee-material-green-action mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-green-700 px-4 py-3 text-base font-bold text-white'>Открыть камеру</button>
            </>}
            {error && <p role='alert' className='mt-4 text-sm font-semibold text-amber-200'>{error}</p>}
          </div>
        </div>
      </div>}
    </>
  );
});
