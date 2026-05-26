import Link from 'next/link';

export function AdminBreadcrumbs({ current }: { current: string }) {
  return (
    <nav className='mb-4 flex items-center gap-2 text-sm font-semibold text-slate-500' aria-label='Хлебные крошки'>
      <Link href='/admin' className='text-primary transition hover:text-green-700'>
        Главная
      </Link>
      <span className='text-slate-300'>/</span>
      <span className='text-slate-600'>{current}</span>
    </nav>
  );
}
