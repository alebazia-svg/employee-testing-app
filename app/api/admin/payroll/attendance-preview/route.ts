import { requireAdminApi } from '@/lib/admin-api-auth';
import { readPayrollAttendance, refreshPayrollAttendance } from '@/lib/payroll-attendance-refresh';
import { withPayrollSourceLock } from '@/lib/payroll-source-lock';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  return readPayrollAttendance(request);
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const result = await withPayrollSourceLock(() => refreshPayrollAttendance(request));
  return result ?? Response.json({ error: 'Данные уже обновляются. Попробуйте чуть позже.' }, { status: 409 });
}
