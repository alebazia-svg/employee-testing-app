'use client';

import QRCode from 'qrcode';
import { Download, Maximize2, Printer, QrCode, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';

const workdayQrCodes = [
  {
    id: 'retail',
    title: 'Розница',
    description: 'QR для старта рабочего дня сотрудников розницы.',
    value: 'offonika-workday-start:retail',
  },
  {
    id: 'wholesale',
    title: 'Опт',
    description: 'QR для старта рабочего дня сотрудников опта.',
    value: 'offonika-workday-start:wholesale',
  },
] as const;

type WorkdayQrCode = (typeof workdayQrCodes)[number];

export function WorkdayQrCodes() {
  const [images, setImages] = useState<Record<string, string>>({});
  const [activeQr, setActiveQr] = useState<WorkdayQrCode | null>(null);

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
    const image = images[item.id];
    if (!image) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>QR рабочего дня - ${item.title}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 32px; color: #111827; text-align: center; }
            h1 { font-size: 32px; margin: 0 0 8px; }
            p { font-size: 18px; margin: 0 0 24px; color: #475569; }
            img { width: 360px; height: 360px; }
            code { display: inline-block; margin-top: 20px; padding: 10px 14px; border: 1px solid #cbd5e1; border-radius: 10px; font-size: 14px; }
          </style>
        </head>
        <body>
          <h1>OFFONIKA · ${item.title}</h1>
          <p>QR для начала рабочего дня</p>
          <img src="${image}" alt="QR ${item.title}" />
          <br />
          <code>${item.value}</code>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <>
      <Card className='p-0'>
        <div className='flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex items-start gap-3'>
            <span className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700'>
              <QrCode className='h-5 w-5' />
            </span>
            <div>
              <h2 className='text-lg font-extrabold text-slate-950'>QR рабочего дня</h2>
              <p className='mt-1 text-sm font-medium text-slate-500'>
                Распечатайте QR и разместите его на рабочем месте. Сотрудник сканирует QR из приложения перед стартом дня.
              </p>
            </div>
          </div>
          <span className='w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-extrabold text-slate-600'>
            MVP: розница и опт
          </span>
        </div>

        <div className='grid gap-4 p-5 md:grid-cols-2'>
          {workdayQrCodes.map((item) => {
            const image = images[item.id];
            return (
              <div key={item.id} className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div>
                    <p className='text-base font-extrabold text-slate-950'>{item.title}</p>
                    <p className='mt-1 text-sm font-medium text-slate-500'>{item.description}</p>
                    <p className='mt-2 break-all rounded-lg bg-white px-2.5 py-2 font-mono text-xs font-bold text-slate-600 ring-1 ring-slate-200'>
                      {item.value}
                    </p>
                  </div>
                </div>

                <div className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center'>
                  <button
                    type='button'
                    onClick={() => setActiveQr(item)}
                    className='flex h-36 w-36 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 transition hover:ring-green-300'
                  >
                    {image ? <img src={image} alt={`QR ${item.title}`} className='h-32 w-32' /> : <QrCode className='h-12 w-12 text-slate-300' />}
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
                      Скачать PNG
                    </a>
                    <button
                      type='button'
                      onClick={() => printQr(item)}
                      className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-extrabold text-white hover:bg-green-700'
                    >
                      <Printer className='h-4 w-4' />
                      Печать
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

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
              <p className='break-all rounded-xl bg-slate-50 px-3 py-2 font-mono text-sm font-bold text-slate-700 ring-1 ring-slate-200'>{activeQr.value}</p>
              <div className='grid w-full gap-2 sm:grid-cols-2'>
                <a
                  href={images[activeQr.id] || '#'}
                  download={`offonika-workday-${activeQr.id}-qr.png`}
                  className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-100 px-4 text-sm font-extrabold text-slate-800 hover:bg-slate-200'
                >
                  <Download className='h-4 w-4' />
                  Скачать
                </a>
                <button type='button' onClick={() => printQr(activeQr)} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-extrabold text-white hover:bg-green-700'>
                  <Printer className='h-4 w-4' />
                  Печать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
