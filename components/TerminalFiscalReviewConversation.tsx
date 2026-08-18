'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';

type Message = { id: string; body: string; createdAt: string; author: { id: number; name: string; role: string } };

function when(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Moscow',
  }).format(date);
}
export function TerminalFiscalReviewConversation({
  initialMessages,
  currentUserId,
  endpoint,
  disabled,
}: {
  initialMessages: Message[];
  currentUserId: number;
  endpoint: string;
  disabled: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function send() {
    const normalized = body.replace(/\s+/g, ' ').trim();
    if (!normalized || busy) return;
    setBusy(true);
    setError('');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: normalized }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) : null;
    if (!response?.ok) {
      setError(payload?.error || 'Не удалось отправить сообщение.');
      setBusy(false);
      return;
    }
    setMessages((current) => [...current, {
      id: payload.messageId,
      body: normalized,
      createdAt: new Date().toISOString(),
      author: { id: currentUserId, name: 'Вы', role: '' },
    }]);
    setBody('');
    setBusy(false);
  }

  return (
    <div>
      <div className='space-y-2'>
        {messages.length === 0 ? (
          <p className='rounded-xl bg-slate-50 px-4 py-4 text-sm font-medium text-slate-500'>Переписки пока нет.</p>
        ) : messages.map((message) => {
          const own = message.author.id === currentUserId;
          return (
            <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-3 ${own ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-900'}`}>
                <p className='text-xs font-bold opacity-70'>{own ? 'Вы' : message.author.name}</p>
                <p className='mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed'>{message.body}</p>
                <p className='mt-1 text-[11px] font-semibold opacity-55'>{when(message.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
      {!disabled ? (
        <div className='mt-4 rounded-2xl border border-slate-200 bg-white p-3'>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={1000}
            rows={3}
            placeholder='Коротко опишите вопрос'
            className='w-full resize-none rounded-xl border-0 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-green-500'
          />
          <div className='mt-2 flex items-center justify-between gap-3'>
            <span className='text-xs font-medium text-slate-400'>{body.length}/1000</span>
            <button type='button' onClick={() => void send()} disabled={busy || !body.trim()} className='inline-flex items-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-extrabold text-white disabled:opacity-50'>
              <Send className='h-4 w-4' />{busy ? 'Отправляем…' : 'Отправить'}
            </button>
          </div>
          {error && <p className='mt-2 text-xs font-bold text-rose-700'>{error}</p>}
        </div>
      ) : (
        <p className='mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm font-semibold text-green-800'>Проверка закрыта. История сообщений сохранена.</p>
      )}
    </div>
  );
}
