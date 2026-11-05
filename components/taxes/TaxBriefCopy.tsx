'use client';
import React, { useState } from 'react';

export function TaxBriefCopy({ text }: { text: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setStatus('copied'); }
    catch { setStatus('manual'); }
  }
  return <div className='tax-brief-copy'>
    <button className='tax-command-button' type='button' onClick={copy}>Скопировать для бухгалтера</button>
    <span role='status' aria-live='polite'>{status === 'copied' ? 'Скопировано. Ничего не отправлено.' : ''}</span>
    <details className='tax-brief-preview' open={status === 'manual' ? true : undefined}>
      <summary>{status === 'manual' ? 'Скопировать вручную — открыть текст' : 'Проверить текст перед пересылкой'}</summary>
      <label className='tax-brief-fallback'>Сводка для бухгалтера<textarea readOnly value={text} rows={8} onFocus={event => event.currentTarget.select()} /></label>
    </details>
  </div>;
}
