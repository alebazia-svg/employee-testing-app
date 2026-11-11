import 'server-only';
import type { SourceSnapshot, PlatformaOfdZReport } from './terminal-fiscal-sources';
import type { OneCCashShiftsResult } from './one-c';
import type { OneCCheck, OfdReceipt } from './terminal-fiscal-matching';

export type KkmShiftActivity = {
  kktRegistrationNumber: string; fiscalDriveNumber: string; shiftNumber: string;
  openedAt: string; closedAt: string | null;
};
export type KkmShiftActivitySnapshot = SourceSnapshot<KkmShiftActivity> & { from: string; to: string };
export type KkmNotOpenedProof = {
  from: string; through: string; checkedAt: string; activityCheckedAt: string;
  receiptsCheckedAt: string; oneCCheckedAt: string; previousClosedAt: string;
  previousShiftNumber: string; fiscalDriveNumber: string;
};
export type KkmOneCNotOpenedProof = {
  from: string; through: string; checkedAt: string; oneCCheckedAt: string;
  checksCheckedAt: string; previousClosedAt: string; previousShiftNumber: string;
};

const record = (v: unknown): Record<string, unknown> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
const timestamp = (v: unknown) => typeof v === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) ? Date.parse(v) : NaN;
function fresh(at: string | undefined, now: number) { const t = timestamp(at); return Number.isFinite(t) && t <= now + 30_000 && now - t <= 60_000; }

function couldBeKkmActivity(c: OneCCheck, cashRegisterRef: string, kktRegistrationNumber: string) {
  if (c.cashRegisterRef === cashRegisterRef || c.kktRegistrationNumber === kktRegistrationNumber) return true;
  if (c.cashRegisterRef || c.kktRegistrationNumber) return false;
  // An unfiscalized credit realization is not a KKT operation. Its separate
  // missing-receipt control remains active; it cannot prove a cash shift opened.
  const unfiscalizedRealization = c.sourceType === 'credit_realization' && c.fiscalState === 'unconfirmed'
    && c.fiscalConflict === false && !c.fiscalDriveNumber && !c.fiscalDocumentNumber && !c.fiscalSign && !c.fiscalDateTime;
  return !unfiscalizedRealization;
}

/** Unlike the closure loader, retain explicitly OPEN shifts (closedAt:null).
 * This separate read must never change normal Z-report/cache acceptance. */
export function parseKkmShiftActivity(body: unknown, input: { kktRegistrationNumber: string; from: string; to: string }, now = new Date()): KkmShiftActivitySnapshot {
  const fail: KkmShiftActivitySnapshot = { complete: false, checkedAt: now.toISOString(), data: [], from: input.from, to: input.to, errorCode: 'OFD_OPENING_EVIDENCE_INCOMPLETE' };
  const root = record(body), data = record(root?.data), meta = record(root?.meta), period = record(meta?.period);
  const rows = data?.zReports;
  if (!root || root.ok === false || meta?.complete !== true || !Array.isArray(rows) || rows.length > 1000
    || !Array.isArray(meta.warnings) || meta.warnings.length || !fresh(String(meta.fetchedAt), +now)
    || timestamp(period?.fromUtc) !== timestamp(input.from) || timestamp(period?.toUtc) !== timestamp(input.to)
    || period?.semantics !== '[from,to)') return fail;
  const normalized: KkmShiftActivity[] = [], seen = new Set<string>();
  for (const raw of rows) {
    const row = record(raw), kkt = record(row?.kkt);
    if (!row || kkt?.registrationNumber !== input.kktRegistrationNumber || typeof kkt.fiscalDriveNumber !== 'string' || !kkt.fiscalDriveNumber
      || !/^[1-9]\d*$/.test(String(row.shiftNumber)) || !Number.isSafeInteger(Number(row.shiftNumber))
      || !Number.isFinite(timestamp(row.openedAt)) || !(row.closedAt === null || typeof row.closedAt === 'string' && Number.isFinite(timestamp(row.closedAt)))
      || row.closedAt !== null && timestamp(row.closedAt) < timestamp(row.openedAt)) return fail;
    const at = timestamp(row.closedAt ?? row.openedAt);
    const key = `${kkt.fiscalDriveNumber}:${row.shiftNumber}`;
    if (seen.has(key) || at < timestamp(input.from) || at >= timestamp(input.to)) return fail;
    seen.add(key);
    normalized.push({ kktRegistrationNumber: input.kktRegistrationNumber, fiscalDriveNumber: kkt.fiscalDriveNumber,
      shiftNumber: String(row.shiftNumber), openedAt: row.openedAt as string, closedAt: row.closedAt as string | null });
  }
  return { complete: true, checkedAt: String(meta.fetchedAt), providerFetchedAt: String(meta.fetchedAt), from: input.from, to: input.to, data: normalized };
}

