'use client';

/** Rebuild only the fixed dock after a mobile focus/modal transition. Do not
 * resize the document, guess an iPhone screen height or scroll to the page top.
 */
export function bindMobileNavigationViewport(nav: HTMLElement, host: Window & typeof globalThis = window) {
  const doc = host.document;
  const viewport = host.visualViewport;
  const mobile = host.matchMedia('(max-width: 767px), (pointer: coarse)');
  let disposed = false;
  let baselineWidth = host.innerWidth;
  let baselineHeight = host.innerHeight;
  let keyboardSeen = false;
  let blurredAt = 0;
  let scrollTimer: number | undefined;
  let touching = false, touchGesture = false, touchScrolled = false;
  const standalone = (host.navigator as Navigator & { standalone?: boolean } | undefined)?.standalone === true;
  const timers = new Set<number>();
  const editable = () => {
    const element = doc.activeElement;
    if (!(element instanceof host.HTMLElement)) return false;
    if (element.isContentEditable) return true;
    if (element instanceof host.HTMLTextAreaElement) return !element.readOnly && !element.disabled;
    return element instanceof host.HTMLInputElement && !element.readOnly && !element.disabled
      && ['text', 'number', 'email', 'password', 'search', 'tel', 'url'].includes(element.type);
  };
  const modal = () => Boolean(doc.querySelector('dialog[open], [role="dialog"][aria-modal="true"]:not([aria-hidden="true"])'));
  const locked = () => doc.body.style.position === 'fixed' || doc.body.style.overflow === 'hidden';
  const zoomed = () => viewport && Math.abs(viewport.scale - 1) > 0.05;
  const clearTimers = () => { for (const timer of timers) host.clearTimeout(timer); timers.clear(); };
  const measure = () => {
    if (Math.abs(host.innerWidth - baselineWidth) > 40) {
      baselineWidth = host.innerWidth;
      baselineHeight = host.innerHeight;
      keyboardSeen = false;
    }
    if (!editable() && !keyboardSeen) baselineHeight = host.innerHeight;
    const height = viewport?.height ?? host.innerHeight;
    const reduced = baselineHeight - height > Math.max(100, baselineHeight * 0.2);
    // A stale WebKit visualViewport must not leave the dock hidden forever
    // after an input was removed together with its dialog.
    const expiredBlur = !editable() && blurredAt > 0 && host.Date.now() - blurredAt >= 650;
    const keyboard = mobile.matches && !zoomed() && reduced && (editable() || keyboardSeen) && !expiredBlur;
    keyboardSeen = keyboard;
    if (keyboard) nav.setAttribute('data-portal-keyboard', 'open');
    else nav.removeAttribute('data-portal-keyboard');
    return keyboard;
  };
  const recover = () => {
    if (disposed || !mobile.matches || doc.visibilityState !== 'visible' || zoomed()) return;
    if (measure() || editable() || modal() || locked()) return;
    const scrollX = host.scrollX, scrollY = host.scrollY;
    const focused = nav.contains(doc.activeElement) ? doc.activeElement as HTMLElement : null;
    const display = nav.style.getPropertyValue('display');
    const priority = nav.style.getPropertyPriority('display');
    nav.style.setProperty('display', 'none', 'important');
    void nav.offsetHeight;
    if (display) nav.style.setProperty('display', display, priority);
    else nav.style.removeProperty('display');
    void nav.offsetHeight;
    // Ask WebKit to settle its visual offset while retaining the current list
    // position. Never retain a scroll value captured before another task.
    host.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    if (focused?.isConnected) focused.focus({ preventScroll: true });
  };
  const schedule = () => {
    if (disposed) return;
    clearTimers();
    for (const delay of [80, 300, 750]) {
      const timer = host.setTimeout(() => { timers.delete(timer); recover(); }, delay);
      timers.add(timer);
    }
  };
  let hadEditable = editable(), hadModal = modal();
  let bodyLock = `${doc.body.style.position}|${doc.body.style.overflow}`;
  const inspect = () => {
    const nextEditable = editable(), nextModal = modal();
    const nextLock = `${doc.body.style.position}|${doc.body.style.overflow}`;
    if (hadEditable && !nextEditable) { blurredAt = host.Date.now(); schedule(); }
    if (hadModal && !nextModal || bodyLock !== nextLock) schedule();
    hadEditable = nextEditable; hadModal = nextModal; bodyLock = nextLock;
    measure();
  };
  // Ordinary finger scrolling can leave a fixed layer displaced without a
  // keyboard/modal event. Inspect only after scrolling settles, and rebuild
  // a displaced dock (or stale iOS standalone paint). Never reset the list position.
  const inspectScrollEnd = () => {
    if (scrollTimer !== undefined) { host.clearTimeout(scrollTimer); scrollTimer = undefined; }
    if (disposed || touching || !mobile.matches || doc.visibilityState !== 'visible' || zoomed()
      || measure() || editable() || modal() || locked()) return;
    const repaintStandaloneTouch = standalone && touchGesture && touchScrolled;
    touchGesture = false; touchScrolled = false;
    const rect = nav.getBoundingClientRect();
    const bottom = Number.parseFloat(host.getComputedStyle(nav).bottom);
    if (!Number.isFinite(bottom) || rect.height <= 0) return;
    const expectedBottom = host.innerHeight - bottom;
    // WebKit can paint a displaced layer while reporting a correct DOM rect.
    // Rebuild once after a completed finger scroll in iOS standalone as well.
    if (repaintStandaloneTouch || Math.abs(rect.bottom - expectedBottom) > 3) recover();
  };
  const scrolled = () => {
    if (disposed || !mobile.matches) return;
    if (touchGesture) touchScrolled = true;
    if (scrollTimer !== undefined) host.clearTimeout(scrollTimer);
    scrollTimer = host.setTimeout(inspectScrollEnd, 200);
  };
  const touchStarted = () => { touching = true; touchGesture = true; touchScrolled = false; };
  const touchEnded = () => { touching = false; if (touchScrolled) scrolled(); };
  const resized = () => { measure(); schedule(); };
  const returned = () => { if (doc.visibilityState === 'visible') { inspect(); schedule(); } };
  const observer = new host.MutationObserver(inspect);
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'aria-hidden', 'style'] });
  doc.addEventListener('focusin', inspect, true);
  doc.addEventListener('focusout', inspect, true);
  doc.addEventListener('close', inspect, true);
  doc.addEventListener('visibilitychange', returned);
  host.addEventListener('touchstart', touchStarted, { passive: true });
  host.addEventListener('touchend', touchEnded, { passive: true });
  host.addEventListener('touchcancel', touchEnded, { passive: true });
  host.addEventListener('scroll', scrolled, { passive: true });
  host.addEventListener('scrollend', inspectScrollEnd);
  host.addEventListener('resize', resized);
  host.addEventListener('orientationchange', resized);
  host.addEventListener('pageshow', returned);
  viewport?.addEventListener('resize', resized);
  viewport?.addEventListener('scroll', inspect);
  measure();
  schedule(); // A conditional dock may remount only after its dialog disappears.
  return () => {
    disposed = true;
    clearTimers();
    if (scrollTimer !== undefined) host.clearTimeout(scrollTimer);
    observer.disconnect();
    doc.removeEventListener('focusin', inspect, true);
    doc.removeEventListener('focusout', inspect, true);
    doc.removeEventListener('close', inspect, true);
    doc.removeEventListener('visibilitychange', returned);
    host.removeEventListener('touchstart', touchStarted);
    host.removeEventListener('touchend', touchEnded);
    host.removeEventListener('touchcancel', touchEnded);
    host.removeEventListener('scroll', scrolled);
    host.removeEventListener('scrollend', inspectScrollEnd);
    host.removeEventListener('resize', resized);
    host.removeEventListener('orientationchange', resized);
    host.removeEventListener('pageshow', returned);
    viewport?.removeEventListener('resize', resized);
    viewport?.removeEventListener('scroll', inspect);
    nav.removeAttribute('data-portal-keyboard');
  };
}
