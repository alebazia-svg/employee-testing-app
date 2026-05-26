export const Table = ({ children }: { children: React.ReactNode }) => (
  <div className='overflow-x-auto rounded-lg border border-slate-200/80 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.04)]'>
    <table className='w-full min-w-[680px] border-separate border-spacing-0 text-sm'>{children}</table>
  </div>
);
