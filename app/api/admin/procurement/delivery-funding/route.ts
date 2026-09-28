import { requireAdminApi } from '@/lib/admin-api-auth';
import { getCashFundingContext } from '@/lib/one-c';
import { DELIVERY_PERSON } from '@/lib/procurement-delivery-policy';
import { deliveryFundingFromEvidence, deliveryFundingForManagerCashboxes } from '@/lib/procurement-delivery-funding';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const [raw, mappings] = await Promise.all([
      getCashFundingContext(DELIVERY_PERSON.organizationRef),
      prisma.userOneCCashboxMapping.findMany({
        where: { isActive: true, user: { isActive: true, role: 'EMPLOYEE', portalArea: 'WORKDAY', department: { in: ['retail', 'wholesale'] } } },
        select: { oneCCashboxRef: true },
      }),
    ]);
    return Response.json(deliveryFundingForManagerCashboxes(deliveryFundingFromEvidence(raw), mappings.map(m => m.oneCCashboxRef)), { headers });
  } catch {
    return Response.json({ error: 'Не удалось проверить кассы и заявки. Данные обновятся автоматически.' }, { status: 503, headers });
  }
}
