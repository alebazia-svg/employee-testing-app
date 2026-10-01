import React from 'react';
import { Wallet } from 'lucide-react';
import { procurementCollectionCopy, type ProcurementCollection } from '@/lib/procurement-collection';

export function ProcurementCollectionNotice({ collection, today }: { collection?: ProcurementCollection; today: string }) {
  if (!collection) return null;
  const copy = procurementCollectionCopy(collection, today);
  return <div className="col-span-full flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-emerald-950" role="note">
    <Wallet className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
    <div className="min-w-0"><p className="text-sm font-bold">{copy.title}</p><p className="mt-0.5 text-sm">{copy.body}</p></div>
  </div>;
}
