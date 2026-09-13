export function PortalWordmark({
  className,
  decorative = false,
  variant = 'white',
}: {
  className?: string;
  decorative?: boolean;
  variant?: 'blue' | 'graphite' | 'white';
}) {
  const name = variant === 'white' ? 'mobo-white' : `mobo-${variant}-amber`;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/brand/mobo/${name}.svg`}
        width={640}
        height={154}
        className={`portal-approved-wordmark ${className || ''}`}
        alt={decorative ? '' : 'MOBO'}
        aria-hidden={decorative || undefined}
      />
    </>
  );
}
