// One attempt remains the default for existing diagnostics. AUSN export opts
// into bounded retries for transport failures, never for HTTP rejection.
export async function fetchSabyOfdJson(url: string, init: RequestInit, timeoutMs: number, requestedAttempts = 1) {
  const attempts = Math.min(3, Math.max(1, Math.trunc(requestedAttempts) || 1));
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
      const text = await response.text();
      let data: unknown = null;
      if (text) {
        try { data = JSON.parse(text); }
        catch { data = { text: text.slice(0, 500) }; }
      }
      return { response, data };
    } catch (error) {
      const retryable = error instanceof Error && (['AbortError', 'TimeoutError'].includes(error.name) || (error instanceof TypeError && error.message === 'fetch failed'));
      if (!retryable || attempt + 1 >= attempts) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 250 * (attempt + 1)));
  }
  throw new Error('Saby transport attempts exhausted');
}
