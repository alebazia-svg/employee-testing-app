import { requireAdminApi } from '@/lib/admin-api-auth';
import { readExpenseAttention, readSupplierPaymentAttention } from '@/lib/admin-payment-attention-data';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };

export async function GET(request: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return new Response(access.response.body, { status: access.response.status, headers });
  const section = new URL(request.url).searchParams.get('section');
  if (section === 'expenses') return Response.json(await readExpenseAttention(), { headers });
  if (section === 'suppliers') return Response.json(await readSupplierPaymentAttention(), { headers });
  return Response.json(null, { status: 400, headers });
}
