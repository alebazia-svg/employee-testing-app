'use client';

import React, { useEffect, useId, useRef } from 'react';

export function ProcurementDiscardDraftDialog({ open, editing, onKeep, onDiscard }: {
  open: boolean;
  editing: boolean;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open]);

  return <dialog ref={dialogRef} role="alertdialog" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onKeep(); }}
    onClick={event => { if (event.target === event.currentTarget) onKeep(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const buttons = event.currentTarget.querySelectorAll('button');
      const next = event.shiftKey ? buttons[buttons.length - 1] : buttons[0];
      const boundary = event.shiftKey ? buttons[0] : buttons[buttons.length - 1];
      if (event.currentTarget.ownerDocument.activeElement === boundary) {
        event.preventDefault();
        next?.focus();
      }
    }}
    className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-sm">
    <h2 id={titleId} className="text-xl font-black">{editing ? 'Отменить изменения?' : 'Удалить черновик оплаты?'}</h2>
    <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">
      {editing ? 'Заявка останется без изменений.' : 'Выбранные оплаты и введённые суммы не сохранятся.'}
    </p>
    <div className="mt-6 flex flex-col gap-2">
      <button type="button" autoFocus onClick={onKeep} className="rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white">Продолжить заполнение</button>
      <button type="button" onClick={onDiscard} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-red-700 hover:bg-red-50">{editing ? 'Отменить изменения' : 'Удалить черновик'}</button>
    </div>
  </dialog>;
}
