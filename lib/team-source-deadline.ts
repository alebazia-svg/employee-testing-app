export function boundedTeamRead<T>(task: (signal: AbortSignal) => Promise<T>, timeoutMs = 12_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); reject(new Error('Google source timeout')); }, timeoutMs);
    Promise.resolve().then(() => task(controller.signal)).then(resolve, reject).finally(() => clearTimeout(timeout));
  });
}
