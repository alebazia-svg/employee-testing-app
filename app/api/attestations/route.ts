import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const attestations = await prisma.attestation.findMany({
    where: { status: 'ACTIVE' },
    include: {
      sections: { include: { questions: true }, orderBy: { order: 'asc' } },
      results: { where: { userId: user.id }, orderBy: { date: 'desc' } },
      progresses: { where: { userId: user.id } },
    },
    orderBy: { id: 'asc' },
  });

  return Response.json(attestations);
}
