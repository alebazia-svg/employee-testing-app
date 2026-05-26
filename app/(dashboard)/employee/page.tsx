import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Award, CheckCircle, ClipboardList, HelpCircle, Info, Layers, ShieldCheck, Target } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { BrandBlock } from '@/components/BrandBlock';
import { LogoutButton } from '@/components/LogoutButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { attestationTypeLabel, questionCountText, sectionCountText } from '@/lib/test-format';

function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

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
    <main className='min-h-screen bg-[#f7faf8] px-4 py-4 text-slate-950 md:px-8'>
      <div className='mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col'>
        <header className='flex flex-col gap-4 rounded-lg border border-slate-200/80 bg-white px-5 py-4 shadow-[0_10px_28px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between md:px-7'>
          <div className='flex flex-wrap items-center gap-5'>
            <BrandBlock size='header' />
            <span className='hidden h-7 w-px bg-slate-200 md:block' />
            <span className='text-sm font-semibold text-slate-500'>Портал сотрудников</span>
          </div>
          <div className='flex flex-wrap items-center gap-3 md:justify-end'>
            <div className='text-left md:text-right'>
              <p className='text-sm font-extrabold text-slate-950'>{user.name}</p>
              <p className='text-sm font-medium text-slate-500'>Сотрудник</p>
            </div>
            <div className='flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-base font-extrabold text-primary'>
              {initials(user.name)}
            </div>
            <LogoutButton className='gap-2 bg-slate-50 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 hover:text-slate-950' />
          </div>
        </header>

        <section className='mx-auto w-full max-w-6xl flex-1 py-8 md:py-12'>
          <div className='mb-7'>
            <h1 className='text-3xl font-extrabold tracking-normal text-slate-950 md:text-4xl'>Добро пожаловать, {user.name}!</h1>
            <p className='mt-2 text-base font-medium text-slate-500'>Вам доступна аттестация</p>
          </div>

          <div className='space-y-5'>
            {attestations.map((attestation) => {
              const questionCount = attestation.sections.reduce((sum, section) => sum + section.questions.length, 0);
              const result = attestation.results[0];
              const hasProgress = Boolean(attestation.progresses[0]);

              return (
                <Card key={attestation.id} className='overflow-hidden p-0'>
                  <div className='grid gap-8 p-6 md:grid-cols-[minmax(0,1fr)_260px] md:p-8'>
                    <div className='space-y-6'>
                      <div className='flex flex-wrap items-start justify-between gap-4'>
                        <div className='flex items-start gap-5'>
                          <div className='flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-green-100 text-primary'>
                            <Award className='h-9 w-9' />
                          </div>
                          <div className='min-w-0'>
                            <h2 className='text-2xl font-extrabold leading-tight text-slate-950'>{attestation.title}</h2>
                            <Badge className='mt-3 inline-flex bg-green-100 text-green-800'>{attestationTypeLabel(attestation.type)}</Badge>
                          </div>
                        </div>
                        <Badge className={result ? 'bg-slate-100 text-slate-700' : 'bg-green-100 text-green-800'}>
                          {result ? 'Пройдена' : 'Доступна'}
                        </Badge>
                      </div>

                      <div className='flex flex-wrap gap-x-7 gap-y-3 border-b border-slate-200/80 pb-5 text-base font-medium text-slate-600'>
                        <span className='flex items-center gap-2'><Layers className='h-5 w-5 text-slate-600' />{sectionCountText(attestation.sections.length)}</span>
                        <span className='flex items-center gap-2'><ClipboardList className='h-5 w-5 text-slate-600' />{questionCountText(questionCount)}</span>
                        <span className='flex items-center gap-2'><Target className='h-5 w-5 text-slate-600' />Проходной балл: {attestation.passingScore}%</span>
                      </div>

                      <div>
                        <p className='mb-4 text-base font-extrabold text-slate-950'>Разделы аттестации:</p>
                        <div className='grid gap-x-8 gap-y-3 md:grid-cols-2'>
                          {attestation.sections.map((section) => (
                            <div key={section.id} className='flex items-center gap-3 text-base font-medium text-slate-700'>
                              <CheckCircle className='h-5 w-5 shrink-0 text-primary' />
                              {section.title}
                            </div>
                          ))}
                        </div>
                      </div>

                      {result ? (
                        <div className='flex gap-3 rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-base text-slate-700'>
                          <Info className='mt-0.5 h-5 w-5 shrink-0 text-blue-700' />
                          <div>
                            <p className='font-extrabold text-slate-900'>Аттестация уже пройдена</p>
                            <p className='mt-1 font-medium'>Повторное прохождение возможно только после разрешения администратора.</p>
                          </div>
                        </div>
                      ) : (
                        <Link href={`/employee/attestations/${attestation.id}`}>
                          <Button className='h-12 w-full text-base md:w-80'>{hasProgress ? 'Продолжить аттестацию' : 'Начать аттестацию'}</Button>
                        </Link>
                      )}
                    </div>

                    <div className='hidden items-center justify-center md:flex'>
                      <div className='relative h-56 w-56 rounded-full bg-green-50'>
                        <div className='absolute left-12 top-8 h-40 w-28 rotate-6 rounded-2xl border-[9px] border-slate-600 bg-white shadow-xl shadow-slate-300/70'>
                          <div className='absolute -top-7 left-1/2 h-12 w-16 -translate-x-1/2 rounded-xl border border-slate-300 bg-slate-100 shadow-md' />
                          <div className='absolute left-5 top-9 space-y-4'>
                            {[0, 1, 2].map((item) => (
                              <div key={item} className='flex items-center gap-3'>
                                <CheckCircle className='h-5 w-5 text-primary' />
                                <span className='h-2.5 w-10 rounded-full bg-slate-300' />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className='absolute bottom-4 right-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-green-900/20'>
                          <CheckCircle className='h-12 w-12' />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {!attestations.length && (
              <Card className='flex min-h-[220px] flex-col items-center justify-center text-center'>
                <ShieldCheck className='mb-4 h-10 w-10 text-slate-400' />
                <p className='text-lg font-extrabold text-slate-950'>Нет доступных аттестаций</p>
                <p className='mt-2 max-w-md text-sm font-medium text-slate-500'>Когда администратор активирует аттестацию, она появится здесь.</p>
              </Card>
            )}

            <div className='flex gap-4 rounded-lg border border-green-200 bg-green-50 px-6 py-5 text-green-950'>
              <ShieldCheck className='mt-0.5 h-6 w-6 shrink-0 text-primary' />
              <div>
                <p className='font-extrabold'>Спасибо за вашу работу!</p>
                <p className='mt-1 text-sm font-medium'>Аттестация включает все ключевые процессы работы менеджера по продажам. Удачи!</p>
              </div>
            </div>
          </div>
        </section>

        <footer className='flex flex-col gap-3 border-t border-slate-200/80 py-5 text-sm font-medium text-slate-500 md:flex-row md:items-center md:justify-between'>
          <span>© 2026 <span className='font-extrabold text-primary'>OFFONIKA</span>. Все права защищены.</span>
          <span className='flex items-center gap-2'><HelpCircle className='h-5 w-5' />Нужна помощь? Обратитесь к администратору</span>
        </footer>
      </div>
    </main>
  );
}
