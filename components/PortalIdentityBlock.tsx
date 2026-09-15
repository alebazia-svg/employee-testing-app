import { cn } from '@/lib/utils';
import { PortalWordmark } from '@/components/PortalWordmark';

export function PortalIdentityBlock({
  className,
  label = 'МОБО',
  subtitle,
  variant = 'current',
}: {
  className?: string;
  label?: string;
  subtitle?: string;
  variant?: 'current' | 'mobo-master' | 'mobo-master-material';
}) {
  if (variant === 'mobo-master-material') {
    return (
      <div className={cn('inline-flex items-center gap-3', className)} aria-label='MOBO'>
        <span className='relative w-[48px] shrink-0 sm:w-[58px]'>
          <span className='absolute inset-[7%] rounded-[28%] bg-[#756d63]/14 blur-[8px]' aria-hidden='true' />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src='/brand/mobo-master/mobo-symbol-3d-premium.svg' alt='' className='relative h-auto w-full' />
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/brand/mobo-master/mobo-wordmark.svg' alt='MOBO' className='h-auto w-[128px] sm:w-[154px]' />
      </div>
    );
  }

  if (variant === 'mobo-master') {
    return (
      <div className={cn('inline-flex items-center gap-2.5', className)} aria-label='MOBO'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/brand/mobo-master/mobo-symbol.svg' alt='' className='mobo-master-wordmark h-auto w-[34px] shrink-0' />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/brand/mobo-master/mobo-wordmark.svg' alt='MOBO' className='mobo-master-wordmark h-auto w-0 min-w-0 flex-1' />
      </div>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2.5', className)} aria-label={subtitle ? `${label}. ${subtitle}` : label}>
      <span className='portal-identity-mark relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-[#171c24] shadow-[0_7px_16px_rgba(23,28,36,0.18)]' aria-hidden='true'>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src='/brand/mobo/mark-white.svg' alt='' className='h-7 w-7 object-contain' />
      </span>
      <span className='portal-identity-copy min-w-0'>
        <span className='portal-identity-label block whitespace-nowrap text-[18px] font-extrabold leading-none tracking-[-0.035em] text-[#202936] sm:text-[20px]'>{label === 'МОБО' ? <PortalWordmark className='portal-identity-wordmark' decorative /> : label}</span>
        {subtitle ? <span className='portal-identity-subtitle mt-0.5 block whitespace-nowrap text-[12px] font-semibold leading-[1.2] tracking-[0.015em] text-slate-500'>{subtitle}</span> : null}
      </span>
    </div>
  );
}
