import { prisma } from '@/lib/prisma';
import { parseOptions } from '@/lib/attestation';
import { requireAdminApi } from '@/lib/admin-api-auth';

export async function POST(req: Request, props: { params: Promise<{ sectionId: string }> }) {
  const params = await props.params;
  const access = await requireAdminApi();
  if (!access.ok) return access.response;
  const body = await req.json();
  const sectionId = Number(params.sectionId);
  const count = await prisma.question.count({ where: { sectionId } });
  const question = await prisma.question.create({
    data: {
      sectionId,
      text: body.text,
      options: JSON.stringify(body.options),
      correctIndex: Number(body.correctIndex),
      order: count,
    },
  });

  return Response.json({ ...question, options: parseOptions(question.options) });
}
