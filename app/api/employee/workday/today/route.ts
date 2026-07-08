import { getCurrentUser } from '@/lib/auth';
import { getEmployeeWorkdaySnapshot } from '@/lib/employee-workday-snapshot';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const snapshot = await getEmployeeWorkdaySnapshot({ id: user.id, department: user.department });
  return Response.json(snapshot);
}
