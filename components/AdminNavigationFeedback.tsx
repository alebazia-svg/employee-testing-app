'use client';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';

const NavigationFeedback = createContext<(href: string) => void>(() => {});
export const useAdminNavigationFeedback = () => useContext(NavigationFeedback);

/** Kept in the ADMIN layout so closing the mobile menu cannot lose progress. */
export function AdminNavigationFeedback({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [target, setTarget] = useState<{ href: string; from: string } | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!target) return;
    if (pathname !== target.from) { setTarget(null); return; }
    const timer = window.setTimeout(() => setSlow(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [pathname, target]);
  function begin(href: string) {
    const destination = new URL(href, window.location.href);
    if (destination.origin !== window.location.origin || !/^\/admin(?:\/|$)/.test(destination.pathname)) return;
    if (destination.pathname === pathname) { setTarget(null); setSlow(false); return; }
    setSlow(false);
    setTarget({ href: destination.pathname + destination.search + destination.hash, from: pathname });
  }
  return <NavigationFeedback.Provider value={begin}>
    {children}
    {target && <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700 shadow-lg md:inset-x-auto md:bottom-6 md:right-6">
      <span>Открываем раздел…</span>
      {slow && <a href={target.href} className="font-semibold text-[#805335] underline underline-offset-4">Повторить открытие</a>}
    </div>}
  </NavigationFeedback.Provider>;
}
