'use client';
import { useEffect, useRef } from 'react';
import { bindMobileNavigationViewport } from '@/lib/mobile-navigation-viewport';

export function useMobileNavigationViewport() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (ref.current) return bindMobileNavigationViewport(ref.current);
  }, []);
  return ref;
}
