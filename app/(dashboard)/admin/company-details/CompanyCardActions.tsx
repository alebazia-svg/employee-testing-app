'use client';

import { Check, Download, ExternalLink, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const pdfPath = '/documents/company-card-ip-keshtova.pdf';
const docxPath = '/documents/company-card-ip-keshtova.docx';

export function CompanyCardActions() {
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!linkCopied) return;
    const timeout = window.setTimeout(() => setLinkCopied(false), 2500);
    return () => window.clearTimeout(timeout);
  }, [linkCopied]);

  async function shareCard() {
    const url = new URL(pdfPath, window.location.origin).toString();

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Карточка предприятия ИП Кештова Бэла Руслановна',
          text: 'Реквизиты ИП Кештова Бэла Руслановна',
          url,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    await navigator.clipboard.writeText(url);
    setLinkCopied(true);
  }

  return (
    <div className='flex flex-wrap items-center gap-2'>
      <a
        href={pdfPath}
        target='_blank'
        rel='noreferrer'
        className='inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800'
      >
        <ExternalLink className='h-4 w-4' />
        Открыть PDF
      </a>
      <button
        type='button'
        onClick={shareCard}
        className='inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50'
      >
        {linkCopied ? <Check className='h-4 w-4 text-green-700' /> : <Share2 className='h-4 w-4' />}
        {linkCopied ? 'Ссылка скопирована' : 'Поделиться'}
      </button>
      <a
        href={docxPath}
        download='Карточка предприятия ИП Кештова Бэла Руслановна.docx'
        className='inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50'
      >
        <Download className='h-4 w-4' />
        Скачать Word
      </a>
      <span className='sr-only' aria-live='polite'>{linkCopied ? 'Ссылка на PDF скопирована' : ''}</span>
    </div>
  );
}
