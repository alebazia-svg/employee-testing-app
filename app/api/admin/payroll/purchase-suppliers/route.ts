import { requireAdminApi } from '@/lib/admin-api-auth';
import { normalizePayrollSupplierName } from '@/lib/payroll-purchase-suppliers';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function readSupplierName(value: unknown) {
  if (typeof value !== 'string') return '';
  const supplierName = value.trim().replace(/\s+/g, ' ');
  if (!supplierName || supplierName.length > 200 || /[\u0000-\u001f\u007f]/.test(supplierName)) return '';
  return supplierName;
}

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const rules = await prisma.payrollPurchaseSupplierRule.findMany({
    orderBy: [{ isActive: 'desc' }, { supplierName: 'asc' }],
  });
  return Response.json({ ok: true, rules });
}

export async function POST(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const payload = await request.json().catch(() => null) as { supplierName?: unknown; isActive?: unknown } | null;
  const supplierName = readSupplierName(payload?.supplierName);
  if (!supplierName || typeof payload?.isActive !== 'boolean') {
    return Response.json({ error: 'Укажите поставщика и решение по нему.' }, { status: 400 });
  }
  const normalizedName = normalizePayrollSupplierName(supplierName);
  const rule = await prisma.payrollPurchaseSupplierRule.upsert({
    where: { normalizedName },
    create: {
      supplierName,
      normalizedName,
      isActive: payload.isActive,
      source: 'admin-decision',
      createdByUserId: access.user.id,
      updatedByUserId: access.user.id,
    },
    update: {
      supplierName,
      isActive: payload.isActive,
      source: 'admin-decision',
      updatedByUserId: access.user.id,
    },
  });
  return Response.json({ ok: true, rule });
}
