import { prisma } from '@/lib/prisma';
import { requireAdminApi } from '@/lib/admin-api-auth';

export async function GET() {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const attestations = await prisma.attestation.findMany({
    include: { sections: { include: { questions: true }, orderBy: { order: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  return Response.json(attestations);
}

export async function POST(req: Request) {
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const body = await req.json();
  const attestation = await prisma.attestation.create({
    data: {
      title: body.title,
      passingScore: Number(body.passingScore),
      status: body.status,
      type: body.type,
    },
  });

  return Response.json(attestation);
}
