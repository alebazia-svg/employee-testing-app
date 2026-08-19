export default function Loading() {
  return (
    <main className='flex min-h-screen items-center justify-center bg-slate-50 px-6'>
      <div className='w-full max-w-sm rounded-3xl bg-white px-6 py-8 text-center shadow-sm ring-1 ring-slate-200/80'>
        <div className='mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-green-600' aria-hidden='true' />
        <p className='mt-5 text-lg font-black text-slate-950'>Загружаем портал</p>
        <p className='mt-1 text-sm font-semibold text-slate-500'>Обычно это занимает несколько секунд.</p>
      </div>
    </main>
  );
}
