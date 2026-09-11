import { cn } from '@/lib/utils';

export function PortalIdentityBlock({
  className,
  label = 'Портал команды',
  subtitle,
}: {
  className?: string;
  label?: string;
  subtitle?: string;
}) {
  return (
    <div className={cn('inline-flex items-center gap-2.5', className)} aria-label={subtitle ? `${label}. ${subtitle}` : label}>
      <span className='portal-identity-mark relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-[#171c24] shadow-[0_7px_16px_rgba(23,28,36,0.18)]' aria-hidden='true'>
        <svg viewBox='0 0 36 36' className='h-7 w-7'>
          <path d='M8 26V10M28 10v16M8 10l10 10' fill='none' stroke='white' strokeWidth='5.1' strokeLinecap='round' strokeLinejoin='round' />
          <path d='M18 20l10-10' fill='none' stroke='#ffc247' strokeWidth='5.1' strokeLinecap='round' />
        </svg>
      </span>
      <span className='portal-identity-copy min-w-0'>
        <span className='portal-identity-label block whitespace-nowrap text-[18px] font-extrabold leading-none tracking-[-0.035em] text-[#202936] sm:text-[20px]'>{label}</span>
        {subtitle ? <span className='portal-identity-subtitle mt-1 block whitespace-nowrap text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-slate-500'>{subtitle}</span> : null}
      </span>
    </div>
  );
}
