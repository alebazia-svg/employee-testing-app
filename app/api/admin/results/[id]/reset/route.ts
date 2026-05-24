import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== 'ADMIN') return Response.json({ error: 'Forbidden' }, { status: 403 });

  const result = await prisma.result.findUnique({ where: { id: Number(params.id) } });
  if (!result) return Response.json({ error: 'Результат не найден' }, { status: 404 });

  await prisma.$transaction([
    prisma.attemptReset.create({
      data: {
        userId: result.userId,
        attestationId: result.attestationId,
        resetById: admin.id,
      },
    }),
    prisma.attemptProgress.deleteMany({ where: { userId: result.userId, attestationId: result.attestationId } }),
    prisma.result.delete({ where: { id: result.id } }),
  ]);

  return Response.json({ ok: true });
}
