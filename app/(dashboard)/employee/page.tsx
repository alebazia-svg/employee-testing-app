import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Award, CheckCircle, ClipboardList, Info, Layers, Target } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { attestationTypeLabel, questionCountText, sectionCountText } from '@/lib/test-format';

export default async function Employee() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const attestations = await prisma.attestation.findMany({
    where: { status: 'ACTIVE' },
    include: {
      sections: { include: { questions: true }, orderBy: { order: 'asc' } },
      results: { where: { userId: user.id }, orderBy: { date: 'desc' } },
      progresses: { where: { userId: user.id } },
    },
    orderBy: { id: 'asc' },
  });

  return (
    <main className='mx-auto max-w-6xl space-y-5 p-4 md:p-6'>
      <header className='flex flex-col gap-3 rounded-lg border border-border/80 bg-white px-4 py-2.5 shadow-sm md:flex-row md:items-center md:justify-between'>
        <BrandBlock size='header' />
        <div className='flex items-center gap-3'>
          <div className='text-right text-sm'>
            <p className='font-semibold text-slate-800'>{user.name}</p>
            <p className='text-slate-500'>Сотрудник</p>
          </div>
          <div className='flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700'>
            {user.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className='space-y-1'>
        <h1 className='text-2xl font-bold text-slate-900'>Добро пожаловать, {user.name}!</h1>
        <p className='text-sm text-slate-500'>Вам доступна аттестация</p>
      </section>

      {attestations.map((attestation) => {
        const questionCount = attestation.sections.reduce((sum, section) => sum + section.questions.length, 0);
        const result = attestation.results[0];
        const hasProgress = Boolean(attestation.progresses[0]);

        return (
          <Card key={attestation.id} className='overflow-hidden p-0'>
            <div className='grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_230px] md:p-6'>
              <div className='space-y-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='flex items-start gap-4'>
                    <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100 text-green-700'>
                      <Award className='h-7 w-7' />
                    </div>
                    <div className='min-w-0'>
                      <h2 className='text-xl font-bold text-slate-900'>{attestation.title}</h2>
                      <Badge className='mt-2 inline-flex bg-green-100 text-green-800'>{attestationTypeLabel(attestation.type)}</Badge>
                    </div>
                  </div>
                  <Badge className='bg-green-100 text-green-800'>Доступна</Badge>
                </div>

                <div className='flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600'>
                  <span className='flex items-center gap-2'><Layers className='h-4 w-4 text-slate-700' />{sectionCountText(attestation.sections.length)}</span>
                  <span className='flex items-center gap-2'><ClipboardList className='h-4 w-4 text-slate-700' />{questionCountText(questionCount)}</span>
                  <span className='flex items-center gap-2'><Target className='h-4 w-4 text-slate-700' />Проходной балл: {attestation.passingScore}%</span>
                </div>

                <div>
                  <p className='mb-2 text-sm font-semibold text-slate-800'>Разделы аттестации:</p>
                  <div className='grid gap-1.5'>
                    {attestation.sections.map((section) => (
                      <div key={section.id} className='flex items-center gap-2 text-sm text-slate-700'>
                        <CheckCircle className='h-4 w-4 text-green-600' />
                        {section.title}
                      </div>
                    ))}
                  </div>
                </div>

                {result ? (
                  <div className='flex gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-slate-700'>
                    <Info className='mt-0.5 h-5 w-5 shrink-0 text-blue-700' />
                    <div>
                      <p>Аттестация уже пройдена.</p>
                      <p className='mt-1'>Повторное прохождение возможно только после разрешения администратора.</p>
                    </div>
                  </div>
                ) : (
                  <Link href={`/employee/attestations/${attestation.id}`}>
                    <Button className='h-11 w-full text-base md:w-72'>{hasProgress ? 'Продолжить аттестацию' : 'Начать аттестацию'}</Button>
                  </Link>
                )}
              </div>

              <div className='hidden items-center justify-center md:flex'>
                <div className='relative h-44 w-44 rounded-full bg-green-50'>
                  <div className='absolute left-9 top-7 h-32 w-24 rotate-6 rounded-2xl border-[8px] border-slate-600 bg-white shadow-xl shadow-slate-300/70'>
                    <div className='absolute -top-6 left-1/2 h-10 w-14 -translate-x-1/2 rounded-xl border border-slate-300 bg-slate-100 shadow-md' />
                    <div className='absolute left-4 top-7 space-y-3'>
                      {[0, 1, 2].map((item) => (
                        <div key={item} className='flex items-center gap-2'>
                          <CheckCircle className='h-4 w-4 text-primary' />
                          <span className='h-2 w-8 rounded-full bg-slate-300' />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className='absolute bottom-3 right-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-green-900/20'>
                    <CheckCircle className='h-10 w-10' />
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })}

      <div className='rounded-lg border border-green-100 bg-green-50 px-5 py-4 text-sm text-green-900'>
        Аттестация включает все ключевые процессы работы менеджера по продажам. Удачи!
      </div>
    </main>
  );
}
