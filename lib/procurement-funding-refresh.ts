/** Display state only; never relaxes payment verification or write guards. */
export function fundingRefreshState(input: {
  hasSnapshot: boolean;
  sameDay: boolean;
  complete: boolean;
  current: boolean;
  pending: boolean;
  failed: boolean;
  upstream: 'ready' | 'loading' | 'error';
}): 'ready' | 'refreshing' | 'stale' {
  if (!input.hasSnapshot || !input.sameDay || !input.complete || input.failed || input.upstream === 'error') return 'stale';
  if (input.upstream === 'loading' || input.pending) return 'refreshing';
  return input.current ? 'ready' : 'stale';
}
