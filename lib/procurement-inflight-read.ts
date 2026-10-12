/** Coalesce identical concurrent reads only. Never keep a settled value (or error),
 * and never let one consumer mutate another consumer's evidence. Not a TTL cache. */
export function createInFlightRead<T>() {
  const pending = new Map<string, Promise<T>>();
  return async (key: string, read: () => Promise<T>): Promise<T> => {
    let work = pending.get(key);
    if (!work) {
      work = Promise.resolve().then(read);
      pending.set(key, work);
      const cleanup = () => { if (pending.get(key) === work) pending.delete(key); };
      // Using both handlers avoids an unhandled rejected promise from finally().
      void work.then(cleanup, cleanup);
    }
    return structuredClone(await work);
  };
}
