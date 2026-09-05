import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { parsePayrollEmployeeRuleInput, PayrollEmployeeRuleValidationError } from '@/lib/payroll-employee-rules';

const employeeSelect = {
  id: true, name: true, login: true, role: true, department: true, isActive: true, payrollName: true,
  payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true,
} as const;

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const users = await prisma.user.findMany({
    orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { name: 'asc' }],
    select: employeeSelect,
  });

  return Response.json(users);
}

export async function POST(req: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const payload = await req.json() as Record<string, unknown>;
  const { name, login, password, role, department, isActive, payrollName } = payload as {
    name?: string; login?: string; password?: string; role?: string; department?: string; isActive?: boolean; payrollName?: string;
  };
  if (!name?.trim() || !login?.trim() || !password?.trim()) {
    return Response.json({ error: 'Заполните имя, логин и пароль' }, { status: 400 });
  }

  try {
    const payrollRule = parsePayrollEmployeeRuleInput(payload);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        login: login.trim(),
        passwordHash: await bcrypt.hash(password, 10),
        role: role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE',
        department: typeof department === 'string' ? department : 'retail',
        isActive: typeof isActive === 'boolean' ? isActive : true,
        payrollName: typeof payrollName === 'string' && payrollName.trim() ? payrollName.trim() : null,
        ...payrollRule,
      },
      select: employeeSelect,
    });

    return Response.json(user);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ error: 'Пользователь с таким логином уже существует' }, { status: 409 });
    }
    if (error instanceof PayrollEmployeeRuleValidationError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
