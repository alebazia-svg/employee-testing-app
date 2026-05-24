'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Eye, EyeOff, Lock, ShieldCheck, TrendingUp, User } from 'lucide-react';
import { LoginLogo } from '@/components/BrandBlock';
import { Button } from '@/components/ui/button';

const features = [
  {
    title: 'Надёжность',
    text: 'Хранение результатов и истории аттестаций',
    icon: ShieldCheck,
  },
  {
    title: 'Контроль',
    text: 'Контроль прохождения и результатов аттестаций',
    icon: BarChart3,
  },
  {
    title: 'Развитие',
    text: 'Повышение качества подготовки сотрудников',
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
    router.push(data.role === 'ADMIN' ? '/admin/attestations' : '/employee');
  }

  return (
    <main className='relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_38%_18%,rgba(81,180,17,0.08),transparent_24%),linear-gradient(135deg,#ffffff_0%,#f8faf9_48%,#edf4ed_100%)] px-4 py-5 text-slate-900 md:px-8 md:py-6'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(47,86,57,0.12)_1.25px,transparent_0)] bg-[length:28px_28px] opacity-[0.12]' />
      <div className='pointer-events-none absolute -bottom-24 -left-16 h-64 w-[42rem] rounded-[58%_42%_0_0] bg-[linear-gradient(95deg,rgba(81,180,17,0.22),rgba(81,180,17,0.06)_58%,transparent)] blur-[1px]' />
      <div className='pointer-events-none absolute bottom-[-8rem] left-[18rem] h-60 w-[34rem] rounded-[50%] bg-[radial-gradient(circle,rgba(81,180,17,0.12),transparent_70%)]' />
      <div className='pointer-events-none absolute right-[-10rem] top-[-12rem] h-[34rem] w-[34rem] rounded-full bg-[radial-gradient(circle,rgba(81,180,17,0.16),rgba(81,180,17,0.05)_58%,transparent_62%)]' />
      <div className='pointer-events-none absolute right-[-3rem] top-28 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(81,180,17,0.09),transparent_68%)]' />
      <div className='pointer-events-none absolute left-[-8rem] top-[25%] h-[26rem] w-[26rem] rounded-full border border-green-100/70 opacity-70' />
      <div className='pointer-events-none absolute left-[-10rem] top-[23%] h-[32rem] w-[32rem] rounded-full border border-green-100/40 opacity-70' />
      <div className='pointer-events-none absolute right-[4rem] top-0 h-full w-px rotate-[-13deg] bg-gradient-to-b from-transparent via-green-100 to-transparent' />
      <div className='pointer-events-none absolute bottom-8 left-5 grid grid-cols-7 gap-3 opacity-40'>
        {Array.from({ length: 35 }).map((_, index) => (
          <span
            key={index}
            className='h-1.5 w-1.5 rounded-full bg-slate-300'
            style={{ opacity: 0.25 + (index % 5) * 0.1 }}
          />
        ))}
      </div>
      <div className='pointer-events-none absolute left-[39%] top-11 h-24 w-24 rounded-[1.5rem] border border-green-100/70 bg-white/35 rotate-12 shadow-xl shadow-green-100/40 backdrop-blur-sm' />
      <div className='pointer-events-none absolute left-[47%] top-36 h-14 w-14 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.95),rgba(81,180,17,0.16)_70%)] shadow-2xl shadow-green-100/70' />
      <div className='pointer-events-none absolute right-[8%] top-[12%] h-3.5 w-3.5 rounded-full bg-primary shadow-lg shadow-green-500/30' />

      <div className='relative mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[minmax(0,400px)_minmax(420px,500px)] lg:justify-between'>
        <section className='space-y-4 md:space-y-5 lg:pl-3'>
          <LoginLogo />

          <div className='h-1 w-9 rounded-full bg-primary' />

          <p className='max-w-md text-[1.55rem] font-extrabold leading-tight text-slate-900 md:text-[1.85rem]'>
            Проходите аттестации, отслеживайте результаты и поддерживайте единый стандарт знаний.
          </p>

          <div className='grid max-w-md gap-2.5 pt-1'>
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className='flex items-center gap-3'>
                  <div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-50 text-primary ring-1 ring-green-100'>
                    <Icon className='h-6 w-6' />
                  </div>
                  <div className='min-w-0'>
                    <p className='text-sm font-extrabold text-slate-950'>{feature.title}</p>
                    <p className='mt-0.5 text-sm font-semibold leading-snug text-slate-500'>{feature.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className='rounded-lg border border-white/80 bg-white/95 p-6 shadow-[0_30px_90px_rgba(15,23,42,0.10),0_18px_45px_rgba(81,180,17,0.08)] backdrop-blur md:p-8'>
          <div className='mb-6 space-y-2'>
            <h1 className='text-2xl font-extrabold tracking-normal text-slate-950 md:text-[1.7rem]'>Вход в систему</h1>
            <p className='text-sm font-semibold text-slate-500'>Введите свои учетные данные для входа</p>
          </div>

          <form onSubmit={submit} className='space-y-4'>
            <label className='block'>
              <span className='mb-2 block text-sm font-bold text-slate-900'>Логин</span>
              <span className='flex h-[52px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-green-100'>
                <User className='h-5 w-5 text-slate-400' />
                <input
                  className='w-full bg-transparent text-base font-medium outline-none placeholder:text-slate-400'
                  placeholder='Введите логин'
                  value={login}
                  onChange={(event) => setLogin(event.target.value)}
                />
              </span>
            </label>

            <label className='block'>
              <span className='mb-2 block text-sm font-bold text-slate-900'>Пароль</span>
              <span className='flex h-[52px] items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-green-100'>
                <Lock className='h-5 w-5 text-slate-400' />
                <input
                  className='w-full bg-transparent text-base font-medium outline-none placeholder:text-slate-400'
                  placeholder='Введите пароль'
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type='button'
                  className='rounded-md p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
                  aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
                </button>
              </span>
            </label>

            <label className='flex items-center gap-3 text-sm font-semibold text-slate-700'>
              <input type='checkbox' className='h-5 w-5 rounded border-slate-300 accent-primary' />
              Запомнить меня
            </label>

            {error && <p className='text-sm font-semibold text-red-600'>{error}</p>}

            <Button className='h-[52px] w-full rounded-lg text-base font-bold shadow-lg shadow-green-700/20'>Войти</Button>
          </form>
        </section>

        <p className='hidden text-center text-sm font-semibold text-slate-500 lg:col-start-2 lg:block'>
          © 2026 <span className='font-extrabold text-primary'>OFFONIKA</span>. Все права защищены.
        </p>
      </div>
    </main>
  );
}
