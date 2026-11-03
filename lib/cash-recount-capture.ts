/** Immediate read only: never backfill a historical count with a later balance. */
export async function captureCashRecountWithRetry<T extends { personalCash: { status: string; error?: string | null } }>(
  capture: (deadline: number) => Promise<T>,
  now: () => number = Date.now,
) {
  const deadline = now() + 4000;
  const first = await capture(deadline);
  const transient = /timed? ?out|timeout|abort|fetch failed|network|ECONN|HTTP\D*5\d\d|временно|превышено время/i.test(first.personalCash.error ?? '');
  if (first.personalCash.status === 'captured' || !transient || deadline - now() < 100) return first;
  return capture(deadline);
}
