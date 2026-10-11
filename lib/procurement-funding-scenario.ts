export type FundingEvidence = {
  observedAt: string; capturedAt: string; asOf: string;
  managerAvailable?: boolean;
  forecastPolicy?: {excludedCount:number};
  owner: {accountNames: string[]; positions: {balanceMinor: number; verified: boolean}[]};
  manager: {checkedAt: string; cashboxes: {ref: string; name: string; balance: number; pending: number | null}[]; unassignedCount: number; unassignedAmount: number; reviewCount?: number};
  payroll: {sourceComplete: boolean; warnings: string[]; payableMinor?: number | null};
  plans: {id: string; supplier: string; status: string; plannedDate: string; paymentMethod: string; requestedRub: string; foreignAmount: number | null; orderNumbers?: string[]}[];
  tbank: {status: string; statementDate: string; current: boolean; periodFrom: string; renewsOn: string; freeRemainingMinor: number | null; tierOneRemainingMinor: number | null; transferredMinor: number | null; freeLimitMinor: number | null};
  balances: {usdt: {balance: number | null}; accountable: {balance: number | null}};
  rate: {rate: number | null; conversionAt: string}; extraCash: {name: string; balance: number}[];
};

// Existing production monthly estimate, not a new 1C fact.
export const RENT_RESERVE_MINOR = 23_500_000;
export const VTB_DAILY_MINOR = 35_000_000;
const cents = (n: number) => Number.isFinite(n) && Number.isSafeInteger(Math.round(n * 100)) ? Math.round(n * 100) : null;
const positive = (n: number | null) => n === null ? 0 : Math.max(0, n);
export const addDays = (date: string, amount: number) => {
  const d = new Date(date.slice(0, 10) + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
};
const validDay = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
export function ownerAmount(data: FundingEvidence, name: string): number | null {
  const index = data.owner.accountNames.indexOf(name), position = data.owner.positions[index];
  return index >= 0 && position?.verified && Number.isSafeInteger(position.balanceMinor) ? position.balanceMinor / 100 : null;
}
export type FundingStep = {source: string; amount: number; date: string; kind: 'cash' | 'withdrawal' | 'transfer' | 'wallet' | 'qr'};

/** Local what-if, never an authorization. Each source and daily capacity is consumed once.
 * Missing reservations block readiness, not visibility of dated evidence.
 * Today's unverified withdrawal allowance is excluded. Future dates are a scenario,
 * not evidence of ATM access. Historical T-Bank limits never become current cash.
 */
export function fundingScenario(data: FundingEvidence, ids: readonly string[], options: {includeManagerCash?: boolean} = {}) {
  if (!validDay(data.asOf)) throw Error('FUNDING_INVALID_AS_OF');
  const seen = new Set<string>();
  const plans = data.plans.filter(p => {
    if (seen.has(p.id)) throw Error('FUNDING_DUPLICATE_PLAN');
    seen.add(p.id);
    return ids.includes(p.id) && ['SUBMITTED', 'APPROVED'].includes(p.status);
  }).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate) || a.id.localeCompare(b.id));
  const safeValue = ownerAmount(data, 'Сейф Депозитный'), bankValue = ownerAmount(data, 'ВТБ КБР'), cardValue = ownerAmount(data, 'Банк ВТБ КБР');
  let safe = positive(safeValue === null ? null : cents(safeValue));
  let bank = positive(bankValue === null ? null : cents(bankValue));
  let card = positive(cardValue === null ? null : cents(cardValue));
  const salaryMinor = data.payroll.sourceComplete && Number.isSafeInteger(data.payroll.payableMinor) && data.payroll.payableMinor! >= 0 ? data.payroll.payableMinor! : null;
  const reserveMinor = RENT_RESERVE_MINOR + (salaryMinor ?? 0);
  let reserveLeft = reserveMinor;
  // Reserve before every payment, including those earlier than rent's due date.
  // This is a scenario deduction, not a reservation in any source system.
  const fromBank = Math.min(bank, reserveLeft); bank -= fromBank; reserveLeft -= fromBank;
  const fromCard = Math.min(card, reserveLeft); card -= fromCard; reserveLeft -= fromCard;
  const fromSafe = Math.min(safe, reserveLeft); safe -= fromSafe; reserveLeft -= fromSafe;
  const managersAllowed = data.managerAvailable !== false && data.manager.unassignedCount === 0 && data.manager.reviewCount === 0 && data.manager.cashboxes.every(b => b.pending !== null && b.pending >= 0 && cents(b.pending) !== null && cents(b.balance) !== null);
  const boxes = data.manager.cashboxes.map(b => ({...b, available: managersAllowed && b.pending !== null && cents(b.balance) !== null && cents(b.pending) !== null ? Math.max(0, cents(b.balance)! - cents(b.pending)!) : 0}));
  // A known mandatory reserve takes precedence over suppliers in manager cash too.
  for (const box of [...boxes].sort((a, b) => b.available - a.available || a.ref.localeCompare(b.ref))) {
    const take = Math.min(reserveLeft, box.available); box.available -= take; reserveLeft -= take;
  }
  let qr = data.balances.accountable.balance === null ? null : cents(data.balances.accountable.balance);
  let wallet = data.balances.usdt.balance;
  const dayUse = new Map<string, number>();
  let hasUnknownEarlier = false;
  const rows = plans.map(p => {
    const due = p.plannedDate.slice(0, 10);
    const amount = p.requestedRub.trim() ? cents(Number(p.requestedRub)) : null;
    const methodKnown = ['CASH', 'USDT', 'CNY', 'ACCOUNTABLE_QR', 'BANK'].includes(p.paymentMethod);
    const foreignValid = p.foreignAmount !== null && Number.isFinite(p.foreignAmount) && p.foreignAmount > 0;
    const unknown = amount === null || amount < 0 || !validDay(due) || !methodKnown ||
      (p.paymentMethod === 'USDT' && (!foreignValid || wallet === null || !Number.isFinite(wallet))) ||
      (p.paymentMethod === 'ACCOUNTABLE_QR' && qr === null);
    const blockedByEarlier = hasUnknownEarlier;
    hasUnknownEarlier ||= unknown;
    const steps: FundingStep[] = [];
    if (unknown || blockedByEarlier) return {...p, need: null, gap: null, steps, bankAfter: bank / 100, safeAfter: safe / 100, walletCovered: false, unknown: true, blockedByEarlier};
    const walletCovered = p.paymentMethod === 'USDT' && wallet! >= p.foreignAmount!;
    if (walletCovered) {
      wallet = Math.round((wallet! - p.foreignAmount!) * 1e6) / 1e6;
      steps.push({source: 'Касса USDT', amount: p.foreignAmount!, date: due, kind: 'wallet'});
      return {...p, need: 0, gap: 0, steps, bankAfter: bank / 100, safeAfter: safe / 100, walletCovered, unknown: false, blockedByEarlier};
    }
    let left = amount!;
    if (p.paymentMethod === 'ACCOUNTABLE_QR') {
      const part = Math.min(positive(qr), left); qr = positive(qr) - part; left -= part;
      if (part) steps.push({source: 'Уже на карте для QR', amount: part / 100, date: due, kind: 'qr'});
    }
    const need = left;
    const cash = ['CASH', 'CNY', 'USDT'].includes(p.paymentMethod);
    if (cash) {
      const part = Math.min(safe, left); safe -= part; left -= part;
      if (part) steps.push({source: 'Сейф Депозитный', amount: part / 100, date: due, kind: 'cash'});
      // Prepare close to the due date, not weeks early. Prefer the preceding day;
      // same-day withdrawal is the last option, conditional on collection timing.
      const withdrawalDates: string[] = [];
      for (let day = addDays(due, -1), count = 0; day > data.asOf && count < 90; day = addDays(day, -1), count++) withdrawalDates.push(day);
      if (due > data.asOf) withdrawalDates.push(due);
      const withdrawals: FundingStep[] = [];
      for (const day of withdrawalDates) {
        if (left <= 0) break;
        const take = Math.min(left, VTB_DAILY_MINOR - (dayUse.get(day) ?? 0), bank + card);
        const fromCard = Math.min(take, card); card -= fromCard; bank -= take - fromCard; left -= take;
        dayUse.set(day, (dayUse.get(day) ?? 0) + take);
        if (take) withdrawals.push({source: 'Снять через ВТБ', amount: take / 100, date: day, kind: 'withdrawal'});
      }
      steps.push(...withdrawals.sort((a, b) => a.date.localeCompare(b.date)));
      // Manager tills are an explicit fallback, not automatically emptied before
      // a bank withdrawal. Largest available till first minimizes the till count.
      if (options.includeManagerCash) {
        for (const box of [...boxes].sort((a, b) => b.available - a.available || a.ref.localeCompare(b.ref))) {
          const take = Math.min(left, box.available); left -= take; box.available -= take;
          if (take) steps.push({source: box.name, amount: take / 100, date: due, kind: 'cash'});
        }
      }
    } else {
      const take = Math.min(left, bank); bank -= take; left -= take;
      if (take) steps.push({source: p.paymentMethod === 'ACCOUNTABLE_QR' ? 'ВТБ → карта для QR' : 'ВТБ → карта для перевода', amount: take / 100, date: due, kind: 'transfer'});
    }
    return {...p, need: need / 100, gap: left / 100, steps, bankAfter: bank / 100, safeAfter: safe / 100, walletCovered, unknown: false, blockedByEarlier};
  });
  const total = rows.reduce((sum, r) => sum + Math.round((r.need ?? 0) * 100), 0) / 100;
  return {rows, total, totalComplete: !rows.some(r => r.unknown), bankAfter: bank / 100, safeAfter: safe / 100,
    salaryMinor, reserveMinor, reserveGap: reserveLeft / 100, managersAllowed,
    sourcesKnown: safeValue !== null && bankValue !== null && cardValue !== null,
    reservationsComplete: salaryMinor !== null && managersAllowed,
    boxes, gap: rows.reduce((sum, r) => sum + Math.round((r.gap ?? 0) * 100), 0) / 100,
  };
}
