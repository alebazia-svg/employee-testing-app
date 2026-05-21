export const Table = ({ children }: { children: React.ReactNode }) => (
  <div className='overflow-x-auto rounded-xl border border-border/80'>
    <table className='w-full min-w-[680px] text-sm'>{children}</table>
  </div>
);
