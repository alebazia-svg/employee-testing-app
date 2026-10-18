import { getCurrentAdmin } from '@/lib/auth';
import { requestAppUpdate } from '@/lib/portal-app-update-server';

export async function POST(req: Request) {
  if (req.headers.get('sec-fetch-site') !== 'same-origin') return Response.json({ error: 'Forbidden' }, { status: 403 });
  const admin = await getCurrentAdmin();
  if (!admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const raw = await req.text();
  if (raw.length > 256) return Response.json({ error: 'Invalid input' }, { status: 400 });
  let body; try { body = JSON.parse(raw); } catch { return Response.json({ error: 'Invalid input' }, { status: 400 }); }
  if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || typeof body.sessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(body.sessionId)) return Response.json({ error: 'Invalid input' }, { status: 400 });
  try {
    const result = await requestAppUpdate(body.sessionId, admin.id);
    // Only safe progress; client identifiers and administrator IDs stay server-side.
    return Response.json('command' in result ? { ok: true, requestedAt: result.command!.requestedAt } : { error: result.error }, { status: result.status });
  } catch { return Response.json({ error: 'Не удалось сохранить запрос обновления. Повторите позже.' }, { status: 503 }); }
}
