export default function OfdLoading() {
  return (
    <main className='min-h-screen bg-slate-50 px-5 py-8 md:px-8'>
      <div className='mx-auto max-w-5xl rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200/80'>
        <div className='flex items-center gap-4'>
          <div className='h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-slate-200 border-t-green-600' aria-hidden='true' />
          <div>
            <h1 className='text-xl font-black text-slate-950'>Загружаем сверку ОФД и 1С</h1>
            <p className='mt-1 text-sm font-semibold text-slate-500'>Большой период может обрабатываться несколько секунд.</p>
          </div>
        </div>
        <div className='mt-7 grid animate-pulse gap-3 sm:grid-cols-3'>
          <div className='h-24 rounded-2xl bg-slate-100' />
          <div className='h-24 rounded-2xl bg-slate-100' />
          <div className='h-24 rounded-2xl bg-slate-100' />
        </div>
      </div>
    </main>
  );
}
