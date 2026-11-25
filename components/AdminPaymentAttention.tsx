'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PaymentAttention } from '@/lib/admin-payment-attention';

const empty: PaymentAttention = { expenses: null, suppliers: null };
const AttentionContext = createContext<PaymentAttention>(empty);
const sections = ['expenses', 'suppliers'] as const;
const refreshMs = 60_000;

export function AdminPaymentAttentionProvider({ children }: { children: ReactNode }) {
  const [attention, setAttention] = useState(empty);

  useEffect(() => {
    const controller = new AbortController();
    const inFlight = new Map<keyof PaymentAttention, AbortController>();
    async function refreshSection<K extends keyof PaymentAttention>(section: K) {
      if (inFlight.has(section)) return;
      const read = new AbortController();
      inFlight.set(section, read);
      const timeout = window.setTimeout(() => read.abort(), 55_000);
      let value: PaymentAttention[K] = null;
      try {
        const response = await fetch(`/api/admin/payment-attention?section=${section}`, {
          cache: 'no-store',
          signal: read.signal,
        });
        if (response.ok) value = await response.json();
      } catch {
        // An unavailable source is distinct from a verified empty queue.
      } finally {
        window.clearTimeout(timeout);
        inFlight.delete(section);
        if (!controller.signal.aborted) setAttention(current => ({ ...current, [section]: value }));
      }
    }
    const refresh = () => {
      if (document.visibilityState === 'visible') sections.forEach(section => { void refreshSection(section); });
    };
    refresh();
    const timer = window.setInterval(refresh, refreshMs);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      controller.abort();
      inFlight.forEach(read => read.abort());
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  return <AttentionContext.Provider value={attention}>{children}</AttentionContext.Provider>;
}

export function useAdminPaymentAttention() {
  return useContext(AttentionContext);
}

export function AdminExpenseAttentionLink() {
  const { expenses } = useAdminPaymentAttention();
  if (!expenses) return null;
  return <a href='/admin/expense-requests?stage=decision' className='admin-payment-attention-action'>
    Ждут решения <strong>{expenses}</strong>
  </a>;
}

export function AdminSupplierPreparation({ onSelect }: { onSelect: () => void }) {
  const { suppliers } = useAdminPaymentAttention();
  if (!suppliers || suppliers.preparation === 0) return null;
  return <div className='admin-payment-attention-actions' aria-label='Требуют внимания'>
    {Boolean(suppliers.preparation) && <button type='button' className='admin-payment-attention-action' onClick={onSelect}>
      Подготовить деньги <strong>{suppliers.preparation}</strong>
    </button>}
    {suppliers.preparation === null && <span className='text-sm text-slate-600'>Сроки подготовки уточняются</span>}
  </div>;
}
