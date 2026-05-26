import Image from 'next/image';
import { cn } from '@/lib/utils';

type BrandSize = 'login' | 'header' | 'sidebar';

const logoConfig: Record<BrandSize, { src: string; className: string }> = {
  login: {
    src: '/logo-offonika-full.webp',
    className: 'w-[290px] sm:w-[360px] lg:w-[460px]',
  },
  header: {
    src: '/logo-offonika-sidebar.webp',
    className: 'w-[190px] md:w-[215px]',
  },
  sidebar: {
    src: '/logo-offonika-sidebar.webp',
    className: 'w-[190px]',
  },
};

export function BrandBlock({
  large = false,
  size,
}: {
  dark?: boolean;
  compact?: boolean;
  large?: boolean;
  size?: BrandSize;
}) {
  const brandSize = size ?? (large ? 'login' : 'header');
  const config = logoConfig[brandSize];

  return (
    <div className='inline-flex min-w-0 items-start'>
      <Image
        src={config.src}
        alt='OFFONIKA'
        width={1873}
        height={274}
        priority={large}
        className={cn('h-auto max-w-full object-contain', config.className)}
      />
    </div>
  );
}

export function LoginLogo() {
  return <BrandBlock size='login' />;
}
