import Link from 'next/link';
import { CheckCircle, ChevronRight, Clock, Star, XCircle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { AdminShell } from '@/components/AdminShell';
import { AdminBreadcrumbs } from '@/components/AdminBreadcrumbs';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';

export default async function AdminResultsPage() {
  const results = await prisma.result.findMany({
    include: { user: true, attestation: true },
    orderBy: { date: 'desc' },
  });
  const passedCount = results.filter((result) => result.status === 'Сдал').length;
  const failedCount = results.filter((result) => result.status === 'Не сдал').length;
  const reviewCount = results.filter((result) => result.status !== 'Сдал' && result.status !== 'Не сдал').length;
  const averageScore = results.length ? Math.round(results.reduce((sum, result) => sum + result.percent, 0) / results.length) : 0;

  return (
    <AdminShell>
      <div className='mb-7 flex flex-col gap-3 md:flex-row md:items-center md:justify-between'>
        <div>
          <AdminBreadcrumbs current='Результаты' />
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>Результаты</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Проверка и анализ результатов аттестаций</p>
        </div>
        <div className='flex gap-2'>
          <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'>
            <option>Все аттестации</option>
          </select>
          <select className='rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20'>
            <option>Все сотрудники</option>
          </select>
        </div>
      </div>

      <section className='mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
        {[
          { label: 'Пройдено', value: passedCount, icon: CheckCircle, tone: 'green' },
          { label: 'Не сдано', value: failedCount, icon: XCircle, tone: 'red' },
          { label: 'На проверке', value: reviewCount, icon: Clock, tone: 'amber' },
          { label: 'Средний балл', value: results.length ? `${averageScore}%` : '—', icon: Star, tone: 'blue' },
        ].map((item) => {
          const Icon = item.icon;
          const toneClass =
            item.tone === 'red'
              ? 'bg-red-100 text-red-600'
              : item.tone === 'amber'
                ? 'bg-amber-100 text-amber-600'
                : item.tone === 'blue'
                  ? 'bg-blue-100 text-blue-600'
                  : 'bg-green-100 text-primary';
          return (
            <Card key={item.label} className='flex items-center gap-4'>
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${toneClass}`}>
                <Icon className='h-6 w-6' />
              </div>
              <div>
                <p className='text-sm font-bold text-slate-600'>{item.label}</p>
                <p className='mt-1 text-2xl font-extrabold text-slate-950'>{item.value}</p>
              </div>
            </Card>
          );
        })}
      </section>

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
              <tr key={result.id} className='border-t border-slate-200/80'>
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
        {!results.length && <p className='p-5 text-sm text-slate-500'>Нет данных для отображения.</p>}
      </Card>
    </AdminShell>
  );
}
