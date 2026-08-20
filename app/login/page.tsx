'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { LoginLogo } from '@/components/BrandBlock';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error === 'Пользователь отключён'
          ? 'Доступ к порталу отключён. Обратитесь к администратору.'
          : 'Логин или пароль не подходят. Проверьте данные и попробуйте ещё раз.');
        return;
      }

      router.replace(data.role === 'ADMIN' ? '/admin' : '/employee');
      router.refresh();
    } catch {
      setError('Не удалось связаться с порталом. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className='relative min-h-[100svh] overflow-hidden bg-[#111821] px-4 py-6 text-white sm:px-6 lg:px-8'>
      <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(81,180,17,0.16),transparent_25%),radial-gradient(circle_at_88%_80%,rgba(81,180,17,0.08),transparent_24%),linear-gradient(145deg,#111821,#0c131b)]' />
      <div className='pointer-events-none absolute -right-52 -top-48 h-96 w-96 rounded-full border border-primary/15' />

      <div className='relative mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-[1180px] flex-col justify-center'>
        <div className='grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-14 xl:gap-20'>
          <section className='text-center lg:text-left'>
            <div className='mx-auto w-[190px] sm:w-[220px] lg:mx-0 lg:w-[310px]'>
              <LoginLogo />
            </div>
            <p className='mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-primary lg:mt-8'>Портал для сотрудников</p>
            <h1 className='mx-auto mt-2 max-w-xl text-[22px] font-extrabold leading-tight text-white sm:text-2xl lg:mx-0 lg:mt-3 lg:text-[42px] lg:leading-[1.08]'>
              Рабочий день и задачи — в одном месте
            </h1>
            <p className='mx-auto mt-4 hidden max-w-lg text-base leading-relaxed text-slate-300 lg:mx-0 lg:block'>
              Вход для сотрудников и администратора. После входа портал сразу откроет ваш рабочий экран.
            </p>
          </section>

          <section className='mx-auto w-full max-w-[440px] rounded-2xl border border-white/15 bg-white/[0.065] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:p-7 lg:p-8'>
            <div className='mb-6'>
              <h2 className='text-2xl font-extrabold tracking-normal text-white sm:text-[28px]'>Вход в портал</h2>
              <p className='mt-1.5 text-sm text-slate-300'>Введите логин и пароль</p>
            </div>

            <form onSubmit={submit} className='space-y-4'>
              <label className='block'>
                <span className='mb-2 block text-sm font-bold text-slate-100'>Логин</span>
                <span className='flex min-h-[52px] items-center gap-3 rounded-xl border border-white/15 bg-black/15 px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
                  <User className='h-5 w-5 shrink-0 text-slate-400' />
                  <input
                    className='offonika-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500'
                    name='username'
                    placeholder='Ваш логин'
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    autoComplete='username'
                    autoCapitalize='none'
                    autoCorrect='off'
                    spellCheck={false}
                    enterKeyHint='next'
                    required
                  />
                </span>
              </label>

              <label className='block'>
                <span className='mb-2 block text-sm font-bold text-slate-100'>Пароль</span>
                <span className='flex min-h-[52px] items-center gap-3 rounded-xl border border-white/15 bg-black/15 px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
                  <Lock className='h-5 w-5 shrink-0 text-slate-400' />
                  <input
                    className='offonika-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-white outline-none placeholder:text-slate-500'
                    name='password'
                    placeholder='Ваш пароль'
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete='current-password'
                    enterKeyHint='go'
                    required
                  />
                  <button
                    type='button'
                    className='rounded-md p-1.5 text-slate-400 transition hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
                  </button>
                </span>
              </label>

              <div aria-live='polite'>
                {error && <p role='alert' className='rounded-lg bg-red-500/15 px-3 py-2.5 text-sm font-semibold leading-snug text-red-200'>{error}</p>}
              </div>

              <Button type='submit' disabled={isSubmitting} className='h-[52px] w-full rounded-xl text-base font-extrabold shadow-[0_16px_38px_rgba(81,180,17,0.22)]'>
                {isSubmitting ? 'Входим…' : 'Войти'}
              </Button>
            </form>

            <p className='mt-4 text-center text-xs leading-relaxed text-slate-400'>Логин и пароль выдаёт администратор</p>
          </section>
        </div>

        <p className='mt-7 text-center text-xs text-slate-500 lg:mt-10'>© 2026 <span className='font-extrabold text-primary'>OFFONIKA</span></p>
      </div>
    </main>
  );
}
