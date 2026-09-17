import { requireAdminApi } from '@/lib/admin-api-auth';
import { decideApprovedRevision } from '@/lib/procurement-plan-revision-server';
export async function POST(req: Request, props: {params: Promise<{id: string}>}) {
  const access = await requireAdminApi(); if (!access.ok) return access.response;
  const body = await req.json().catch(() => null);
  if (!body || !['APPROVE','REJECT'].includes(body.action) || typeof body.revisionId !== 'string') return Response.json({error:'Выберите решение.'},{status:400});
  try { return Response.json(await decideApprovedRevision((await props.params).id, access.user.id, body.revisionId, body.action === 'APPROVE', String(body.reason || ''))); }
  catch(error) { return Response.json({error:error instanceof Error && /^[А-ЯЁ]/.test(error.message) ? error.message : 'Не удалось сохранить решение.'},{status:409}); }
}
