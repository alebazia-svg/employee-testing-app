/** A successful HTTP response alone is not confirmation of an active subscription. */
export async function savePushSubscription(url: string, subscription: PushSubscription) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription), signal: controller.signal });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.ok !== true || result?.active !== true || !Number.isSafeInteger(result?.id) || result.id <= 0) {
      throw new Error('Подключение не подтверждено. Нажмите «Подключить уведомления» ещё раз.');
    }
    return result as { ok: true; active: true; id: number; accessSynced: boolean };
  } catch (error) {
    if (controller.signal.aborted || error instanceof TypeError) {
      throw new Error('Не удалось подтвердить подключение. Проверьте интернет и повторите попытку.');
    }
    throw error;
  } finally { clearTimeout(timeout); }
}
