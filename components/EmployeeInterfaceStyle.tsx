'use client';

import { useEffect } from 'react';
import { getReleaseInfo } from '@/lib/release-info';

/** Presentation only. Does not enable fixtures, camera simulation or API writes. */
export function EmployeeInterfaceStyle({ studio = true, copper = false }: { studio?: boolean; copper?: boolean }) {
  useEffect(() => {
    if (!studio) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const action = document.getElementById('pwa-current-action');
      document.body.classList.toggle('pwa-action-offscreen', Boolean(action && action.getBoundingClientRect().bottom <= 0));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('resize', schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('resize', schedule);
      document.body.classList.remove('pwa-action-offscreen');
    };
  }, [studio]);

  const styleVersion = encodeURIComponent(getReleaseInfo().version);
  return <>
    <span hidden id='pwa-visual-proposal' />
    <link rel='stylesheet' precedence='pwa-base' href={`/pwa-visual-proposal.css?v=${styleVersion}`} />
    {studio && <><span hidden id='pwa-design-studio' /><link rel='stylesheet' precedence='pwa-studio' href={`/pwa-design-studio.css?v=${styleVersion}`} /></>}
    {copper && <><span hidden id='pwa-copper-theme' /><link rel='stylesheet' precedence='pwa-copper' href={`/pwa-copper.css?v=${styleVersion}`} /></>}
  </>;
}
