import Image from 'next/image';
import { cn } from '@/lib/utils';

type BrandSize = 'login' | 'header' | 'sidebar';

const logoSizes: Record<BrandSize, string> = {
  login: 'w-[245px] md:w-[285px]',
  header: 'w-[170px] md:w-[190px]',
  sidebar: 'w-[170px]',
};

const captionSizes: Record<BrandSize, string> = {
  login: '-mt-8 w-[245px] text-[13px] md:-mt-9 md:w-[285px] md:text-sm',
  header: '-mt-5 w-[170px] text-[11px] md:-mt-6 md:w-[190px] md:text-xs',
  sidebar: '-mt-5 w-[170px] text-[11px]',
};

export function BrandBlock({
  compact = false,
  large = false,
  size,
}: {
  dark?: boolean;
  compact?: boolean;
  large?: boolean;
  size?: BrandSize;
}) {
  const brandSize = size ?? (large ? 'login' : 'header');

  return (
    <div className='inline-flex min-w-0 flex-col items-start'>
      <Image
        src='/offonika-wordmark.png'
        alt='OFFONIKA'
        width={2048}
        height={682}
        priority={large}
        className={cn('h-auto max-w-full object-contain mix-blend-multiply', logoSizes[brandSize])}
      />
      {!compact && <p className={cn('text-center font-semibold leading-none text-slate-500', captionSizes[brandSize])}>Система аттестации сотрудников</p>}
    </div>
  );
}

export function LoginLogo() {
  return <BrandBlock size='login' />;
}
