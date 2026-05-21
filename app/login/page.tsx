'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const r = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ login, password }) });
    if (!res.ok) {
      setError('Ошибка авторизации');
      return;
    }
    const data = await res.json();
    r.push(data.role === 'ADMIN' ? '/admin' : '/employee');
  }

  return (
    <div className='min-h-screen px-4 py-10 md:py-16'>
      <div className='mx-auto grid w-full max-w-5xl items-center gap-8 md:grid-cols-2'>
        <div className='space-y-4'>
          <Image src='/logo.png' alt='OFFONIKA' width={170} height={170} className='h-auto w-32 md:w-44' priority />
          <h1 className='text-3xl font-bold tracking-tight text-slate-800 md:text-4xl'>
            Корпоративная система тестирования OFFONIKA
          </h1>
          <p className='max-w-md text-sm leading-relaxed text-slate-600 md:text-base'>
            Современный внутренний портал для оценки знаний сотрудников, контроля результатов и удобной аналитики.
          </p>
        </div>

        <Card className='w-full space-y-5 p-6 md:p-8'>
          <div className='space-y-1'>
            <h2 className='text-2xl font-bold text-slate-800'>Вход в систему</h2>
            <p className='text-sm text-slate-500'>Введите рабочие учетные данные</p>
          </div>
          <form onSubmit={submit} className='space-y-3'>
            <Input placeholder='Логин' value={login} onChange={(e) => setLogin(e.target.value)} />
            <Input placeholder='Пароль' type='password' value={password} onChange={(e) => setPassword(e.target.value)} />
            {error && <p className='text-sm text-red-600'>{error}</p>}
            <Button className='w-full'>Войти</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
