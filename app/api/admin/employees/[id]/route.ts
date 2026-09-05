import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { parsePayrollEmployeeRuleInput, PayrollEmployeeRuleValidationError } from '@/lib/payroll-employee-rules';

const employeeSelect = {
  id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true,
  payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true,
} as const;

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const payload = await req.json() as Record<string, unknown>;
  const { name, login, password, role, department, isActive, payrollName } = payload as {
    name?: string; login?: string; password?: string; role?: string; department?: string; isActive?: boolean; payrollName?: string;
  };
  const userId = Number(params.id);
  if (!name?.trim() || !login?.trim()) {
    return Response.json({ error: 'Заполните имя и логин' }, { status: 400 });
  }

  if (role !== 'ADMIN') {
    const current = await prisma.user.findUnique({ where: { id: userId } });
    if (current?.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return Response.json({ error: 'Нельзя убрать роль у последнего администратора' }, { status: 400 });
      }
    }
  }

  try {
    const payrollRule = parsePayrollEmployeeRuleInput(payload);
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name.trim(),
        login: login.trim(),
        role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
        department: typeof department === 'string' ? department : 'retail',
        isActive: typeof isActive === 'boolean' ? isActive : true,
        payrollName: typeof payrollName === 'string' && payrollName.trim() ? payrollName.trim() : null,
        ...payrollRule,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
      select: employeeSelect,
    });

    return Response.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ error: 'Пользователь с таким логином уже существует' }, { status: 409 });
    }
    if (error instanceof PayrollEmployeeRuleValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(_: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const userId = Number(params.id);
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (user?.role === 'ADMIN') {
    const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
    if (adminCount <= 1) {
      return Response.json({ error: 'Нельзя удалить последнего администратора' }, { status: 400 });
    }
  }

  await prisma.user.delete({ where: { id: userId } });

  return Response.json({ ok: true });
}
