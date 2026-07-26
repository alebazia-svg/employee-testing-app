import { getAdminWorkdayRevision } from '@/lib/admin-workday-revision';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
};

function isDateKey(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });
  if (user.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403, headers: noStoreHeaders });

  const date = new URL(req.url).searchParams.get('date');
  if (!isDateKey(date)) return Response.json({ error: 'Invalid date' }, { status: 400, headers: noStoreHeaders });

  const revision = await getAdminWorkdayRevision(date);
  return Response.json({ revision }, { headers: noStoreHeaders });
}
