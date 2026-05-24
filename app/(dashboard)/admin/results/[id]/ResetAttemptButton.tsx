'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

export default function ResetAttemptButton({ resultId }: { resultId: number }) {
  const router = useRouter();

  async function reset() {
    if (!window.confirm('Сбросить попытку сотрудника? После этого он сможет пройти аттестацию заново.')) return;
    await fetch(`/api/admin/results/${resultId}/reset`, { method: 'POST' });
    router.push('/admin/results');
    router.refresh();
  }

  return <Button onClick={reset}>Сбросить попытку</Button>;
}
