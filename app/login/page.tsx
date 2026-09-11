'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, ClipboardCheck, Eye, EyeOff, Lock, PackageSearch, User } from 'lucide-react';
import { PortalIdentityBlock } from '@/components/PortalIdentityBlock';
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

      router.replace(data.role === 'ADMIN' ? '/admin' : data.portalArea === 'PROCUREMENT' ? '/procurement' : '/employee');
      router.refresh();
    } catch {
      setError('Не удалось связаться с порталом. Проверьте интернет и попробуйте ещё раз.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className='portal-neutral-design login-material-page relative min-h-[100svh] overflow-hidden p-3 text-[#202936] sm:p-6 lg:p-8'>
      <div className='login-portal-shell relative mx-auto grid min-h-[calc(100svh-1.5rem)] w-full max-w-[1180px] overflow-hidden sm:min-h-[calc(100svh-3rem)] lg:grid-cols-[1.08fr_0.92fr]'>
        <section className='login-portal-hero relative flex min-h-[230px] flex-col overflow-hidden p-6 text-white sm:p-8 lg:min-h-0 lg:p-12'>
          <div className='login-portal-glow pointer-events-none absolute inset-0' />
          <div className='relative z-10'>
            <PortalIdentityBlock />
          </div>

          <div className='relative z-10 mt-auto pt-7 sm:pt-10 lg:pb-8'>
            <p className='text-xs font-extrabold uppercase tracking-[0.18em] text-[#ffc247]'>Внутренняя рабочая система</p>
            <h1 className='mt-3 max-w-[560px] text-[28px] font-black leading-[1.05] tracking-[-0.035em] text-white sm:text-[34px] lg:text-[52px]'>
              Работа команды.<br />В одном месте.
            </h1>
            <p className='mt-4 max-w-md text-sm font-semibold leading-relaxed text-white/68 sm:text-base'>
              Рабочий день, закупки и контроль — без лишних чатов и потерянных задач.
            </p>
          </div>

          <div className='login-portal-modules relative z-10 mt-7 hidden grid-cols-3 gap-3 sm:grid'>
            <div className='login-portal-module'><BriefcaseBusiness className='h-5 w-5' /><span>Рабочий день</span></div>
            <div className='login-portal-module'><PackageSearch className='h-5 w-5' /><span>Закупки</span></div>
            <div className='login-portal-module'><ClipboardCheck className='h-5 w-5' /><span>Контроль</span></div>
          </div>
        </section>

        <section className='login-portal-form-panel flex items-center justify-center p-5 sm:p-8 lg:p-12'>
          <div className='w-full max-w-[420px]'>
            <div className='mb-6'>
              <p className='mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#8b6a20]'>Доступ сотрудника</p>
              <h2 className='text-[28px] font-black tracking-[-0.025em] text-[#202936] sm:text-[34px]'>Войти в портал</h2>
            <p className='mt-2 text-sm font-medium text-[#667085]'>Используйте данные, которые выдал администратор.</p>
            </div>

            <form onSubmit={submit} className='space-y-4'>
              <label className='block'>
                <span className='mb-2 block text-sm font-bold text-[#3c474c]'>Логин</span>
                <span className='login-material-field flex min-h-[54px] items-center gap-3 rounded-2xl px-3.5 transition focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15'>
                  <span className='login-material-field-icon'><User className='h-4 w-4' /></span>
                  <input
                    className='portal-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-[#273137] outline-none placeholder:text-[#929a9d]'
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
                    className='portal-login-input min-w-0 flex-1 bg-transparent text-base font-semibold text-[#273137] outline-none placeholder:text-[#929a9d]'
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

            <div className='mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[#7b818c]'>
              <Lock className='h-3.5 w-3.5' /> Защищённый вход
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
