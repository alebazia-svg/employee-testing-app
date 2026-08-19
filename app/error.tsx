'use client';

import { useEffect } from 'react';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className='flex min-h-screen items-center justify-center bg-slate-50 px-6'>
      <div className='w-full max-w-sm rounded-3xl bg-white px-6 py-8 text-center shadow-sm ring-1 ring-slate-200/80'>
        <div className='mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-2xl ring-1 ring-amber-200' aria-hidden='true'>!</div>
        <h1 className='mt-5 text-xl font-black text-slate-950'>Не удалось открыть экран</h1>
        <p className='mt-2 text-sm font-semibold leading-relaxed text-slate-500'>Проверьте интернет и попробуйте ещё раз. Введённые данные не отправлялись повторно.</p>
        <button type='button' onClick={reset} className='mt-6 h-12 w-full rounded-xl bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800'>Повторить</button>
      </div>
    </main>
  );
}
