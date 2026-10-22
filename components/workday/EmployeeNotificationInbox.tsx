'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, ChevronRight, MessageCircle } from 'lucide-react';
export type EmployeeInboxItem = {
  id: number; kind: string; title: string; body: string; readAt: string | null;
  href: string; taskId: number | null; issueId: number | null; reviewId: string | null;
  attentionKind?: 'receipt' | 'closing';
  active?: boolean; sentAt?: string | null;
};
function dayLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Ранее';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(d);
  if (day(new Date(value)) === day(new Date())) return 'Сегодня';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' }).format(new Date(value));
}
export function EmployeeNotificationInbox({ items, onClose, onChoose, permission }: { items: EmployeeInboxItem[]; onClose: () => void; onChoose: (item: EmployeeInboxItem) => void; permission: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<EmployeeInboxItem | null>(null);
  const back = () => history ? setHistory(null) : onClose();
  useEffect(() => {
    const sheet = dialog.current!, previous = document.activeElement as HTMLElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; sheet.showModal();
    return () => { sheet.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} aria-labelledby="employee-inbox-title" className="employee-inbox portal-neutral-design employee-material-ui" onCancel={event => { event.preventDefault(); back(); }}>
    <header className="employee-inbox-heading"><button type="button" onClick={back} aria-label={history ? 'К списку уведомлений' : 'Вернуться на главный экран'}><ArrowLeft size={22}/></button><h2 id="employee-inbox-title">{history ? 'Сообщение' : 'Уведомления'}</h2></header>
    <div className="employee-inbox-body">
      {history ? <article className="employee-inbox-detail"><p>{dayLabel(history.sentAt)}</p><h3>{history.title}</h3><p>{history.body}</p><p className="mt-4 text-xs text-slate-500">Это сообщение из истории. Текущие задачи — на главном экране.</p></article> : <>
        {items.length === 0 && <p className="employee-inbox-empty">Уведомлений пока нет</p>}
        {[...new Set(items.map(item => dayLabel(item.sentAt)))].map(day => <section className="employee-inbox-group" key={day}><h3>{day}</h3><div className="employee-inbox-rows">{items.filter(item => dayLabel(item.sentAt) === day).map(item => {
          const unread = !item.readAt && item.active !== false, Icon = item.kind.endsWith('_reply') ? MessageCircle : Bell;
          return <button type="button" key={item.id} className={`employee-inbox-row ${unread ? 'is-unread' : ''}`} onClick={() => { if (item.active === false) setHistory(item); onChoose(item); }}>
            <span className="employee-inbox-icon"><Icon size={20} strokeWidth={1.7}/></span><span className="employee-inbox-copy"><strong>{item.title}</strong><span>{item.body}</span>{item.sentAt && Number.isFinite(Date.parse(item.sentAt)) && <time>{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(new Date(item.sentAt))}</time>}</span><span className="employee-inbox-row-end">{unread && <i aria-label="Новое"/>}<ChevronRight size={16}/></span>
          </button>;
        })}</div></section>)}
        {permission}
      </>}
    </div>
  </dialog>, document.body);
}
