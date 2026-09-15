'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleHelp, Eye, EyeOff, Lock, User } from 'lucide-react';

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
        setError(response.status === 429
          ? 'Слишком много попыток входа. Подождите 15 минут и попробуйте снова.'
          : data?.error === 'Пользователь отключён'
            ? 'Доступ к порталу отключён. Обратитесь к администратору.'
            : 'Логин или пароль не подходят. Проверьте данные и попробуйте ещё раз.');
        return;
      }

      router.replace(data.role === 'ADMIN' ? '/admin' : data.portalArea === 'PROCUREMENT' ? '/procurement' : '/employee');
      router.refresh();
    } catch {
      setError('Не удалось связаться с порталом. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main
      className='flex min-h-[100svh] items-center justify-center overflow-hidden p-3 text-[#1b1e22] sm:p-6'
      style={{ background: 'radial-gradient(circle at 50% 31%, #f7f4ee 0%, #ece8e1 50%, #ded8ce 100%)' }}
    >
      <div className='grid w-full max-w-[520px] overflow-hidden rounded-[30px] border border-white/70 bg-[#fffdf9] shadow-[0_32px_78px_rgba(38,34,28,0.16),0_5px_16px_rgba(38,34,28,0.07)] max-sm:rounded-3xl'>
        <section className='relative flex min-h-[200px] items-center justify-center overflow-hidden p-5 sm:min-h-[214px] sm:p-8'>
          <div className='pointer-events-none absolute left-1/2 top-1/2 h-[150px] w-[390px] max-w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#d8d0c4]/20 blur-[42px]' aria-hidden='true' />
          <div className='relative grid w-[314px] max-w-full justify-items-center gap-[17px] min-[440px]:w-[350px] sm:w-[366px]' aria-label='MOBO · Портал компании'>
            <span className='flex w-full items-center gap-[14px] min-[440px]:gap-[16px]'>
              <span className='relative w-[62px] shrink-0 min-[440px]:w-[68px] sm:w-[70px]'>
                <span className='absolute inset-[4%] rounded-[28%] bg-[#756d63]/16 blur-[12px]' aria-hidden='true' />
                <img src='/brand/mobo-master/mobo-symbol-3d-ui.svg' alt='' className='relative h-auto w-full' />
              </span>
              <img src='/brand/mobo-master/mobo-wordmark.svg' alt='MOBO' className='h-auto w-0 min-w-0 flex-1 opacity-[0.97]' />
            </span>
            <span className='whitespace-nowrap text-[13px] font-semibold leading-none tracking-[0.075em] text-[#565752] min-[440px]:text-[14px]'>Портал компании</span>
          </div>
        </section>

        <section className='flex items-center justify-center p-6 sm:p-10'>
          <div className='w-full max-w-[420px]'>
            <div className='mb-6'>
              <h1 className='text-[28px] font-black tracking-[-0.025em] text-[#1b1e22] sm:text-[34px]'>Войти</h1>
              <p className='mt-2 text-sm font-medium text-[#6f706d]'>Введите логин и пароль, выданные администратором.</p>
            </div>

            <form onSubmit={submit} className='space-y-4'>
              <label className='block'>
                <span className='mb-2 block text-sm font-bold text-[#454541]'>Логин</span>
                <span className='flex min-h-[54px] items-center gap-3 rounded-2xl border border-[#d7d0c6] bg-[#fffdf9] px-3.5 transition focus-within:border-[#263b5c] focus-within:ring-4 focus-within:ring-[#263b5c]/10'>
                  <span className='grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f0ede7] text-[#5d6064] ring-1 ring-[#e4dfd6]'><User className='h-4 w-4' /></span>
                  <input
                    className='portal-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-[#292c30] outline-none placeholder:text-[#83847f]'
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
                <span className='mb-2 block text-sm font-bold text-[#454541]'>Пароль</span>
                <span className='flex min-h-[54px] items-center gap-3 rounded-2xl border border-[#d7d0c6] bg-[#fffdf9] px-3.5 transition focus-within:border-[#263b5c] focus-within:ring-4 focus-within:ring-[#263b5c]/10'>
                  <span className='grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#f0ede7] text-[#5d6064] ring-1 ring-[#e4dfd6]'><Lock className='h-4 w-4' /></span>
                  <input
                    className='portal-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-[#292c30] outline-none placeholder:text-[#83847f]'
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
                    className='rounded-md p-1.5 text-[#777873] transition hover:bg-[#f0ede7] hover:text-[#25282c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#263b5c]/40'
                    aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff className='h-5 w-5' /> : <Eye className='h-5 w-5' />}
                  </button>
                </span>
              </label>

              <div aria-live='polite'>
                {error && <p role='alert' className='rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold leading-snug text-red-800'>{error}</p>}
              </div>

              <button
                type='submit'
                disabled={isSubmitting}
                className='h-[54px] w-full rounded-2xl border border-[#2c4567] text-base font-extrabold text-white shadow-[0_7px_16px_rgba(38,59,92,0.20),inset_0_1px_rgba(255,255,255,0.17)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65'
                style={{ background: 'linear-gradient(145deg, #304a6d 0%, #263b5c 52%, #1d2f49 100%)' }}
              >
                {isSubmitting ? 'Входим…' : 'Войти'}
              </button>
            </form>

            <div className='mt-5 flex items-center justify-center gap-2 text-center text-xs font-semibold text-[#777873]'>
              <CircleHelp className='h-3.5 w-3.5 shrink-0' /> Не удаётся войти? Обратитесь к администратору
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
