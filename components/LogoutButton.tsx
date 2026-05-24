'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton({ className = '' }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <Button className={className || 'gap-2 bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900'} onClick={logout}>
      <LogOut className='h-4 w-4' />
      Выйти
    </Button>
  );
}
