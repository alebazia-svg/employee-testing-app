'use client';
import React, { useEffect, useState } from 'react';
import { requestWaitingAge } from '@/lib/expense-request-queue';
export function ExpenseRequestWaitingAge({ since, label = 'В очереди' }: { since?: string | null; label?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60_000); return () => clearInterval(timer); }, []);
  const age = requestWaitingAge(since, now);
  if (!age) return null;
  return <span className={`inline-flex text-xs ${age.overDay ? 'font-semibold text-amber-800' : 'text-slate-600'}`} title="Время с появления запроса в очереди портала; это не срок оплаты">{label}: {age.label}</span>;
}
