export default function Loading() {
  return (
    <main className='flex min-h-screen items-center justify-center bg-[#f5f3ef] px-6'>
      <div className='w-full max-w-md rounded-3xl bg-white px-8 py-10 text-center shadow-[0_10px_30px_rgba(38,59,92,0.08)] ring-1 ring-[#e1dbd2] md:py-12'>
        <div className='mx-auto h-11 w-11 animate-spin rounded-full border-4 border-slate-200 border-r-amber-400 border-t-[#263b5c]' aria-hidden='true' />
        <p className='mt-5 text-lg font-black text-slate-950'>Загружаем портал</p>
        <p className='mt-1 text-sm font-semibold text-slate-500'>Обычно это занимает несколько секунд.</p>
      </div>
    </main>
  );
}
