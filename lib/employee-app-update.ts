import type { AppState } from './portal-app-observation';
/** A release check must never turn a network failure into a forced navigation. */
export type AppRelease = { version: string; builtAt: string };
export function readAppRelease(value: unknown): AppRelease | null {
  if (!value || typeof value !== 'object') return null;
  const { version, builtAt } = value as Record<string, unknown>;
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)
    || typeof builtAt !== 'string' || !Number.isFinite(Date.parse(builtAt))) return null;
  return { version, builtAt };
}
const identity = (release: AppRelease) => `${release.version}@${release.builtAt}`;
export type UpdateAttempt = { target: string; at: number; count?: number; commandId?: string };
export type AppUpdateEnvironment = {
  cashHandover?: boolean;
  now: () => number;
  visible: () => boolean;
  safe: () => boolean;
  fetchRelease: (signal: AbortSignal) => Promise<unknown>;
  readAttempt: () => UpdateAttempt | null;
  saveAttempt: (attempt: UpdateAttempt) => void;
  reload: () => void;
  observe?: (state: AppState) => void;
  blockedReason?: () => AppState;
  commandId?: () => string | undefined;
};

export function createEmployeeAppUpdater(current: AppRelease, env: AppUpdateEnvironment) {
  let pending = false;
  let waitingForSafeScreen = false;
  let disposed = false;
  let reloading = false;
  let lastCheck = -Infinity;
  let controller: AbortController | null = null;
  let inFlight: Promise<true | undefined> | undefined;
  let resume: (() => void) | undefined;
  const perform = async (force: boolean): Promise<true | undefined> => {
    if (disposed || reloading || controller || !env.visible() || (!force && env.now() - lastCheck < 15_000)) return;
    waitingForSafeScreen = false;
    lastCheck = env.now();
    controller = new AbortController();
    const request = controller;
    const timeout = setTimeout(() => request.abort(), 8_000);
    try {
      const remote = readAppRelease(await env.fetchRelease(request.signal));
      if (disposed || request.signal.aborted) return;
      // Read all safety state again AFTER the request: a form may have opened.
      if (!remote) {
        if (!env.cashHandover) pending = false;
        env.observe?.('check_failed');
        return pending ? undefined : true;
      }
      pending = identity(remote) !== identity(current);
      if (!pending) { env.observe?.('current'); return true; }
      if (!env.visible()) return;
      if (!env.safe()) { waitingForSafeScreen = Boolean(env.cashHandover); env.observe?.(env.blockedReason?.() ?? 'operation'); return; }
      const target = identity(remote);
      let previous: UpdateAttempt | null;
      try { previous = env.readAttempt(); } catch { env.observe?.('storage_failed'); return; }
      const commandId = env.commandId?.();
      const matching = previous?.target === target && previous?.commandId === commandId;
      if (matching && (previous!.count ?? 1) >= 2) { env.observe?.('reload_failed'); return; }
      if (previous?.target === target && env.now() - previous.at < 300_000) { env.observe?.('retry_wait'); return; }
      // Persist before navigating. If storage fails, defer rather than risk a reload loop.
      try { env.saveAttempt({ target, at: env.now(), count: matching ? (previous!.count ?? 1) + 1 : 1, ...(commandId ? { commandId } : {}) }); }
      catch { env.observe?.('storage_failed'); return; }
      resume?.();
      reloading = true;
      env.observe?.('reloading');
      env.reload();
    } catch {
      if (!disposed) env.observe?.('check_failed');
      if (!disposed && !pending) return true;
      // Offline, timeout, invalid JSON or storage unavailable: keep the working screen.
    } finally {
      clearTimeout(timeout);
      controller = null;
    }
  };
  const check = (onReload?: () => void, force = false) => {
    if (inFlight && !onReload) return Promise.resolve(undefined);
    if (onReload) resume = onReload;
    if (!inFlight) inFlight = perform(force || Boolean(onReload)).finally(() => { inFlight = undefined; resume = undefined; });
    return inFlight;
  };
  return {
    check,
    retry: () => pending && env.visible() && env.safe() ? check(undefined, waitingForSafeScreen) : Promise.resolve(),
    dispose: () => { disposed = true; controller?.abort(); },
  };
}
