'use client';

import { useEffect } from 'react';

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

  return <>
    <span hidden id='pwa-visual-proposal' />
    <link rel='stylesheet' href='/pwa-visual-proposal.css' />
    {studio && <><span hidden id='pwa-design-studio' /><link rel='stylesheet' href='/pwa-design-studio.css?v=interface-review-3' /></>}
    {copper && <><span hidden id='pwa-copper-theme' /><link rel='stylesheet' href='/pwa-copper.css?v=1' /></>}
  </>;
}
