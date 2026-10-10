import { parseOneCDateTime } from './one-c-date';

/** Planning only: a receipt/RKO is the independent source for actual payment. */
export function plannedFxRubles(amount: unknown, rate: unknown): number | null {
  const foreign=Number(amount), exchange=Number(rate);
  if(!Number.isFinite(foreign)||!Number.isFinite(exchange)||foreign<=0||exchange<=0)return null;
  const cents=Math.round(foreign*exchange*100);
  return Number.isSafeInteger(cents)&&cents>0?cents/100:null;
}

/** Explicit switch of input units only; never rewrites a saved request on read. */
export function plannedFxFromRubles(rubles: string, rate: string, decimals: 2 | 4) {
  const value=Number(rubles), exchange=Number(rate);
  const units=Math.round(value/exchange*10**decimals);
  const foreignAmount=Number.isFinite(value)&&value>0&&Number.isFinite(exchange)&&exchange>0&&Number.isSafeInteger(units)&&units>0
    ? String(units/10**decimals) : '';
  return {foreignAmount,exchangeRate:rate,plannedAmount:String(plannedFxRubles(foreignAmount,rate)??'')};
}

export type PlannedRateReference={rate:number|null;checkedAt:string;sourceLabel:string;conversionAt?:string;documentNumber?:string};

/** Explicit RUB per CNY only. Never infer a currency from the magnitude of a number. */
export function cnyRateFromComment(comment: unknown, knownCny = false): number | null {
  if (typeof comment !== 'string' || comment.length >= 500) return null; // 1C truncates comments at 500.
  const text = comment.toLocaleLowerCase('ru').replace(/\u00a0/g, ' ');
  if (/\b(?:usdt|usd|eur)\b|доллар|евро|юан[^\s]*\s*\/\s*(?:руб|₽)|(?:старый|прежний|неверный|ошибочн|неизвест|уточн)|\?|(?:^|\s)не(?:\s|$)/u.test(text)) return null;
  if (!knownCny && !/(?:юан|\b(?:cny|rmb)\b)/u.test(text)) return null;
  const mentions = [...text.matchAll(/курс(?:у|а|ом)?(?=$|[^а-яё])/gu)];
  if (mentions.length !== 1) return null;
  const match = text.slice(mentions[0].index).match(/^курс(?:у|а|ом)?\s*(?:(?:юан[а-яё]*|cny|rmb)\s*)?[:=]?\s*(\d+(?:[.,]\d{1,6})?)(?![\d.,])/u);
  if (!match) return null;
  const tail = text.slice(mentions[0].index + match[0].length);
  if (/^\s*(?:[-–—/%]|или|до|юан|cny|rmb|коп)/u.test(tail) || /(?:за|\/)\s*\d/u.test(tail)) return null;
  const rate = Number(match[1].replace(',', '.'));
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

export type CnyCommentSource = { comment: unknown; date: string | Date; sourceLabel: string; documentNumber?: string; knownCny?: boolean };
/** A current comment replaces a historical hint, but not an explicitly edited field. */
export function cnyCommentDraftPatch(comment: string, amount: string, currentRate: string, referenceRate?: number | null, previousCommentRate?: number | null) {
  // RUB-only entry is authoritative; a comment must not erase it or invent CNY.
  if(!Number.isFinite(Number(amount))||Number(amount)<=0)return {};
  const rate = cnyRateFromComment(comment, true);
  if (!rate || currentRate && Number(currentRate) !== referenceRate && Number(currentRate) !== previousCommentRate) return {};
  return {exchangeRate:String(rate), plannedAmount:String(plannedFxRubles(amount,rate)??'')};
}

export function latestCnyCommentRate(sources: CnyCommentSource[], now = new Date()): PlannedRateReference | undefined {
  const candidates = sources.flatMap(source => {
    const date = source.date instanceof Date ? source.date : parseOneCDateTime(source.date);
    const rate = cnyRateFromComment(source.comment, source.knownCny);
    return rate && date && Number.isFinite(date.getTime()) && date <= now
      ? [{rate, checkedAt: now.toISOString(), conversionAt: date.toISOString(), sourceLabel: source.sourceLabel, documentNumber: source.documentNumber}] : [];
  }).sort((a,b) => b.conversionAt.localeCompare(a.conversionAt));
  const latest = candidates[0];
  // Conflicting sources at the same timestamp must not depend on array order.
  if (latest && candidates.some(row => row.conversionAt === latest.conversionAt && row.rate !== latest.rate)) return undefined;
  return latest;
}
