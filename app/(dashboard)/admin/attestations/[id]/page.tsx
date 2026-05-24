import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import AttestationEditor from './AttestationEditor';

export default async function AdminAttestationPage({ params }: { params: { id: string } }) {
  const attestation = await prisma.attestation.findUnique({
    where: { id: Number(params.id) },
    include: {
      sections: {
        orderBy: { order: 'asc' },
        include: { questions: { orderBy: { order: 'asc' } } },
      },
    },
  });

  if (!attestation) {
    return (
      <AdminShell>
        <p className='text-slate-700'>Аттестация не найдена.</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <AttestationEditor
        attestation={{
          id: attestation.id,
          title: attestation.title,
          passingScore: attestation.passingScore,
          status: attestation.status,
          type: attestation.type,
          sections: attestation.sections.map((section) => ({
            id: section.id,
            title: section.title,
            questions: section.questions.map((question) => ({
              id: question.id,
              text: question.text,
              options: JSON.parse(question.options) as string[],
              correctIndex: question.correctIndex,
            })),
          })),
        }}
      />
    </AdminShell>
  );
}
