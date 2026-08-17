'use client';

import { useEffect, useState } from 'react';

type BindingState = { bound: boolean; workstation?: { code: string; label: string } };

export function WorkstationBindingClient() {
  const [code, setCode] = useState('');
  const [state, setState] = useState<BindingState | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/employee/workstation/bind', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => value && setState(value))
      .catch(() => null);
  }, []);

  async function bind() {
    setSubmitting(true);
    setMessage('');
    try {
      const response = await fetch('/api/employee/workstation/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Не удалось привязать компьютер');
      setCode('');
      setState({ bound: true, workstation: body.workstation });
      setMessage('Компьютер успешно привязан. Код больше не действует.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось привязать компьютер');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-4 sm:p-6">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Настройка компьютера</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Рабочее место</h1>
        {state?.bound ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
            <p className="font-medium">Этот компьютер привязан</p>
            <p className="mt-1 text-sm">{state.workstation?.label} · {state.workstation?.code}</p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-slate-600">Введите одноразовый код, выданный администратором для этого компьютера.</p>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
              spellCheck={false}
              placeholder="XXXX-XXXX-XXXX"
              className="w-full rounded-xl border px-4 py-3 font-mono text-lg uppercase tracking-wider outline-none focus:border-slate-500"
            />
            <button
              type="button"
              disabled={submitting || !code.trim()}
              onClick={bind}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Привязываем…' : 'Привязать этот компьютер'}
            </button>
          </div>
        )}
        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </section>
    </main>
  );
}
