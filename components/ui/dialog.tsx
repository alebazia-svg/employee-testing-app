'use client';

export function Dialog({ open, children }: { open: boolean; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className='fixed inset-0 z-50 bg-slate-900/40 p-4 backdrop-blur-sm'>
      <div className='mx-auto mt-20 max-w-md rounded-lg border border-border bg-white p-5 shadow-xl'>{children}</div>
    </div>
  );
}
