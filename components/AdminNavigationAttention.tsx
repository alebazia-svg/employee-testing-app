'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PaymentAttention } from '@/lib/admin-payment-attention';

type NavigationAttention = PaymentAttention & { workday: number | null };
const empty: NavigationAttention = { expenses: null, suppliers: null, workday: null };
const AttentionContext = createContext<NavigationAttention>(empty);
const sections = ['expenses', 'suppliers', 'workday'] as const;
const refreshMs = 60_000;

export function AdminNavigationAttentionProvider({ children }: { children: ReactNode }) {
  const [attention, setAttention] = useState(empty);

  useEffect(() => {
    const controller = new AbortController();
    const inFlight = new Map<keyof NavigationAttention, AbortController>();
    async function refreshSection<K extends keyof NavigationAttention>(section: K) {
      if (inFlight.has(section)) return;
      const read = new AbortController();
      inFlight.set(section, read);
      const timeout = window.setTimeout(() => read.abort(), 55_000);
      let value: NavigationAttention[K] = null;
      try {
        const endpoint = section === 'workday' ? '/api/admin/workday/attention-count' : `/api/admin/payment-attention?section=${section}`;
        const response = await fetch(endpoint, {
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

export function useAdminNavigationAttention() {
  return useContext(AttentionContext);
}

export function AdminExpenseAttentionLink() {
  const { expenses } = useAdminNavigationAttention();
  if (!expenses) return null;
  return <a href='/admin/expense-requests?stage=decision' className='admin-payment-attention-action'>
    Ждут решения <strong>{expenses}</strong>
  </a>;
}
