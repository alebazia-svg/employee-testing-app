import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { generateEmployeePassword, passwordValidationError, passwordRequestAllowed } from '@/lib/password-access';
import { Prisma } from '@prisma/client';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { parsePayrollEmployeeRuleInput, PayrollEmployeeRuleValidationError } from '@/lib/payroll-employee-rules';

const employeeSelect = {
  id: true, name: true, login: true, role: true, sessionVersion: true, department: true, isActive: true, payrollName: true,
  payrollSalaryType: true, payrollReportGroup: true, payrollFixedSalary: true, payrollRuleFrom: true, payrollRuleThrough: true,
  portalArea: true, oneCManagerName: true,
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
  if (!passwordRequestAllowed(req)) return Response.json({ error: 'Недопустимый запрос.' }, { status: 403 });
  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return Response.json({ error: 'Некорректный запрос.' }, { status: 400 }); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return Response.json({ error: 'Некорректный запрос.' }, { status: 400 });
  const { name, login, password, role, department, isActive, payrollName, portalArea, oneCManagerName } = payload as {
    name?: string; login?: string; password?: string; role?: string; department?: string; isActive?: boolean; payrollName?: string; portalArea?: string; oneCManagerName?: string;
  };
  if (typeof name !== 'string' || !name.trim() || typeof login !== 'string' || !login.trim()) {
    return Response.json({ error: 'Заполните имя и логин' }, { status: 400 });
  }

  const accountRole = role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE';
  const issuedPassword = password || generateEmployeePassword(accountRole);
  const passwordError = passwordValidationError(issuedPassword, accountRole);
  if (passwordError) return Response.json({ error: passwordError }, { status: 400 });
  try {
    const payrollRule = parsePayrollEmployeeRuleInput(payload);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        login: login.trim(),
        passwordHash: await bcrypt.hash(issuedPassword, 12),
        passwordResetAt: new Date(), passwordResetById: access.user.id,
        role: accountRole,
        department: typeof department === 'string' ? department : 'retail',
        isActive: typeof isActive === 'boolean' ? isActive : true,
        payrollName: typeof payrollName === 'string' && payrollName.trim() ? payrollName.trim() : null,
        portalArea: role === 'ADMIN' ? 'WORKDAY' : portalArea === 'PROCUREMENT' ? 'PROCUREMENT' : 'WORKDAY',
        oneCManagerName: portalArea === 'PROCUREMENT' && typeof oneCManagerName === 'string' && oneCManagerName.trim() ? oneCManagerName.trim() : null,
        ...payrollRule,
      },
      select: employeeSelect,
    });

    return Response.json({ ...user, issuedAccess: { userId: user.id, name: user.name, login: user.login, password: issuedPassword, sessionVersion: user.sessionVersion } }, { headers: { 'Cache-Control': 'no-store, private' } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json({ error: 'Пользователь с таким логином уже существует' }, { status: 409 });
    }
    if (error instanceof PayrollEmployeeRuleValidationError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}
