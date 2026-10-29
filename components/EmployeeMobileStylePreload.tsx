import { getReleaseInfo } from '@/lib/release-info';

/** Prepare the mobile shell before hydration, without applying its theme on desktop. */
export function EmployeeMobileStylePreload() {
  const version = encodeURIComponent(getReleaseInfo().version);
  return <>{['pwa-visual-proposal', 'pwa-design-studio', 'pwa-copper'].map(name =>
    <link key={name} rel='preload' as='style' media='(max-width: 767px)' href={`/${name}.css?v=${version}`} />
  )}</>;
}
