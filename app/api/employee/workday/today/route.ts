import { getCurrentUser } from '@/lib/auth';
import { getEmployeeWorkdaySnapshot } from '@/lib/employee-workday-snapshot';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const noStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  const snapshot = await getEmployeeWorkdaySnapshot({ id: user.id, department: user.department });
  return Response.json(snapshot, { headers: noStoreHeaders });
}
