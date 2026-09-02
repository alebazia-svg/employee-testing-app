'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Logout2Icon as PremiumLogoutIcon } from '@solar-icons/react/bold-duotone';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LogoutButton({
  className = '',
  iconOnly = false,
  iconStyle = 'outline',
  title,
  confirmBeforeLogout = false,
}: {
  className?: string;
  iconOnly?: boolean;
  iconStyle?: 'outline' | 'duotone';
  title?: string;
  confirmBeforeLogout?: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <Button
        className={className || 'gap-2 bg-slate-200 text-slate-700 hover:bg-slate-300 hover:text-slate-900'}
        onClick={() => {
          if (confirmBeforeLogout) {
            setConfirmOpen(true);
            return;
          }
          void logout();
        }}
        title={title}
      >
        {iconStyle === 'duotone'
          ? <PremiumLogoutIcon color='#ffffff' secondaryColor='#b9c2bf' secondaryOpacity={0.9} className='h-[22px] w-[22px]' />
          : <LogOut className='h-4 w-4' />}
        {!iconOnly && 'Выйти'}
      </Button>

      {confirmOpen && createPortal(
        <div
          className='fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/35 backdrop-blur-[2px]'
          role='presentation'
          onClick={() => !isLoggingOut && setConfirmOpen(false)}
        >
          <section
            className='employee-material-sheet w-full max-w-[520px] rounded-t-[28px] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl'
            role='dialog'
            aria-modal='true'
            aria-labelledby='logout-confirm-title'
            onClick={(event) => event.stopPropagation()}
          >
            <div className='mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-300/80' aria-hidden='true' />
            <h2 id='logout-confirm-title' className='text-xl font-black text-slate-950'>Выйти из портала?</h2>
            <p className='mt-1 text-sm font-semibold text-slate-600'>Для продолжения потребуется снова войти.</p>
            <div className='mt-5 grid grid-cols-2 gap-3'>
              <Button
                type='button'
                className='employee-material-secondary-action h-12 font-extrabold'
                onClick={() => setConfirmOpen(false)}
                disabled={isLoggingOut}
              >
                Отмена
              </Button>
              <Button
                type='button'
                className='employee-material-primary-action h-12 font-extrabold'
                onClick={() => void logout()}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? 'Выходим…' : 'Выйти'}
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}
