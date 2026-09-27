import 'server-only';
import { readOneCRuntimeEnv } from './one-c-env';
import { moscowDateKey } from './one-c-date';
import { DELIVERY_PERSON, DELIVERY_RESERVE } from './procurement-delivery-policy';
import { deliveryCashFromStatement } from './procurement-delivery-evidence';
import type { DeliveryCashSnapshot } from '../components/ProcurementDeliveryCash';

export async function fetchDeliveryCash(): Promise<DeliveryCashSnapshot> {
  const env = readOneCRuntimeEnv();
  if (!env.baseUrl || !env.user || !env.password) throw Error('DELIVERY_SOURCE_UNCONFIGURED');
  const today = moscowDateKey(new Date());
  // Opening/closing include all history; a single-day movement window is sufficient.
  const query = new URLSearchParams({ person_name: DELIVERY_PERSON.name, person_ref: DELIVERY_PERSON.ref, date_from: today, date_to: today }).toString().replace(/\+/g, '%20');
  try {
    const response = await fetch(`${env.baseUrl}/accountable-statement?${query}`, {
      method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json', Authorization: `Basic ${Buffer.from(`${env.user}:${env.password}`).toString('base64')}` },
    });
    if (!response.ok) throw Error('DELIVERY_SOURCE_UNAVAILABLE');
    return deliveryCashFromStatement(await response.json(), { from: today, to: today });
  } catch (error) {
    if (error instanceof Error && /^DELIVERY_[A-Z_]+$/.test(error.message)) throw error;
    throw Error('DELIVERY_SOURCE_UNAVAILABLE');
  }
}

export function unavailableDeliveryCash(): DeliveryCashSnapshot {
  return { balance: null, checkedAt: '', lastIssue: null, reserveAdvice: DELIVERY_RESERVE };
}
