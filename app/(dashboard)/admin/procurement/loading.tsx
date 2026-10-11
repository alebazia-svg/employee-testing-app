import {AdminShell} from '@/components/AdminShell';

export default function Loading(){
  return <AdminShell><section aria-busy="true" aria-label="Загрузка платёжного календаря" className="mx-auto w-full max-w-[1440px]">
    <h1 className="text-3xl font-extrabold text-slate-950">Платёжный календарь</h1>
    <p role="status" className="mt-3 text-sm text-slate-600">Загружаем заявки и проверяем оплаты…</p>
    <div aria-hidden="true" className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">{[1,2,3,4].map(i=><div key={i} className="flex h-20 items-center gap-8 border-b border-slate-100 px-6"><div className="h-3 w-20 rounded bg-slate-100"/><div className="h-3 w-40 rounded bg-slate-100"/><div className="ml-auto h-4 w-24 rounded bg-slate-100"/></div>)}</div>
  </section></AdminShell>;
}
