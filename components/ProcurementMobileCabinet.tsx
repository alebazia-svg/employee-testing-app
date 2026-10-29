'use client';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmployeePortalHeader } from '@/app/(dashboard)/employee/EmployeePortalHeader';
import { EmployeeNavigation } from './EmployeeNavigation';
import { useEmployeeActivityVisit } from './EmployeeActivityTracker';
import { ProcurementMobileNavigationContext as Context } from './ProcurementMobileNavigation';
import { procurementMobileSection, type ProcurementMobileSection } from '@/lib/procurement-mobile-navigation';

/** Volatile mounted views, never a cache of financial permissions or authorization. */
export function ProcurementMobileCabinet({ name, workday, children }: { name: string; workday: ReactNode; children: ReactNode }) {
  const query = useSearchParams();
  const sectionFromUrl = procurementMobileSection(query.get('tab'));
  const [active, setActive] = useState<ProcurementMobileSection>(sectionFromUrl);
  const [navigationHidden, setNavigationHidden] = useState(false);
  const positions = useRef<Record<ProcurementMobileSection, number>>({ day: 0, schedule: 0, procurement: 0 });
  const current = useRef(active);
  const select = useCallback((section: ProcurementMobileSection, replace = false) => {
    if (section === current.current) return;
    positions.current[current.current] = window.scrollY;
    current.current = section;
    setActive(section);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', section);
    for (const target of ['date', 'edit', 'attention', 'item']) url.searchParams.delete(target);
    // Native history is integrated with Next search params, without an RSC navigation.
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url.pathname + url.search + url.hash);
  }, []);
  useEffect(() => { current.current = sectionFromUrl; setActive(sectionFromUrl); }, [sectionFromUrl]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => window.scrollTo({ top: positions.current[active], behavior: 'instant' }));
    return () => cancelAnimationFrame(frame);
  }, [active]);
  useEmployeeActivityVisit(active === 'procurement' ? 'procurement' : null);
  const value = useMemo(() => ({ active, select, setNavigationHidden }), [active, select]);
  return <Context.Provider value={value}>
    <div className='employee-material-shell procurement-mobile-cabinet relative mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-[#f7faf8]'>
      <EmployeePortalHeader name={name} meta='Закупки' procurement />
      <div className='flex-1 min-w-0 procurement-mobile-pages'>
      <div hidden={active !== 'procurement'} className='procurement-mobile-content min-w-0 px-4' data-mobile-pane='procurement'>{children}</div>
      <div hidden={active === 'procurement'} className='min-w-0' data-mobile-pane='workday'>{workday}</div>
      </div>
    </div>
    {(!navigationHidden || active === 'procurement') && <EmployeeNavigation active={active} payrollEnabled={false} procurementEnabled />}
  </Context.Provider>;
}
