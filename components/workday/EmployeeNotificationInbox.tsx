'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Bell, CheckCheck, ChevronRight, MessageCircle } from 'lucide-react';
import {employeeInboxSections,isNewEmployeeNotification} from '@/lib/employee-inbox-view';
import {NotificationInboxSwitch} from '@/components/NotificationInboxSwitch';
export type EmployeeInboxItem = {
  id: number; kind: string; title: string; body: string; readAt: string | null;
  href: string; taskId: number | null; issueId: number | null; reviewId: string | null;
  attentionKind?: 'receipt' | 'closing';
  active?: boolean; sentAt?: string | null;
  fingerprint?: string;
};
function dayLabel(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Ранее';
  const day = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow' }).format(d);
  if (day(new Date(value)) === day(new Date())) return 'Сегодня';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', day: 'numeric', month: 'long' }).format(new Date(value));
}
export function EmployeeNotificationInbox({ items, onClose, onChoose, permission, compact=false, error='', loading=false, onRetry }: { items: EmployeeInboxItem[]; onClose: () => void; onChoose: (item: EmployeeInboxItem) => void; permission: ReactNode; compact?:boolean; error?:string; loading?:boolean; onRetry?:()=>void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [history, setHistory] = useState<EmployeeInboxItem | null>(null);
  const [showHistory,setShowHistory]=useState(false);
  const sections=employeeInboxSections(items);
  const shown=showHistory?sections.history:sections.fresh;
  const back = () => history ? setHistory(null) : showHistory?setShowHistory(false):onClose();
  useEffect(() => {
    const sheet = dialog.current!, previous = document.activeElement as HTMLElement, overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; sheet.showModal();
    return () => { sheet.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return createPortal(<dialog ref={dialog} aria-labelledby="employee-inbox-title" className={`employee-inbox portal-neutral-design employee-material-ui${compact?' employee-inbox-compact':''}`} onCancel={event => { event.preventDefault(); back(); }}>
    <header className="employee-inbox-heading"><button type="button" onClick={back} aria-label={history ? 'К списку уведомлений' : showHistory?'К новым уведомлениям':'Вернуться на главный экран'}><ArrowLeft size={22}/></button><h2 id="employee-inbox-title">{history ? 'Сообщение' : showHistory?'История':'Уведомления'}</h2></header>
    <div className="employee-inbox-body">
      {error?<div role="alert" className="notification-inbox-error">{error}{onRetry?<button type="button" onClick={onRetry}>Повторить</button>:null}</div>:null}
      {history ? <article className="employee-inbox-detail"><p>{dayLabel(history.sentAt)}</p><h3>{history.title}</h3><p>{history.body}</p><p className="mt-4 text-xs text-slate-500">Это сообщение из истории. Текущие задачи — на главном экране.</p></article> : <>
        <NotificationInboxSwitch history={showHistory} count={sections.fresh.length} onChange={setShowHistory}/>
        {shown.length === 0 && <div className="employee-inbox-empty">{loading?<p role="status">Загружаем уведомления…</p>:error?null:showHistory?'В истории пока нет сообщений':<><CheckCheck size={30} className="mx-auto mb-3 text-[#a77550]"/><strong className="block text-base text-[#343b3b]">Новых уведомлений нет</strong><p className="mt-2 text-xs">Прочитанные сообщения — в истории.</p></>}</div>}
        {[...new Set(shown.map(item => dayLabel(item.sentAt)))].map(day => <section className="employee-inbox-group" key={day}><h3>{day}</h3><div className="employee-inbox-rows">{shown.filter(item => dayLabel(item.sentAt) === day).map(item => {
          const unread = isNewEmployeeNotification(item), Icon = item.kind.endsWith('_reply') ? MessageCircle : Bell;
          return <button type="button" key={item.id} className={`employee-inbox-row ${unread ? 'is-unread' : ''}`} onClick={() => { if (item.active === false) setHistory(item); onChoose(item); }}>
            <span className="employee-inbox-icon"><Icon size={20} strokeWidth={1.7}/></span><span className="employee-inbox-copy"><strong>{item.title}</strong><span>{item.body}</span>{item.sentAt && Number.isFinite(Date.parse(item.sentAt)) && <time>{new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', hour: '2-digit', minute: '2-digit' }).format(new Date(item.sentAt))}</time>}</span><span className="employee-inbox-row-end">{unread && <i aria-label="Новое"/>}<ChevronRight size={16}/></span>
          </button>;
        })}</div></section>)}
        {permission}
      </>}
    </div>
  </dialog>, document.body);
}
