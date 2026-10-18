/** Optional browser APIs must never hold the activity/version report forever. */
export async function observationWithin<T>(read: () => Promise<T>, fallback: T, timeoutMs = 1500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(read).catch(() => fallback),
      new Promise<T>(resolve => { timer = setTimeout(() => resolve(fallback), timeoutMs); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
}
