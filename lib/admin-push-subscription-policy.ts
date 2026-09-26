export const DEFAULT_ADMIN_PUSH_PRIMARY_HOST = 'team.mobo-opt.ru';
export const DEFAULT_ADMIN_PUSH_LEGACY_HOST = 'portal.alebazia.xyz';

export type AdminPushRegistrationMode = 'primary-single' | 'legacy-disabled' | 'standard';

function normalizeHost(value: string | null | undefined) {
  const first = value?.split(',')[0]?.trim().toLowerCase() ?? '';
  return first.replace(/:\d+$/, '');
}

export function requestHost(request: Request) {
  const forwardedHost = normalizeHost(request.headers.get('x-forwarded-host'));
  if (forwardedHost) return forwardedHost;
  const host = normalizeHost(request.headers.get('host'));
  if (host) return host;
  return normalizeHost(new URL(request.url).host);
}

export function adminPushRegistrationMode(
  host: string,
  input: { primaryHost?: string; legacyHost?: string } = {},
): AdminPushRegistrationMode {
  const normalizedHost = normalizeHost(host);
  const primaryHost = normalizeHost(input.primaryHost || DEFAULT_ADMIN_PUSH_PRIMARY_HOST);
  const legacyHost = normalizeHost(input.legacyHost || DEFAULT_ADMIN_PUSH_LEGACY_HOST);
  if (normalizedHost === primaryHost) return 'primary-single';
  if (normalizedHost === legacyHost) return 'legacy-disabled';
  return 'standard';
}

export function adminPushRegistrationModeForRequest(request: Request) {
  return adminPushRegistrationMode(requestHost(request), {
    primaryHost: process.env.ADMIN_PUSH_PRIMARY_HOST,
    legacyHost: process.env.PORTAL_DOMAIN,
  });
}
