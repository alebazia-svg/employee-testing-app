import { AdminShell } from '@/components/AdminShell';

export default function TaxesLoading() {
  return <AdminShell pageTitle='Налоги' pageDescription='Лимит дохода, налог по месяцам и сверка с налоговой.'>
    <div role='status' aria-live='polite' className='rounded-xl border border-[#e7e1d9] bg-white p-6'>
      <p className='text-sm text-[#796e64]'>Открываем сохранённые данные…</p>
      <div aria-hidden='true' className='mt-5 grid grid-cols-2 gap-4 motion-safe:animate-pulse'>
        <div className='h-24 rounded-lg bg-[#f5f2ed]' /><div className='h-24 rounded-lg bg-[#f5f2ed]' />
        <div className='col-span-2 h-36 rounded-lg bg-[#f5f2ed]' />
      </div>
    </div>
  </AdminShell>;
}
