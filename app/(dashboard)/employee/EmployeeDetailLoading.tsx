export function EmployeeDetailLoading() {
  return (
    <main className='employee-material-ui min-h-screen bg-[#151a1d] text-slate-950 md:px-6 md:py-6'>
      <div className='employee-material-shell relative mx-auto min-h-screen w-full max-w-[520px] shadow-2xl md:min-h-[calc(100vh-3rem)] md:overflow-hidden md:rounded-[28px]'>
        <div className='employee-material-header flex items-center justify-between px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]'>
          <div className='flex items-center gap-2.5'>
            <span className='h-11 w-11 animate-pulse rounded-full bg-white/40' />
            <span className='grid gap-2'>
              <span className='h-3.5 w-32 animate-pulse rounded-full bg-white/45' />
              <span className='h-2.5 w-24 animate-pulse rounded-full bg-white/30' />
            </span>
          </div>
          <div className='flex gap-2'>
            <span className='h-11 w-11 animate-pulse rounded-full bg-white/25' />
            <span className='h-11 w-11 animate-pulse rounded-full bg-white/25' />
          </div>
        </div>
        <div className='px-4 pb-5 pt-2'>
          <div className='flex min-h-56 items-center justify-center rounded-[24px] bg-white/80 ring-1 ring-slate-200/80'>
            <div className='text-center'>
              <span className='mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-green-200 border-t-green-700' />
              <p className='mt-3 text-sm font-extrabold text-slate-600'>Открываем…</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
