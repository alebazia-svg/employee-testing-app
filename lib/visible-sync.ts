export type VisibleSyncEnvironment = {
  isVisible: () => boolean;
  setInterval: (callback: () => void, intervalMs: number) => number;
  clearInterval: (timerId: number) => void;
  addFocusListener: (listener: () => void) => void;
  removeFocusListener: (listener: () => void) => void;
  addVisibilityListener: (listener: () => void) => void;
  removeVisibilityListener: (listener: () => void) => void;
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
  };
}

export function startVisibleSync(sync: () => void | Promise<void>, intervalMs: number, environment = browserVisibleSyncEnvironment()) {
  const syncWhenVisible = () => {
    if (environment.isVisible()) void sync();
  };

  syncWhenVisible();
  const timer = environment.setInterval(syncWhenVisible, intervalMs);
  environment.addFocusListener(syncWhenVisible);
  environment.addVisibilityListener(syncWhenVisible);

  return () => {
    environment.clearInterval(timer);
    environment.removeFocusListener(syncWhenVisible);
    environment.removeVisibilityListener(syncWhenVisible);
  };
}
