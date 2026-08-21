'use client';

import QRCode from 'qrcode';
import { Download, Maximize2, Printer, QrCode, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const workdayQrCodes = [
  {
    id: 'retail',
    title: 'Розница',
    description: 'QR для старта рабочего дня сотрудников розницы.',
    printFile: '/print/offonika-workday-retail-a5.pdf',
    value: 'offonika-workday-start:retail',
  },
  {
    id: 'wholesale',
    title: 'Опт',
    description: 'QR для старта рабочего дня сотрудников опта.',
    printFile: '/print/offonika-workday-wholesale-a5.pdf',
    value: 'offonika-workday-start:wholesale',
  },
] as const;

type WorkdayQrCode = (typeof workdayQrCodes)[number];

export function WorkdayQrCodes() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [activeQr, setActiveQr] = useState<WorkdayQrCode | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function buildQrImages() {
      const entries = await Promise.all(
        workdayQrCodes.map(async (item) => {
          const dataUrl = await QRCode.toDataURL(item.value, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 320,
            color: {
              dark: '#111827',
              light: '#ffffff',
            },
          });
          return [item.id, dataUrl] as const;
        }),
      );
      if (!cancelled) setImages(Object.fromEntries(entries));
    }

    buildQrImages().catch(() => {
      if (!cancelled) setImages({});
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function printQr(item: WorkdayQrCode) {
    window.open(item.printFile, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      <button
        type='button'
        onClick={() => setExpanded(true)}
        className='inline-flex min-h-10 items-center gap-2 rounded-lg bg-white px-3 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50'
      >
        <QrCode className='h-4 w-4 text-green-700' />
        QR-коды отделов
      </button>

      {expanded ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm' onClick={() => setExpanded(false)}>
          <div className='max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl' onClick={(event) => event.stopPropagation()}>
            <div className='flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4'>
              <div className='flex items-start gap-3'>
                <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700'>
                  <QrCode className='h-5 w-5' />
                </span>
                <div>
                  <h2 className='text-lg font-extrabold text-slate-950'>QR-коды рабочего дня</h2>
                  <p className='mt-1 text-sm font-medium text-slate-500'>
                    Распечатайте QR и разместите его на рабочем месте. Сотрудник сканирует код перед началом дня.
                  </p>
                </div>
              </div>
              <button
                type='button'
                onClick={() => setExpanded(false)}
                className='flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 transition hover:bg-slate-200'
                aria-label='Закрыть QR-коды'
              >
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='grid gap-4 p-5 md:grid-cols-2'>
              {workdayQrCodes.map((item) => {
                const image = images[item.id];
                return (
                  <div key={item.id} className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
                    <div>
                      <p className='text-base font-extrabold text-slate-950'>{item.title}</p>
                      <p className='mt-1 text-sm font-medium text-slate-500'>{item.description}</p>
                    </div>

                    <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center'>
                      <button
                        type='button'
                        onClick={() => setActiveQr(item)}
                        className='flex h-28 w-28 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 transition hover:ring-green-300'
                      >
                        {image ? <img src={image} alt={`QR ${item.title}`} className='h-24 w-24' /> : <QrCode className='h-12 w-12 text-slate-300' />}
                      </button>
                      <div className='grid flex-1 gap-2'>
                        <button
                          type='button'
                          onClick={() => setActiveQr(item)}
                          className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                        >
                          <Maximize2 className='h-4 w-4' />
                          Открыть крупно
                        </button>
                        <a
                          href={image || '#'}
                          download={`offonika-workday-${item.id}-qr.png`}
                          className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-white px-3 text-sm font-extrabold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                        >
                          <Download className='h-4 w-4' />
                          Скачать только QR
                        </a>
                        <button
                          type='button'
                          onClick={() => printQr(item)}
                          className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-extrabold text-white hover:bg-green-700'
                        >
                          <Printer className='h-4 w-4' />
                          Печать / PDF
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {activeQr && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm'>
          <div className='w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <p className='text-sm font-black uppercase tracking-wide text-green-700'>QR рабочего дня</p>
                <h3 className='mt-1 text-2xl font-black text-slate-950'>{activeQr.title}</h3>
              </div>
              <button type='button' onClick={() => setActiveQr(null)} className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700'>
                <X className='h-5 w-5' />
              </button>
            </div>

            <div className='mt-5 flex flex-col items-center gap-4'>
              {images[activeQr.id] ? <img src={images[activeQr.id]} alt={`QR ${activeQr.title}`} className='h-72 w-72' /> : <QrCode className='h-24 w-24 text-slate-300' />}
              <p className='rounded-xl bg-green-50 px-4 py-3 text-center text-sm font-bold leading-relaxed text-green-900 ring-1 ring-green-100'>Перед началом смены откройте портал и отсканируйте этот QR-код.</p>
              <div className='grid w-full gap-2 sm:grid-cols-2'>
                <a
                  href={images[activeQr.id] || '#'}
                  download={`offonika-workday-${activeQr.id}-qr.png`}
                  className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-extrabold text-slate-800 hover:bg-slate-200'
                >
                  <Download className='h-4 w-4' />
                  Скачать только QR
                </a>
                <button type='button' onClick={() => printQr(activeQr)} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-extrabold text-white hover:bg-green-700'>
                  <Printer className='h-4 w-4' />
                  Печать / PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
