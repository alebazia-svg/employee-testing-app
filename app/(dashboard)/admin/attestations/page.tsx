import Link from 'next/link';
import { ClipboardList, Layers, Pencil, Target, Trash2 } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { attestationStatusLabel, attestationTypeLabel } from '@/lib/test-format';
import CreateAttestation from './CreateAttestation';

export default async function AdminAttestationsPage() {
  const attestations = await prisma.attestation.findMany({
    include: { sections: { include: { questions: true } } },
    orderBy: { id: 'asc' },
  });

  return (
    <AdminShell>
      <div className='mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Аттестации</h1>
          <p className='text-sm text-slate-500'>Список аттестаций, статусы и структура разделов.</p>
        </div>
        <CreateAttestation />
      </div>

      <Card className='p-0'>
        <Table>
          <thead className='bg-slate-50 text-slate-500'>
            <tr className='text-left'>
              <th className='px-5 py-4'>Название</th>
              <th className='px-5 py-4'>Разделов</th>
              <th className='px-5 py-4'>Вопросов</th>
              <th className='px-5 py-4'>Проходной балл</th>
              <th className='px-5 py-4'>Статус</th>
              <th className='px-5 py-4'>Тип</th>
              <th className='px-5 py-4'>Действия</th>
            </tr>
          </thead>
          <tbody>
            {attestations.map((attestation) => {
              const questionCount = attestation.sections.reduce((sum, section) => sum + section.questions.length, 0);
              return (
                <tr key={attestation.id} className='border-t border-border/70'>
                  <td className='px-5 py-4'>
                    <div className='flex items-center gap-3'>
                      <div className='flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-700'>
                        <ClipboardList className='h-5 w-5' />
                      </div>
                      <Link href={`/admin/attestations/${attestation.id}`} className='font-semibold text-slate-900 hover:text-green-700'>
                        {attestation.title}
                      </Link>
                    </div>
                  </td>
                  <td className='px-5 py-4 text-slate-700'><Layers className='mr-2 inline h-4 w-4 text-green-700' />{attestation.sections.length}</td>
                  <td className='px-5 py-4 text-slate-700'>{questionCount}</td>
                  <td className='px-5 py-4 text-slate-700'><Target className='mr-2 inline h-4 w-4 text-green-700' />{attestation.passingScore}%</td>
                  <td className='px-5 py-4'>
                    <Badge className={attestation.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-700'}>
                      {attestationStatusLabel(attestation.status)}
                    </Badge>
                  </td>
                  <td className='px-5 py-4'><Badge className='bg-slate-100 text-slate-700'>{attestationTypeLabel(attestation.type)}</Badge></td>
                  <td className='px-5 py-4'>
                    <div className='flex gap-2'>
                      <Link href={`/admin/attestations/${attestation.id}`}>
                        <Button className='h-9 w-9 bg-white p-0 text-slate-700 ring-1 ring-border hover:bg-slate-50 hover:text-slate-900'>
                          <Pencil className='h-4 w-4' />
                        </Button>
                      </Link>
                      <Button disabled className='h-9 w-9 bg-white p-0 text-slate-400 ring-1 ring-border'>
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </AdminShell>
  );
}
