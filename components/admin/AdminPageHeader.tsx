import type { ReactNode } from 'react';

export function AdminPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className='flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
      <div className='min-w-0'>
        {eyebrow && <p className='text-xs font-extrabold uppercase tracking-[0.12em] text-green-700'>{eyebrow}</p>}
        <h1 className='mt-1 text-[28px] font-extrabold tracking-tight text-slate-950 md:text-[32px]'>{title}</h1>
        <p className='mt-1 max-w-3xl text-sm font-medium leading-relaxed text-slate-500'>{description}</p>
      </div>
      {actions && <div className='flex flex-wrap items-center gap-2 xl:shrink-0 xl:justify-end'>{actions}</div>}
    </header>
  );
}
