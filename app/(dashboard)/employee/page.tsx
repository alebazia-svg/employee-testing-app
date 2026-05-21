import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default async function Employee() {
  const user = await getCurrentUser();
  const tests = await prisma.test.findMany();
  const results = user ? await prisma.result.findMany({ where: { userId: user.id } }) : [];

  return (
    <main className='mx-auto max-w-7xl space-y-6 p-4 md:p-8'>
      <header className='flex items-center rounded-2xl border border-border/80 bg-white/90 px-4 py-3 shadow-sm'>
        <div className='flex items-center gap-3'>
          <Image src='/logo.png' alt='OFFONIKA logo' width={30} height={30} className='h-7 w-7' />
          <h1 className='text-lg font-bold text-slate-800 md:text-xl'>OFFONIKA · Кабинет сотрудника</h1>
        </div>
      </header>

      <div className='grid gap-4 md:grid-cols-2'>
        {tests.map((t) => {
          const res = results.find((r) => r.testId === t.id);
          return (
            <Card key={t.id} className='space-y-3'>
              <p className='text-lg font-semibold text-slate-800'>{t.title}</p>
              <p className='text-sm text-slate-500'>Проходной балл: {t.passingScore}%</p>
              {res ? (
                <>
                  <Progress value={res.percent} />
                  <Badge className={res.status === 'Сдал' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
                    {res.status} · {res.percent}%
                  </Badge>
                </>
              ) : (
                <Badge className='bg-slate-100 text-slate-700'>Не пройден</Badge>
              )}
              <Link href={`/employee/tests/${t.id}`}>
                <Button>Пройти тест</Button>
              </Link>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