export async function loadKkmShiftActivity(input: { kktRegistrationNumber: string; from: string; to: string }): Promise<KkmShiftActivitySnapshot> {
  const fail = (): KkmShiftActivitySnapshot => ({ complete: false, checkedAt: new Date().toISOString(), data: [], from: input.from, to: input.to, errorCode: 'OFD_OPENING_EVIDENCE_UNAVAILABLE' });
  const base = process.env.PLATFORMA_OFD_PROXY_BASE_URL?.trim().replace(/\/+$/, '');
  if (!base) return fail();
  try {
    const query = new URLSearchParams({ kktRegNumber: input.kktRegistrationNumber, from: input.from, to: input.to });
    const response = await fetch(`${base}/api/v1/ofd/platforma/z-reports?${query}`, { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(3000) });
    return response.ok ? parseKkmShiftActivity(await response.json(), input) : fail();
  } catch { return fail(); }
}

/** A recent prior CLOSED fiscal shift anchors the absence of a carried open
 * shift. An empty response, missing KKT, missing receipts or unavailable source
 * is never evidence that a shift was not opened. */
export function proveKkmNotOpened(input: {
  cashRegisterRef: string; kktRegistrationNumber: string; from: string; through: string;
  activity: KkmShiftActivitySnapshot; shifts: OneCCashShiftsResult;
  checks: SourceSnapshot<OneCCheck>; receipts: SourceSnapshot<OfdReceipt>;
  existingReports: PlatformaOfdZReport[]; now?: Date;
}): KkmNotOpenedProof | null {
  const { activity, shifts, checks, receipts } = input, now = +(input.now ?? new Date());
  const from = timestamp(input.from), through = timestamp(input.through);
  if (!input.cashRegisterRef || !input.kktRegistrationNumber || !Number.isFinite(from) || !Number.isFinite(through)
    || through < from || through > now || !activity.complete || !checks.complete || checks.absenceComplete !== true
    || !receipts.complete || receipts.absenceComplete !== true || shifts.complete !== true
    || shifts.dateFrom !== input.from.slice(0, 10) || shifts.dateTo !== input.from.slice(0, 10)
    || !fresh(activity.checkedAt, now) || !fresh(checks.checkedAt, now) || !fresh(receipts.checkedAt, now) || !fresh(shifts.checkedAt, now)
    || timestamp(activity.from) >= from || timestamp(activity.to) < through
    || existingReportsTouchDay(input.existingReports, input.kktRegistrationNumber, from, through)) return null;
  if (checks.data.some(c => couldBeKkmActivity(c, input.cashRegisterRef, input.kktRegistrationNumber))) return null;
  // Conservatively retain even a draft 1C shift; never turn missing timestamps
  // or a non-posted document into an exemption.
  if (shifts.shifts.some(s => !s.cashRegister.ref || s.cashRegister.ref === input.cashRegisterRef && s.deletionMark !== true)) return null;
  if (receipts.data.length) return null;
  const rows = activity.data;
  if (!rows.length || rows.some(r => r.kktRegistrationNumber !== input.kktRegistrationNumber
    || !Number.isFinite(timestamp(r.openedAt)) || r.closedAt === null || !Number.isFinite(timestamp(r.closedAt))
    || timestamp(r.openedAt) > timestamp(r.closedAt))) return null;
  // Reopening, a current-day empty shift, or a shift spanning midnight all
  // require the existing closing flow, even with zero sales.
  if (rows.some(r => timestamp(r.openedAt) <= through && timestamp(r.closedAt) >= from)) return null;
  const prior = rows.filter(r => timestamp(r.closedAt) < from).sort((a, b) => timestamp(b.closedAt) - timestamp(a.closedAt))[0];
  if (!prior || rows.some(r => r.fiscalDriveNumber !== prior.fiscalDriveNumber)
    || new Set(rows.map(r => r.shiftNumber)).size !== rows.length) return null;
  return { from: input.from, through: input.through, checkedAt: new Date(now).toISOString(), activityCheckedAt: activity.checkedAt,
    receiptsCheckedAt: receipts.checkedAt, oneCCheckedAt: shifts.checkedAt, previousClosedAt: prior.closedAt!, previousShiftNumber: prior.shiftNumber, fiscalDriveNumber: prior.fiscalDriveNumber };
}

