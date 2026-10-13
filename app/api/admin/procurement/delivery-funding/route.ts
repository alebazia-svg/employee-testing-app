import { cashboxShifts } from '@/lib/procurement-cashbox-shifts';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { getCashFundingContext } from '@/lib/one-c';
import { DELIVERY_PERSON } from '@/lib/procurement-delivery-policy';
import { deliveryFundingFromEvidence } from '@/lib/procurement-delivery-funding';
import { deliveryFundingForTopup } from '@/lib/procurement-delivery-reserve';
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
    const data = deliveryFundingForTopup(deliveryFundingFromEvidence(raw), mappings.map(m => m.oneCCashboxRef));
    const shifts = await cashboxShifts(data.cashboxes.filter(box => !box.manualOnly).map(box => box.ref));
    return Response.json({ ...data, cashboxes: data.cashboxes.map(box => ({ ...box, shift: box.manualOnly ? box.shift : shifts.get(box.ref) })) }, { headers });
  } catch {
    return Response.json({ error: 'Не удалось проверить кассы и заявки. Данные обновятся автоматически.' }, { status: 503, headers });
  }
}
