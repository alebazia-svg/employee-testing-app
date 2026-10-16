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
export type UpdateAttempt = { target: string; at: number };
export type AppUpdateEnvironment = {
  now: () => number;
  visible: () => boolean;
  safe: () => boolean;
  fetchRelease: (signal: AbortSignal) => Promise<unknown>;
  readAttempt: () => UpdateAttempt | null;
  saveAttempt: (attempt: UpdateAttempt) => void;
  reload: () => void;
};

export function createEmployeeAppUpdater(current: AppRelease, env: AppUpdateEnvironment) {
  let pending = false;
  let disposed = false;
  let reloading = false;
  let lastCheck = -Infinity;
  let controller: AbortController | null = null;
  const check = async () => {
    if (disposed || reloading || controller || !env.visible() || env.now() - lastCheck < 15_000) return;
    lastCheck = env.now();
    controller = new AbortController();
    const request = controller;
    const timeout = setTimeout(() => request.abort(), 8_000);
    try {
      const remote = readAppRelease(await env.fetchRelease(request.signal));
      if (disposed || request.signal.aborted) return;
      pending = Boolean(remote && identity(remote) !== identity(current));
      // Read all safety state again AFTER the request: a form may have opened.
      if (!remote || !pending || !env.visible() || !env.safe()) return;
      const target = identity(remote);
      const previous = env.readAttempt();
      if (previous?.target === target && env.now() - previous.at < 300_000) return;
      // Persist before navigating. If storage fails, defer rather than risk a reload loop.
      env.saveAttempt({ target, at: env.now() });
      reloading = true;
      env.reload();
    } catch {
      // Offline, timeout, invalid JSON or storage unavailable: keep the working screen.
    } finally {
      clearTimeout(timeout);
      controller = null;
    }
  };
  return {
    check,
    retry: () => pending && env.visible() && env.safe() ? check() : Promise.resolve(),
    dispose: () => { disposed = true; controller?.abort(); },
  };
}
