import { getCurrentUser } from '@/lib/auth';
import { deliveryUserAllowed } from '@/lib/procurement-delivery-policy';
import { deliveryMappedUser, loadDeliveryView, syncDeliveryReminder } from '@/lib/procurement-delivery-reminders';

async function allowed() {
  const user = await getCurrentUser();
  if (!user) return { error: 'Необходим вход', status: 401 } as const;
  if (!deliveryUserAllowed(user)) return { error: 'Нет доступа', status: 403 } as const;
  const mapped = await deliveryMappedUser();
  return mapped.id === user.id ? null : { error: 'Нет доступа', status: 403 } as const;
}
export async function GET() {
  try {
    const denied = await allowed();
    if (denied) return Response.json({ error: denied.error }, { status: denied.status });
    return Response.json(await loadDeliveryView(), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Не удалось обновить подотчёт. Повторите позже.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  // Reject cross-origin browser submissions; no IDs/amounts/cashboxes accepted from the client.
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try {
    // Next.js may reconstruct request.url with the internal reverse-proxy host.
    const originUrl = new URL(origin || '');
    sameOrigin = ['http:', 'https:'].includes(originUrl.protocol)
      && originUrl.host === (request.headers.get('host') || new URL(request.url).host);
  } catch { /* No opaque/malformed origin is accepted. */ }
  if (!sameOrigin) return Response.json({ error: 'Обновите страницу перед отправкой.' }, { status: 403 });
  try {
    const denied = await allowed();
    if (denied) return Response.json({ error: denied.error }, { status: denied.status });
    return Response.json(await syncDeliveryReminder(true), { headers: { 'Cache-Control': 'no-store' } });
  } catch { return Response.json({ error: 'Не удалось подтвердить отправку. Обновите блок: повторный запрос не создаст дубль.' }, { status: 503 }); }
}
