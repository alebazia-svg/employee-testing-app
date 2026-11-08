'use client';
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { useAdminNavigationFeedback } from './AdminNavigationFeedback';

export default function AdminSectionLink({ children, href, onNavigate, ...props }: Omit<ComponentProps<typeof Link>, 'href'> & { href: string }) {
  const begin = useAdminNavigationFeedback();
  return <Link href={href} {...props} onNavigate={event => {
    let cancelled = false;
    onNavigate?.({ preventDefault: () => { cancelled = true; event.preventDefault(); } });
    if (!cancelled) begin(href);
  }}>{children}</Link>;
}
