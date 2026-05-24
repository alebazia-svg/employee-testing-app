import Link from 'next/link';
import { CheckCircle, ChevronRight, XCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';

export default async function AdminResultsPage() {
  const results = await prisma.result.findMany({
    include: { user: true, attestation: true },
    orderBy: { date: 'desc' },
  });

  return (
    <AdminShell>
      <div className='mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <h1 className='text-2xl font-bold text-slate-900'>Результаты</h1>
          <p className='text-sm text-slate-500'>Итоги прохождения аттестаций сотрудниками.</p>
        </div>
        <div className='flex gap-2'>
          <select className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-700'>
            <option>Все аттестации</option>
          </select>
          <select className='rounded-lg border border-border bg-white px-3 py-2 text-sm text-slate-700'>
            <option>Все сотрудники</option>
          </select>
        </div>
      </div>

      <Card className='p-0'>
        <Table>
          <thead className='bg-slate-50 text-slate-500'>
            <tr className='text-left'>
              <th className='px-5 py-4'>Сотрудник</th>
              <th className='px-5 py-4'>Аттестация</th>
              <th className='px-5 py-4'>Результат</th>
              <th className='px-5 py-4'>Статус</th>
              <th className='px-5 py-4'>Дата</th>
              <th className='px-5 py-4'>Ошибок</th>
              <th className='px-5 py-4'></th>
            </tr>
          </thead>
          <tbody>
            {results.map((result) => (
              <tr key={result.id} className='border-t border-border/70'>
                <td className='px-5 py-4 font-medium text-slate-900'>{result.user.name}</td>
                <td className='px-5 py-4 text-slate-700'>{result.attestation.title}</td>
                <td className='px-5 py-4 font-semibold text-slate-900'>{result.percent}%</td>
                <td className='px-5 py-4'>
                  <Badge className={result.status === 'Сдал' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
                    {result.status === 'Сдал' ? <CheckCircle className='mr-1 inline h-3.5 w-3.5' /> : <XCircle className='mr-1 inline h-3.5 w-3.5' />}
                    {result.status}
                  </Badge>
                </td>
                <td className='px-5 py-4 text-slate-600'>{new Date(result.date).toLocaleDateString('ru-RU')}</td>
                <td className='px-5 py-4 text-slate-700'>{result.mistakes}</td>
                <td className='px-5 py-4'>
                  <Link href={`/admin/results/${result.id}`} className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900'>
                    <ChevronRight className='h-4 w-4' />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        {!results.length && <p className='p-5 text-sm text-slate-500'>Пока нет результатов прохождения аттестаций.</p>}
      </Card>
    </AdminShell>
  );
}
