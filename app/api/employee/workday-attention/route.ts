import { getCurrentUser } from '@/lib/auth';
import { loadEmployeeAttention } from '@/lib/employee-attention-snapshot';
export const dynamic = 'force-dynamic';
export async function GET() {
  // Read current authorized work independently of notification delivery/read state.
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Требуется вход' }, { status: 401 });
  if (user.role !== 'EMPLOYEE') return new Response(null, { status: 403 });
  return Response.json(await loadEmployeeAttention(user), { headers: { 'Cache-Control': 'no-store' } });
}
