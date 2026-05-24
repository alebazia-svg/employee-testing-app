import { prisma } from '@/lib/prisma';

export async function GET() {
  const attestations = await prisma.attestation.findMany({
    include: { sections: { include: { questions: true }, orderBy: { order: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  return Response.json(attestations);
}

export async function POST(req: Request) {
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
