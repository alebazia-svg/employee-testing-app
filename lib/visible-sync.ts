export type VisibleSyncEnvironment = {
  isVisible: () => boolean;
  setInterval: (callback: () => void, intervalMs: number) => number;
  clearInterval: (timerId: number) => void;
  addFocusListener: (listener: () => void) => void;
  removeFocusListener: (listener: () => void) => void;
  addVisibilityListener: (listener: () => void) => void;
  removeVisibilityListener: (listener: () => void) => void;
  addPageShowListener: (listener: () => void) => void;
  removePageShowListener: (listener: () => void) => void;
};

function browserVisibleSyncEnvironment(): VisibleSyncEnvironment {
  return {
    isVisible: () => document.visibilityState === 'visible',
    setInterval: (callback, intervalMs) => window.setInterval(callback, intervalMs),
    clearInterval: (timerId) => window.clearInterval(timerId),
    addFocusListener: (listener) => window.addEventListener('focus', listener),
    removeFocusListener: (listener) => window.removeEventListener('focus', listener),
    addVisibilityListener: (listener) => document.addEventListener('visibilitychange', listener),
    removeVisibilityListener: (listener) => document.removeEventListener('visibilitychange', listener),
    addPageShowListener: (listener) => window.addEventListener('pageshow', listener),
    removePageShowListener: (listener) => window.removeEventListener('pageshow', listener),
  };
}

export function startVisibleSync(sync: () => void | Promise<void>, intervalMs: number, environment = browserVisibleSyncEnvironment()) {
  let stopped = false;
  let running = false;
  let pending = false;
  const syncNow = () => {
    if (stopped) return;
    if (running) { pending = true; return; }
    let result: void | Promise<void>;
    try { result = sync(); } catch { return; }
    if (!result || typeof result.then !== 'function') return;
    running = true;
    // Keep one trailing read: a resume or update during a slow request may
    // represent newer data, but must not start parallel copies of that read.
    void Promise.resolve(result).catch(() => {}).then(() => {
      running = false;
      if (pending && !stopped) { pending = false; syncNow(); }
    });
  };
  const syncWhenVisible = () => {
    if (environment.isVisible()) syncNow();
  };

  // iOS standalone web apps can resume before WebKit updates visibilityState.
  // Start and resume snapshots must not be skipped because of that stale flag.
  syncNow();
  const timer = environment.setInterval(syncWhenVisible, intervalMs);
  environment.addFocusListener(syncNow);
  environment.addVisibilityListener(syncWhenVisible);
  environment.addPageShowListener(syncNow);

  return () => {
    stopped = true;
    pending = false;
    environment.clearInterval(timer);
    environment.removeFocusListener(syncNow);
    environment.removeVisibilityListener(syncWhenVisible);
    environment.removePageShowListener(syncNow);
  };
}
