'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Eye, EyeOff, Lock, ShieldCheck, TrendingUp, User } from 'lucide-react';
import { LoginLogo } from '@/components/BrandBlock';
import { Button } from '@/components/ui/button';

const features = [
  {
    title: 'Аттестации',
    text: 'Проходите тесты и отслеживайте результаты',
    icon: ShieldCheck,
  },
  {
    title: 'Контроль',
    text: 'Данные по сотрудникам и процессам в одном месте',
    icon: BarChart3,
  },
  {
    title: 'Развитие',
    text: 'Единые стандарты помогают повышать качество работы',
    icon: TrendingUp,
  },
];

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });

    if (!response.ok) {
      setError('Ошибка авторизации');
      return;
    }

    const data = await response.json();
    router.push(data.role === 'ADMIN' ? '/admin' : '/employee');
  }

  return (
    <main className='relative min-h-screen overflow-x-hidden bg-[#111821] px-4 py-6 text-white sm:px-6 lg:px-8'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_46%_46%,rgba(81,180,17,0.13),transparent_19%),radial-gradient(circle_at_84%_18%,rgba(81,180,17,0.08),transparent_18%),linear-gradient(135deg,#111821_0%,#141c25_50%,#0d141c_100%)]' />
      <div className='pointer-events-none absolute -left-40 top-[34%] hidden h-[34rem] w-[34rem] rounded-full border border-primary/10 xl:block' />
      <div className='pointer-events-none absolute -left-48 top-[31%] hidden h-[44rem] w-[44rem] rounded-full border border-primary/6 xl:block' />
      <div className='pointer-events-none absolute right-[-12rem] top-[-10rem] h-[32rem] w-[32rem] rounded-full border border-primary/10' />
      <div className='pointer-events-none absolute right-8 top-12 hidden grid-cols-7 gap-4 opacity-20 lg:grid'>
        {Array.from({ length: 49 }).map((_, index) => (
          <span key={index} className='h-1.5 w-1.5 rounded-full bg-primary' />
        ))}
      </div>

      <div className='relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-[1320px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(440px,520px)] lg:justify-between xl:grid-cols-[minmax(0,620px)_minmax(440px,520px)] xl:gap-16'>
        <section className='min-w-0 space-y-7 lg:space-y-8'>
          <LoginLogo />

          <div className='h-1 w-12 rounded-full bg-primary shadow-[0_0_24px_rgba(81,180,17,0.45)]' />

          <h1 className='max-w-[680px] break-words text-[1.8rem] font-extrabold leading-[1.14] tracking-normal text-white sm:text-4xl lg:text-[2.65rem] xl:text-5xl'>
            Единый портал для сотрудников, аттестаций и внутренних процессов.
          </h1>

          <div className='grid max-w-[590px] gap-2 sm:gap-3'>
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className='flex gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-3.5 sm:p-4'>
                  <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary sm:h-14 sm:w-14'>
                    <Icon className='h-6 w-6 sm:h-7 sm:w-7' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-base font-extrabold text-white sm:text-lg'>{feature.title}</p>
                    <p className='mt-1 text-sm leading-snug text-slate-300 sm:text-base'>{feature.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className='w-full rounded-lg border border-white/18 bg-white/[0.055] p-6 shadow-[0_30px_110px_rgba(0,0,0,0.32),0_0_60px_rgba(81,180,17,0.08)] backdrop-blur-xl sm:p-8 lg:ml-auto lg:max-w-[520px] lg:p-10'>
          <div className='mb-7 space-y-2'>
            <h2 className='text-2xl font-extrabold tracking-normal text-white sm:text-3xl'>Вход в систему</h2>
            <p className='text-base text-slate-300'>Введите свои учётные данные для входа в портал</p>
          </div>

          <form onSubmit={submit} className='space-y-5'>
            <label className='block'>
              <span className='mb-2.5 block text-base font-bold text-white'>Логин</span>
              <span className='flex h-14 items-center gap-4 rounded-lg border border-white/18 bg-white/[0.04] px-4 transition focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15'>
                <User className='h-5 w-5 text-slate-400' />
                <input
                  className='w-full bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500'
                  placeholder='Введите логин'
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </span>
            </label>

            <label className='block'>
              <span className='mb-2.5 block text-base font-bold text-white'>Пароль</span>
              <span className='flex h-14 items-center gap-4 rounded-lg border border-white/18 bg-white/[0.04] px-4 transition focus-within:border-primary/80 focus-within:ring-4 focus-within:ring-primary/15'>
                <Lock className='h-5 w-5 text-slate-400' />
                <input
                  className='w-full bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500'
                  placeholder='Введите пароль'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type='button'
                  className='rounded-md p-1 text-slate-400 transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
                </button>
              </span>
            </label>

            <label className='flex items-center gap-3 text-base font-semibold text-slate-200'>
              <input type='checkbox' className='h-5 w-5 rounded border-white/40 bg-transparent accent-primary' />
              Запомнить меня
            </label>

            {error && <p className='text-sm font-semibold text-red-300'>{error}</p>}

            <Button className='h-14 w-full rounded-lg text-lg font-extrabold shadow-[0_18px_45px_rgba(81,180,17,0.25)]'>Войти</Button>
          </form>
        </section>

        <p className='text-center text-sm text-slate-400 lg:col-span-2 lg:mt-1'>
          © 2026 <span className='font-extrabold text-primary'>OFFONIKA</span>. Все права защищены.
        </p>
      </div>
    </main>
  );
}
