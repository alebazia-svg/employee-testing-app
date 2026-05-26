import Link from 'next/link';
import type { ComponentType } from 'react';
import { AlertTriangle, Banknote, BarChart3, CalendarCheck, ChevronRight, ClipboardCheck, FilePlus2, GraduationCap, SearchCheck, ShieldCheck, Users } from 'lucide-react';
import { AdminShell } from '@/components/AdminShell';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table } from '@/components/ui/table';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

const emptyText = 'Нет данных для отображения.';

function EmptyState({
  icon: Icon,
  title,
  text,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className='flex min-h-[190px] flex-col items-center justify-center px-6 py-8 text-center'>
      <div className='mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500'>
        <Icon className='h-6 w-6' />
      </div>
      <p className='text-base font-extrabold text-slate-950'>{title}</p>
      <p className='mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500'>{text}</p>
    </div>
  );
}

export default async function AdminPage() {
  const [
    employeeCount,
    attestationCount,
    activeAttestationCount,
    draftAttestationCount,
    resultCount,
    failedResultCount,
    latestResults,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.attestation.count(),
    prisma.attestation.count({ where: { status: 'ACTIVE' } }),
    prisma.attestation.count({ where: { status: 'DRAFT' } }),
    prisma.result.count(),
    prisma.result.count({ where: { status: { not: 'Сдал' } } }),
    prisma.result.findMany({
      take: 5,
      orderBy: { date: 'desc' },
      include: { user: true, attestation: true },
    }),
  ]);

  const reviewCount = failedResultCount + draftAttestationCount;
  const statCards = [
    { title: 'Сотрудники', value: String(employeeCount), note: 'Всего сотрудников', icon: Users, href: '/admin/employees', tone: 'green' },
    { title: 'Аттестации', value: String(attestationCount), note: `${activeAttestationCount} активных`, icon: GraduationCap, href: '/admin/attestations', tone: 'green' },
    { title: 'Результаты', value: String(resultCount), note: 'Всего результатов', icon: BarChart3, href: '/admin/results', tone: 'green' },
    { title: 'Посещаемость', value: '—', note: emptyText, icon: CalendarCheck, href: '/admin/attendance', tone: 'green' },
    { title: 'Зарплата', value: '—', note: emptyText, icon: Banknote, href: '/admin/payroll', tone: 'green' },
    { title: 'Требует проверки', value: String(reviewCount), note: 'Несданные результаты и черновики', icon: AlertTriangle, href: '/admin/results', tone: 'amber' },
  ];

  const attentionItems = [
    {
      title: 'Несданные аттестации',
      text: 'Результаты со статусом “Не сдал”',
      count: failedResultCount,
      href: '/admin/results',
      tone: 'red',
      icon: ShieldCheck,
    },
    {
      title: 'Черновики аттестаций',
      text: 'Аттестации ещё не активны',
      count: draftAttestationCount,
      href: '/admin/attestations',
      tone: 'amber',
      icon: ClipboardCheck,
    },
  ].filter((item) => item.count > 0);

  const quickActions = [
    { title: 'Перейти к результатам на проверке', text: failedResultCount ? `${failedResultCount} результатов требуют внимания` : 'Открыть журнал результатов', href: '/admin/results', icon: SearchCheck },
    { title: 'Открыть расчёт зарплаты', text: 'Загрузить Excel и проверить начисления', href: '/admin/payroll', icon: Banknote },
    { title: 'Создать аттестацию', text: 'Перейти к списку аттестаций и форме создания', href: '/admin/attestations', icon: FilePlus2 },
    { title: 'Открыть посещаемость', text: 'Посмотреть текущие данные Google Sheets', href: '/admin/attendance', icon: CalendarCheck },
  ];

  return (
    <AdminShell>
      <div className='mb-7'>
        <div>
          <h1 className='text-3xl font-extrabold tracking-normal text-slate-950'>Главная</h1>
          <p className='mt-1 text-base font-medium text-slate-500'>Обзор ключевых показателей и задач</p>
        </div>
      </div>

      <section className='mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6'>
        {statCards.map((item) => {
          const Icon = item.icon;
          const iconTone = item.tone === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-primary';
          return (
            <Link key={item.title} href={item.href} className='group block'>
              <Card className='h-full p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]'>
                <div className='flex items-start gap-4'>
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconTone}`}>
                    <Icon className='h-6 w-6' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-bold text-slate-600'>{item.title}</p>
                    <p className='mt-2 text-2xl font-extrabold text-slate-950'>{item.value}</p>
                    <p className='mt-1 text-xs font-medium leading-snug text-slate-500'>{item.note}</p>
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.72fr)]'>
        <Card className='p-0'>
          <div className='border-b border-slate-200/80 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Что требует внимания</h2>
          </div>
          {attentionItems.length ? (
            <div className='divide-y divide-slate-200/80'>
              {attentionItems.map((item) => {
                const Icon = item.icon;
                const toneClass = item.tone === 'red' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';
                const badgeClass = item.tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                return (
                  <Link key={item.title} href={item.href} className='flex items-center gap-4 px-5 py-4 transition hover:bg-slate-50'>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${toneClass}`}>
                      <Icon className='h-5 w-5' />
                    </div>
                    <div className='min-w-0 flex-1'>
                      <p className='font-bold text-slate-950'>{item.title}</p>
                      <p className='text-sm font-medium text-slate-500'>{item.text}</p>
                    </div>
                    <Badge className={badgeClass}>{item.count}</Badge>
                    <ChevronRight className='h-4 w-4 text-slate-400' />
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title='Нет данных, требующих внимания.'
              text='Когда появятся просроченные аттестации, ошибки зарплаты или проблемы с посещаемостью, они появятся здесь.'
            />
          )}
        </Card>

        <Card className='p-0'>
          <div className='border-b border-slate-200/80 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Быстрые действия</h2>
          </div>
          <div className='grid gap-3 p-4'>
            {quickActions.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href={item.href} className='flex items-center gap-4 rounded-lg border border-slate-200/80 bg-white px-4 py-4 transition hover:border-primary/35 hover:bg-green-50/30'>
                  <div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-green-100 text-primary'>
                    <Icon className='h-5 w-5' />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='font-bold text-slate-950'>{item.title}</p>
                    <p className='text-sm font-medium text-slate-500'>{item.text}</p>
                  </div>
                  <ChevronRight className='h-4 w-4 text-slate-400' />
                </Link>
              );
            })}
          </div>
        </Card>
      </section>

      <section className='mt-5 grid gap-5 lg:grid-cols-2'>
        <Card className='p-0'>
          <div className='border-b border-slate-200/80 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Зарплата</h2>
          </div>
          <EmptyState
            icon={Banknote}
            title='Нет данных по зарплате.'
            text='После отдельной доработки сохранения расчётов здесь будет отображаться последняя сводка по зарплате.'
          />
        </Card>

        <Card className='p-0'>
          <div className='border-b border-slate-200/80 px-5 py-4'>
            <h2 className='text-lg font-extrabold text-slate-950'>Посещаемость</h2>
          </div>
          <EmptyState
            icon={CalendarCheck}
            title='Нет сохранённой сводки посещаемости.'
            text='Сейчас данные отображаются на странице посещаемости. Для вывода на главной потребуется отдельное сохранение сводки.'
          />
        </Card>
      </section>

      <Card className='mt-5 p-0'>
        <div className='flex items-center justify-between border-b border-slate-200/80 px-5 py-4'>
          <h2 className='text-lg font-extrabold text-slate-950'>Последние результаты</h2>
          <Link href='/admin/results' className='text-sm font-bold text-primary hover:text-green-700'>
            Все результаты
          </Link>
        </div>
        {latestResults.length ? (
          <Table>
            <thead className='bg-slate-50 text-left text-slate-500'>
              <tr>
                <th className='px-5 py-4'>Сотрудник</th>
                <th className='px-5 py-4'>Аттестация</th>
                <th className='px-5 py-4'>Баллы</th>
                <th className='px-5 py-4'>Дата</th>
                <th className='px-5 py-4'>Статус</th>
              </tr>
            </thead>
            <tbody>
              {latestResults.map((result) => (
                <tr key={result.id} className='border-t border-slate-200/80'>
                  <td className='px-5 py-4 font-bold text-slate-950'>{result.user.name}</td>
                  <td className='px-5 py-4 text-slate-700'>{result.attestation.title}</td>
                  <td className='px-5 py-4 font-bold text-primary'>{result.percent}%</td>
                  <td className='px-5 py-4 text-slate-600'>{formatDate(result.date)}</td>
                  <td className='px-5 py-4'>
                    <Badge className={result.status === 'Сдал' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'}>
                      {result.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState icon={BarChart3} title={emptyText} text='Последние результаты появятся здесь после прохождения аттестаций сотрудниками.' />
        )}
      </Card>
    </AdminShell>
  );
}
