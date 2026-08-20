'use client';

import QRCode from 'qrcode';
import { Download, Maximize2, Printer, QrCode, X } from 'lucide-react';
import { useEffect, useState } from 'react';

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
    const image = images[item.id];
    if (!image) return;

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
    if (!printWindow) return;
    const logoUrl = new URL('/logo-offonika-full.webp', window.location.origin).toString();

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>OFFONIKA — QR для ${item.title}</title>
          <style>
            @page { size: A5 portrait; margin: 0; }
            * { box-sizing: border-box; }
            body { margin: 0; color: #101827; font-family: Arial, Helvetica, sans-serif; }
            .sheet { min-height: 210mm; display: flex; flex-direction: column; overflow: hidden; }
            .brand { display: flex; align-items: center; justify-content: center; min-height: 31mm; padding: 8mm 14mm; background: #111821; }
            .brand img { width: 67mm; height: auto; }
            main { flex: 1; padding: 11mm 18mm 8mm; text-align: center; }
            .eyebrow { color: #4da814; font-size: 10pt; font-weight: 800; letter-spacing: .16em; }
            h1 { margin: 3mm 0 2mm; font-size: 29pt; line-height: 1; letter-spacing: .01em; }
            .lead { max-width: 112mm; margin: 0 auto; color: #526174; font-size: 12pt; line-height: 1.35; }
            .qr-frame { display: inline-flex; margin: 7mm auto; padding: 5mm; border: 1.2mm solid #4db214; border-radius: 6mm; background: #fff; }
            .qr-frame img { display: block; width: 91mm; height: 91mm; }
            .steps { margin: 0 auto; max-width: 120mm; display: grid; gap: 3mm; text-align: left; }
            .step { display: flex; align-items: center; gap: 4mm; min-height: 14mm; padding: 3mm 4mm; border-radius: 4mm; background: #f4f7f5; font-size: 11pt; line-height: 1.25; }
            .number { display: flex; flex: 0 0 8mm; align-items: center; justify-content: center; width: 8mm; height: 8mm; border-radius: 50%; background: #4db214; color: #fff; font-size: 10pt; font-weight: 800; }
            footer { padding: 7mm 16mm; border-top: .4mm solid #dbe3df; color: #627184; font-size: 8.5pt; line-height: 1.35; text-align: center; }
          </style>
        </head>
        <body>
          <section class="sheet">
            <header class="brand"><img src="${logoUrl}" alt="OFFONIKA" /></header>
            <main>
              <div class="eyebrow">НАЧАЛО РАБОЧЕГО ДНЯ</div>
              <h1>${item.title.toUpperCase()}</h1>
              <p class="lead">Перед началом смены откройте портал и отсканируйте этот QR-код.</p>
              <div class="qr-frame"><img src="${image}" alt="QR ${item.title}" /></div>
              <div class="steps">
                <div class="step"><span class="number">1</span><span>Откройте портал OFFONIKA</span></div>
                <div class="step"><span class="number">2</span><span>Нажмите «Сканировать QR»</span></div>
                <div class="step"><span class="number">3</span><span>Наведите камеру на этот код</span></div>
              </div>
            </main>
            <footer>QR-код действует только для сотрудников отдела «${item.title}».<br />Если код не считывается — обратитесь к администратору.</footer>
          </section>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    printWindow.document.close();
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
                          Скачать PNG
                        </a>
                        <button
                          type='button'
                          onClick={() => printQr(item)}
                          className='inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-extrabold text-white hover:bg-green-700'
                        >
                          <Printer className='h-4 w-4' />
                          Печать A5
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
                  Скачать
                </a>
                <button type='button' onClick={() => printQr(activeQr)} className='inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-extrabold text-white hover:bg-green-700'>
                  <Printer className='h-4 w-4' />
                  Печать A5
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
