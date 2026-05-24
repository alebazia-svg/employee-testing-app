export const Table = ({ children }: { children: React.ReactNode }) => (
  <div className='overflow-x-auto rounded-lg border border-border/80 bg-white'>
    <table className='w-full min-w-[680px] text-sm'>{children}</table>
  </div>
);
