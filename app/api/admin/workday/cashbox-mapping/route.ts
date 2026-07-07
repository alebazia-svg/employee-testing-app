import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getCashStatementDimensions } from '@/lib/one-c';
import { prisma } from '@/lib/prisma';
import { usesWorkdayShiftControl } from '@/lib/workday';

function redirectWithStatus(req: Request, redirectTo: string | null, key: 'cashboxMapping' | 'cashboxMappingError', value: string) {
  const target = new URL(redirectTo?.startsWith('/admin/workday') ? redirectTo : '/admin/workday', req.url);
  target.searchParams.set(key, value);
  return NextResponse.redirect(target);
}

export async function POST(req: Request) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const formData = await req.formData();
  const redirectTo = formData.get('redirectTo');
  const userId = Number(formData.get('userId'));
  const oneCCashboxRef = String(formData.get('oneCCashboxRef') ?? '').trim();

  if (!Number.isInteger(userId) || userId <= 0) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'invalid-user');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, department: true },
  });

  if (!user || !usesWorkdayShiftControl(user)) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'unsupported-user');
  }

  if (!oneCCashboxRef) {
    await prisma.userOneCCashboxMapping.deleteMany({ where: { userId } });
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMapping', 'cleared');
  }

  const dimensions = await getCashStatementDimensions();
  const cashbox = dimensions.cashboxes.find((item) => item.ref === oneCCashboxRef);

  if (!dimensions.ok || !cashbox) {
    return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMappingError', 'cashbox-not-found');
  }

  await prisma.userOneCCashboxMapping.upsert({
    where: { userId },
    create: {
      userId,
      oneCCashboxRef: cashbox.ref,
      oneCCashboxName: cashbox.name,
      isActive: true,
    },
    update: {
      oneCCashboxRef: cashbox.ref,
      oneCCashboxName: cashbox.name,
      isActive: true,
    },
  });

  return redirectWithStatus(req, typeof redirectTo === 'string' ? redirectTo : null, 'cashboxMapping', 'saved');
}
