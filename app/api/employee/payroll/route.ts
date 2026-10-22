import { getCurrentUser } from '@/lib/auth';
import { employeePayrollResponse } from '@/lib/employee-payroll-response';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return employeePayrollResponse(await getCurrentUser(), new URL(request.url).searchParams);
}
