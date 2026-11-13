type ScrollLock = { count: number; overflow: string };
const locks = new WeakMap<HTMLElement, ScrollLock>();

/** Keep overlapping dialogs locked until their last owner closes. */
export function lockBodyScroll(body = document.body): () => void {
  let lock = locks.get(body);
  if (!lock) {
    lock = { count: 0, overflow: body.style.overflow };
    locks.set(body, lock);
    body.style.overflow = 'hidden';
  }
  lock.count++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--lock.count === 0) {
      body.style.overflow = lock.overflow;
      locks.delete(body);
    }
  };
}
