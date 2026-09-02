'use client';

import { useRouter } from 'next/navigation';
import { Logout2Icon as PremiumLogoutIcon } from '@solar-icons/react/bold-duotone';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton({ className = '', iconOnly = false, iconStyle = 'outline', title }: { className?: string; iconOnly?: boolean; iconStyle?: 'outline' | 'duotone'; title?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <Button className={className || 'gap-2 bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900'} onClick={logout} title={title}>
      {iconStyle === 'duotone'
        ? <PremiumLogoutIcon color='#ffffff' secondaryColor='#b9c2bf' secondaryOpacity={0.9} className='h-[22px] w-[22px]' />
        : <LogOut className='h-4 w-4' />}
      {!iconOnly && 'Выйти'}
    </Button>
  );
}
