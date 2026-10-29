'use client';
import { createContext, useContext } from 'react';
import type { ProcurementMobileSection } from '@/lib/procurement-mobile-navigation';
type Navigation = {
  active: ProcurementMobileSection;
  select: (section: ProcurementMobileSection, replace?: boolean) => void;
  setNavigationHidden: (hidden: boolean) => void;
};
export const ProcurementMobileNavigationContext = createContext<Navigation | null>(null);
export const useProcurementMobileNavigation = () => useContext(ProcurementMobileNavigationContext);
