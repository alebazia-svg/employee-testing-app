'use client';

import { useSearchParams } from 'next/navigation';
import type { ReactNode, MouseEvent } from 'react';

type Tab = 'overview' | 'income' | 'reconciliation' | 'documents';

// All four views share one authorized server snapshot. Switching a view needs
// neither an HTTP request nor another archive/report parse. Refresh still gets
// a new snapshot; Back/Forward and direct URLs remain ordinary navigation.
export function TaxTabPanels({ initialTab, base, tabs, panels }: {
  initialTab: Tab; base: string;
  tabs: { key: Tab; label: string; count: number }[];
  panels: Record<string, ReactNode>;
}) {
  const search = useSearchParams();
  const requested = search.get('tab') || 'overview';
  const active = tabs.some(t => t.key === requested) ? requested : initialTab;
  const href = (key: Tab) => key === 'overview' ? base : `${base}${base.includes('?') ? '&' : '?'}tab=${key}`;
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (event.currentTarget.getAttribute('aria-current') === 'page') return;
    window.history.pushState(null, '', event.currentTarget.href);
  }
  return <>
    <nav aria-label='Разделы налогов' className='admin-section-tabs'>
      {tabs.map(tab => <a key={tab.key} href={href(tab.key)} onClick={navigate} aria-current={active === tab.key ? 'page' : undefined} className='admin-section-tab'>
        {tab.label}{tab.count > 0 && <span className='needs-decision'>{tab.count}</span>}
      </a>)}
    </nav>
    {panels[active]}
  </>;
}
