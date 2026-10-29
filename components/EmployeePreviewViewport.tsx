'use client';

import { useState } from 'react';
import { Monitor, Smartphone } from 'lucide-react';
import { useEmployeePreview } from './EmployeePreviewProvider';

/** Changes only the inspection viewport; the iframe uses the same actor-bound visit. */
export function EmployeePreviewViewport({ visitId, employeeName }: { visitId: string; employeeName: string }) {
  const [device, setDevice] = useState<'phone' | 'desktop'>('phone');
  const preview = useEmployeePreview();
  const topInset = preview?.topInset ?? 64;
  return <section className='min-h-screen bg-[#f1f0ed] pb-6'>
    <div className='sticky z-30 flex justify-center bg-[#f1f0ed] px-4 py-4' style={{ top: topInset }}>
      <div role='group' aria-label='Размер экрана сотрудника' className='inline-flex gap-1 rounded-xl border border-[#d7c4b1] bg-[#eee8df] p-1'>
        {([{ id: 'phone', label: 'Телефон', Icon: Smartphone }, { id: 'desktop', label: 'Компьютер', Icon: Monitor }] as const).map(({ id, label, Icon }) =>
          <button key={id} type='button' aria-pressed={device === id} onClick={() => setDevice(id)} className={`flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${device === id ? 'bg-white text-[#8b5435] shadow-sm' : 'text-slate-600'}`}><Icon size={18} aria-hidden='true'/>{label}</button>)}
      </div>
    </div>
    <div className='overflow-x-auto px-4'>
      <iframe key={device} title={`${device === 'phone' ? 'Мобильный' : 'Компьютерный'} кабинет · ${employeeName}`}
        src={`/admin/employees/preview/${encodeURIComponent(visitId)}?frame=${device}`}
        width={device === 'phone' ? 390 : 1440}
        className={`mx-auto block min-h-[520px] shrink-0 border border-[#d7c4b1] bg-white shadow-sm ${device === 'phone' ? 'rounded-[28px]' : 'rounded-xl'}`}
        style={{ width: device === 'phone' ? 390 : 1440, maxWidth: 'none', height: `min(844px, calc(100dvh - ${topInset + 110}px))` }} />
    </div>
  </section>;
}
