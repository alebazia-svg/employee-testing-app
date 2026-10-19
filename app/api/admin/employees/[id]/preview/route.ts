import { requireAdminApi } from '@/lib/admin-api-auth';
import { prisma } from '@/lib/prisma';
import { passwordRequestAllowed } from '@/lib/password-access';
import { employeePreviewHeaders as headers, employeePreviewLifetimeMs, previewEmployeeAllowed } from '@/lib/employee-preview';
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  if (!passwordRequestAllowed(req)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403, headers });
  const id = Number((await context.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return Response.json({ error: 'Некорректный сотрудник' }, { status: 400, headers });
  const employee = await prisma.user.findUnique({ where: { id } });
  if (!employee || !previewEmployeeAllowed(employee)) return Response.json({ error: 'Просмотр доступен для активных сотрудников рабочего дня и закупок.' }, { status: 409, headers });
  const visit = await prisma.employeePreviewVisit.create({ data: { adminId: auth.user.id, employeeId: id, adminName: auth.user.name, employeeName: employee.name, expiresAt: new Date(Date.now() + employeePreviewLifetimeMs) } });
  return Response.json({ href: `/admin/employees/preview/${visit.id}` }, { headers });
}
