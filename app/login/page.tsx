'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { BrandBlock } from '@/components/BrandBlock';
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
        setError(response.status === 429
          ? 'Слишком много попыток входа. Подождите 15 минут и попробуйте снова.'
          : data?.error === 'Пользователь отключён'
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
    <main className='login-material-page relative min-h-[100svh] overflow-hidden px-4 py-6 text-[#273137] sm:px-6 lg:px-8'>
      <div className='login-material-plane pointer-events-none absolute inset-0' />
      <div className='login-material-rings pointer-events-none absolute' />
      <div className='login-material-mark pointer-events-none absolute' aria-hidden='true'>
        <Image src='/offonika-o-white.png' alt='' width={1024} height={1024} priority />
      </div>

      <div className='relative mx-auto flex min-h-[calc(100svh-3rem)] w-full max-w-[1180px] flex-col justify-center'>
        <div className='grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] lg:gap-14 xl:gap-20'>
          <section className='text-center lg:text-left'>
            <div className='mx-auto w-[190px] sm:w-[220px] lg:mx-0 lg:w-[250px]'>
              <BrandBlock size='employee' />
            </div>
            <p className='mt-4 text-xs font-extrabold uppercase tracking-[0.16em] text-primary lg:mt-7'>Портал для сотрудников</p>
            <h1 className='mx-auto mt-2 max-w-xl text-[22px] font-extrabold leading-tight text-[#273137] sm:text-2xl lg:mx-0 lg:mt-3 lg:text-[42px] lg:leading-[1.08]'>
              Рабочий день и задачи — в одном месте
            </h1>
            <p className='mx-auto mt-4 hidden max-w-lg text-base font-medium leading-relaxed text-[#657077] lg:mx-0 lg:block'>
              Вход для сотрудников и администратора. После входа портал сразу откроет ваш рабочий экран.
            </p>
          </section>

          <section className='login-material-card mx-auto w-full max-w-[440px] rounded-[26px] p-5 sm:p-7 lg:p-8'>
            <div className='mb-6'>
              <h2 className='text-2xl font-extrabold tracking-normal text-[#273137] sm:text-[28px]'>Вход в портал</h2>
              <p className='mt-1.5 text-sm font-medium text-[#748087]'>Введите логин и пароль</p>
            </div>

            <form onSubmit={submit} className='space-y-4'>
              <label className='block'>
                <span className='mb-2 block text-sm font-bold text-[#3c474c]'>Логин</span>
                <span className='login-material-field flex min-h-[54px] items-center gap-3 rounded-2xl px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
                  <span className='login-material-field-icon'><User className='h-4 w-4' /></span>
                  <input
                    className='offonika-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-[#273137] outline-none placeholder:text-[#929a9d]'
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
                <span className='mb-2 block text-sm font-bold text-[#3c474c]'>Пароль</span>
                <span className='login-material-field flex min-h-[54px] items-center gap-3 rounded-2xl px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
                  <span className='login-material-field-icon'><Lock className='h-4 w-4' /></span>
                  <input
                    className='offonika-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-[#273137] outline-none placeholder:text-[#929a9d]'
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
                    className='rounded-md p-1.5 text-[#768187] transition hover:bg-white/60 hover:text-[#273137] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40'
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

              <Button type='submit' disabled={isSubmitting} className='login-material-submit h-[54px] w-full rounded-2xl text-base font-extrabold'>
                {isSubmitting ? 'Входим…' : 'Войти'}
              </Button>
            </form>

            <p className='mt-4 text-center text-xs font-medium leading-relaxed text-[#7d878b]'>Логин и пароль выдаёт администратор</p>
          </section>
        </div>

        <p className='login-material-footer mt-7 text-center text-xs lg:mt-10'>© 2026 <span className='font-extrabold text-primary'>OFFONIKA</span></p>
      </div>
    </main>
  );
}
