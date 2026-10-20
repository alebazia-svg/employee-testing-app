import { getCurrentUser } from '@/lib/auth';
import { readNotificationDetail } from '@/lib/notification-detail-reader';
export async function GET(_request: Request, { params }: { params: Promise<{ audience: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !user.isActive) return Response.json({ error: 'Войдите в портал заново.' }, { status: 401 });
  const { audience, id } = await params;
  return readNotificationDetail(user, audience, id);
}
