import { RefreshCw } from 'lucide-react';

export default function AcquiringLoading() {
  return (
    <div role="status" aria-live="polite" className="m-5 flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-5 py-6 text-sm text-stone-700">
      <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" />
      Открываем эквайринг…
    </div>
  );
}