function existingReportsTouchDay(rows: PlatformaOfdZReport[], kkt: string, from: number, through: number) {
  return rows.some(r => r.kktRegistrationNumber === kkt && (!Number.isFinite(timestamp(r.closedAt))
    || timestamp(r.openedAt) <= through && timestamp(r.closedAt) >= from));
}

/** Explicitly provisional fallback. It is never a fiscal/OFD confirmation and
 * must leave an ADMIN-only recheck open until the authoritative source returns. */
export function proveKkmNotOpenedInOneC(input: {
  cashRegisterRef: string; kktRegistrationNumber: string; from: string; through: string;
  shifts: OneCCashShiftsResult; checks: SourceSnapshot<OneCCheck>; now?: Date;
}): KkmOneCNotOpenedProof | null {
  const now = +(input.now ?? new Date()), from = timestamp(input.from), through = timestamp(input.through);
  const { shifts, checks } = input;
  if (!input.cashRegisterRef || !input.kktRegistrationNumber || !Number.isFinite(from) || !Number.isFinite(through)
    || through < from || through > now || !shifts.ok || shifts.complete !== true || !checks.complete || checks.absenceComplete !== true
    || !fresh(shifts.checkedAt, now) || !fresh(checks.checkedAt, now)
    || shifts.dateFrom >= input.from.slice(0, 10) || shifts.dateTo !== input.from.slice(0, 10)
    || checks.data.some(c => couldBeKkmActivity(c, input.cashRegisterRef, input.kktRegistrationNumber))
    || shifts.shifts.some(s => !s.cashRegister.ref)) return null;
  const rows = shifts.shifts.filter(s => s.cashRegister.ref === input.cashRegisterRef && s.deletionMark !== true);
  if (!rows.length || rows.some(s => s.posted !== true || !s.status.toLowerCase().includes('закрыт')
    || !Number.isFinite(timestamp(s.openedAt)) || !Number.isFinite(timestamp(s.closedAt))
    || timestamp(s.closedAt) < timestamp(s.openedAt) || timestamp(s.closedAt) >= from)) return null;
  const prior = [...rows].sort((a, b) => timestamp(b.closedAt) - timestamp(a.closedAt))[0];
  return { from: input.from, through: input.through, checkedAt: new Date(now).toISOString(), oneCCheckedAt: shifts.checkedAt,
    checksCheckedAt: checks.checkedAt, previousClosedAt: prior.closedAt, previousShiftNumber: prior.fiscalShiftNumber };
}
