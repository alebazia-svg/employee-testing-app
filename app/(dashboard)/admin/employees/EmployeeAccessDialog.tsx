'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Eye, EyeOff, KeyRound, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { employeeAccessMessage } from '@/lib/employee-access-message';

export type AccessUser = {
  id: number; name: string; login: string; isActive: boolean; sessionVersion: number;
};
export type IssuedAccess = {
  userId: number; name: string; login: string; password: string; sessionVersion: number;
};

export default function EmployeeAccessDialog({ user, initialAccess, onIssued, onClose }: {
  user: AccessUser; initialAccess: IssuedAccess | null; onIssued: (access: IssuedAccess) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [access, setAccess] = useState(initialAccess);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [visible, setVisible] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; element?.close(); previousFocus?.focus(); };
  }, []);

  async function issue() {
    if (busy || uncertain) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/employees/${user.id}/password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionVersion: user.sessionVersion }),
      });
      const data = await response.json();
      if (!response.ok) { setError(data.error || 'Не удалось выдать доступ.'); setUncertain(response.status === 409 || response.status >= 500); return; }
      setAccess(data); onIssued(data);
    } catch {
      setUncertain(true);
      setError('Ответ не получен. Обновите список перед повторной выдачей: пароль мог уже измениться.');
    } finally { setBusy(false); }
  }

  async function copy(value: string, label: string) {
    setCopied(''); setError('');
    try { await navigator.clipboard.writeText(value); setCopied(label); }
    catch { setError('Не удалось скопировать. Выделите нужные данные и скопируйте вручную.'); setVisible(true); }
  }

  return <dialog ref={dialog} aria-labelledby='employee-access-title' onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className='admin-dialog-panel m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/45'>
    <div className='flex items-start justify-between gap-4 border-b border-[#e7e0d7] px-6 py-5'>
      <div><h2 id='employee-access-title' className='text-xl font-bold'>{user.name}</h2><p className='mt-1 text-sm text-slate-500'>Доступ к порталу</p></div>
      <button type='button' aria-label='Закрыть' disabled={busy} onClick={onClose} className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f5eee7] disabled:opacity-40'><X className='h-5 w-5' /></button>
    </div>
    <div className='space-y-5 px-6 py-5'>
      {access ? <>
        <div><p className='flex items-center gap-2 font-semibold text-slate-900'><Check className='h-4 w-4 text-emerald-700' />Доступ готов</p><p className='mt-1 text-sm text-slate-500'>Скопируйте данные и отправьте сотруднику.</p></div>
        <div className='border-y border-[#e7e0d7]'>
          <div className='flex items-center justify-between gap-3 py-4'><div className='min-w-0'><p className='text-xs font-semibold text-slate-500'>Логин</p><p className='mt-1 break-all font-semibold'>{access.login}</p></div><button type='button' aria-label='Скопировать логин' onClick={() => copy(access.login, 'Логин скопирован')} className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f5eee7]'><Copy className='h-4 w-4' /></button></div>
          <div className='flex items-center justify-between gap-2 border-t border-[#e7e0d7] py-4'><div className='min-w-0'><p className='text-xs font-semibold text-slate-500'>Пароль</p><p className='mt-1 break-all font-mono text-base'>{visible ? access.password : '••••••••••••'}</p></div><div className='flex shrink-0'><button type='button' aria-label={visible ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setVisible(!visible)} className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f5eee7]'>{visible ? <EyeOff className='h-4 w-4' /> : <Eye className='h-4 w-4' />}</button><button type='button' aria-label='Скопировать пароль' onClick={() => copy(access.password, 'Пароль скопирован')} className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f5eee7]'><Copy className='h-4 w-4' /></button></div></div>
        </div>
        <p className='text-sm leading-relaxed text-slate-600'>Пароль действует до следующего сброса. Сотрудник может сразу войти и начать работу.</p>
        <Button className='w-full gap-2' onClick={() => copy(employeeAccessMessage(window.location.origin, access), 'Данные для входа скопированы')}><Copy className='h-4 w-4' />Скопировать данные для входа</Button>
        <p className='text-xs leading-relaxed text-slate-500'>Скопируются ссылка, логин и пароль. Сохраните их до закрытия окна — повторно посмотреть пароль нельзя.</p>
      </> : <>
        <div className='border-b border-[#e7e0d7] pb-4'><p className='text-xs font-semibold text-slate-500'>Логин сотрудника</p><div className='mt-1 flex items-center justify-between gap-3'><p className='break-all font-semibold'>{user.login}</p><button type='button' aria-label='Скопировать логин' onClick={() => copy(user.login, 'Логин скопирован')} className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-[#f5eee7]'><Copy className='h-4 w-4' /></button></div></div>
        <div><h3 className='font-bold'>Выдать новый пароль</h3><p className='mt-2 text-sm leading-relaxed text-slate-600'>Портал создаст постоянный пароль. Скопируйте данные и передайте сотруднику — менять пароль при входе не нужно.</p></div>
        <p className='border-l-2 border-amber-400 py-1 pl-3 text-sm leading-relaxed text-slate-600'>Прежний пароль перестанет работать, а открытые сеансы этого сотрудника завершатся.</p>
        <Button disabled={busy || uncertain} className='w-full gap-2' onClick={issue}><KeyRound className='h-4 w-4' />{busy ? 'Создаём доступ…' : 'Сбросить и выдать пароль'}</Button>
      </>}
      {copied && <p role='status' className='text-sm font-semibold text-emerald-700'>{copied}</p>}
      {error && <p role='alert' className='text-sm text-red-700'>{error}</p>}
      {uncertain && <button type='button' onClick={() => window.location.reload()} className='text-sm font-bold underline underline-offset-4'>Обновить список сотрудников</button>}
    </div>
    <div className='border-t border-[#e7e0d7] px-6 py-4 text-right'><button type='button' disabled={busy} onClick={onClose} className='rounded-lg px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100'>{access ? 'Готово' : 'Отмена'}</button></div>
  </dialog>;
}
