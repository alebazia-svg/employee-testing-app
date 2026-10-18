import { isIP } from 'node:net';

/** Opt in only behind a verified proxy which OVERWRITES X-Real-IP and prevents
 * direct public access to the app. Never use the client-controlled first XFF. */
export function accessClientIp(headers: Headers, trusted = process.env.PORTAL_ACCESS_TRUST_REAL_IP === '1'): string | undefined {
  if (!trusted) return;
  const value = headers.get('x-real-ip')?.trim();
  return value && value.length <= 45 && isIP(value) ? value : undefined;
}
