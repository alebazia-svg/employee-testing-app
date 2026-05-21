'use client';
import { useState } from 'react';

export function Tabs({ tabs }: { tabs: { key: string; label: string; content: React.ReactNode }[] }) {
  const [a, setA] = useState(tabs[0]?.key);
  return (
    <div>
      <div className='mb-5 flex flex-wrap gap-2'>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setA(t.key)}
            className={`rounded-lg px-3.5 py-2 text-sm font-medium transition ${a === t.key ? 'bg-primary text-white shadow-sm' : 'border border-border bg-white text-slate-600 hover:border-primary/40 hover:text-slate-900'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.find((t) => t.key === a)?.content}
    </div>
  );
}
