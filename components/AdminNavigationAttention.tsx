'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { PayrollApprovalTarget, WorkdayAttention } from '@/lib/admin-review-attention';
import type { PaymentAttention } from '@/lib/admin-payment-attention';

type NavigationAttention = PaymentAttention & { workday: WorkdayAttention | null; payroll: PayrollApprovalTarget[] | null };
const empty: NavigationAttention = { expenses: null, suppliers: null, workday: null, payroll: null };
const AttentionContext = createContext<NavigationAttention>(empty);
const endpoints = {
  expenses: '/api/admin/payment-attention?section=expenses',
  suppliers: '/api/admin/payment-attention?section=suppliers',
  workday: '/api/admin/workday/attention-count',
  payroll: '/api/admin/payroll/attention-count',
} satisfies Record<keyof NavigationAttention, string>;
const sections = Object.keys(endpoints) as (keyof NavigationAttention)[];
const refreshMs = 60_000;

export function AdminNavigationAttentionProvider({ children }: { children: ReactNode }) {
  const [attention, setAttention] = useState(empty);

  useEffect(() => {
    const controller = new AbortController();
    const inFlight = new Map<keyof NavigationAttention, AbortController>();
    async function refreshSection<K extends keyof NavigationAttention>(section: K, replace = false) {
      const previous = inFlight.get(section);
      if (previous && !replace) return;
      previous?.abort();
      const read = new AbortController();
      inFlight.set(section, read);
      const timeout = window.setTimeout(() => read.abort(), 55_000);
      let value: NavigationAttention[K] = null;
      try {
        const response = await fetch(endpoints[section], {
          cache: 'no-store',
          signal: read.signal,
        });
        if (response.ok) value = await response.json();
      } catch {
        // An unavailable source is distinct from a verified empty queue.
      } finally {
        window.clearTimeout(timeout);
        if (inFlight.get(section) === read) {
          inFlight.delete(section);
          if (!controller.signal.aborted) setAttention(current => ({ ...current, [section]: value }));
        }
      }
    }
    const refresh = () => {
      if (document.visibilityState === 'visible') sections.forEach(section => { void refreshSection(section); });
    };
    refresh();
    const timer = window.setInterval(refresh, refreshMs);
    const refreshWorkday = () => { void refreshSection('workday', true); };
    const refreshPayroll = () => { void refreshSection('payroll', true); };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('workday-handover-reviewed', refreshWorkday);
    window.addEventListener('workday-fiscal-reviewed', refreshWorkday);
    window.addEventListener('payroll-approval-changed', refreshPayroll);
    return () => {
      controller.abort();
      inFlight.forEach(read => read.abort());
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('workday-handover-reviewed', refreshWorkday);
      window.removeEventListener('workday-fiscal-reviewed', refreshWorkday);
      window.removeEventListener('payroll-approval-changed', refreshPayroll);
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
