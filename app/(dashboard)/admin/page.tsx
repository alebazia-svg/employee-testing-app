import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table } from '@/components/ui/table';
import AdminClient from './AdminClient';

export default async function Admin() {
  const tests = await prisma.test.findMany({ include: { questions: true } });
  const results = await prisma.result.findMany({ include: { user: true, test: true }, orderBy: { date: 'desc' } });

  return (
    <main className='mx-auto max-w-7xl space-y-6 p-4 md:p-8'>
      <header className='flex items-center justify-between rounded-2xl border border-border/80 bg-white/90 px-4 py-3 shadow-sm'>
        <div className='flex items-center gap-3'>
          <Image src='/logo.png' alt='OFFONIKA logo' width={30} height={30} className='h-7 w-7' />
          <h1 className='text-lg font-bold text-slate-800 md:text-xl'>OFFONIKA · Панель администратора</h1>
        </div>
      </header>

      <Card>
        <h2 className='mb-3 text-lg font-semibold text-slate-800'>Тесты</h2>
        <div className='grid gap-3 md:grid-cols-2'>
          {tests.map((t) => (
            <div key={t.id} className='rounded-xl border border-border/80 bg-slate-50/70 p-4'>
              <p className='font-semibold text-slate-800'>{t.title}</p>
              <p className='text-sm text-slate-500'>Проходной балл: {t.passingScore}%</p>
              <Badge className='mt-2 inline-block bg-green-100 text-green-800'>{t.questions.length} вопросов</Badge>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h2 className='mb-3 text-lg font-semibold text-slate-800'>Управление</h2>
        <AdminClient />
      </Card>

      <Card>
        <h2 className='mb-3 text-lg font-semibold text-slate-800'>Результаты сотрудников</h2>
        <Table>
          <thead className='bg-slate-50 text-slate-600'>
            <tr className='text-left'>
              <th className='px-3 py-2'>Сотрудник</th><th className='px-3 py-2'>Тест</th><th className='px-3 py-2'>Дата</th><th className='px-3 py-2'>%</th><th className='px-3 py-2'>Статус</th><th className='px-3 py-2'>Ошибки</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className='border-t border-border/70'>
                <td className='px-3 py-2'>{r.user.login}</td><td className='px-3 py-2'>{r.test.title}</td><td className='px-3 py-2'>{new Date(r.date).toLocaleDateString('ru-RU')}</td><td className='px-3 py-2'>{r.percent}</td>
                <td className='px-3 py-2'><Badge className={r.status === 'Сдал' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>{r.status}</Badge></td><td className='px-3 py-2'>{r.mistakes}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </main>
  );
}
