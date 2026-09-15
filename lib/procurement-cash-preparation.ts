export type CashPreparationStep = {
  source: "safe" | "vtb" | "tbank_card" | "tbank_account";
  amountMinor: number;
  transferFromAccountMinor: number;
  note: string;
};

export type ProcurementCashPreparation = {
  state: "ready" | "unavailable";
  dueOn: string;
  requiredMinor: number | null;
  safeCoveredMinor: number | null;
  prepareMinor: number | null;
  unresolvedMinor: number | null;
  vtbDailyCapacityMinor: number | null;
  tbankEstimatedFeeMinor: number | null;
  steps: CashPreparationStep[];
  diagnostics: string[];
};

const VTB_CARD_DAILY_WITHDRAWAL_MINOR = 35_000_000;
const TBANK_PAID_TRANSFER_FIXED_FEE_MINOR = 5_900;

function dayDistance(from: string, to: string) {
  const start = new Date(`${from}T12:00:00.000Z`);
  const end = new Date(`${to}T12:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)
    || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error("CASH_PREPARATION_INVALID_DATE");
  }
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86_400_000));
}

function validMinor(value: number | null) {
  return value === null || (Number.isSafeInteger(value) && value >= 0);
}

function validSignedMinor(value: number | null) {
  return value === null || Number.isSafeInteger(value);
}

/**
 * Builds a conservative cash preparation route for the next mandatory cash
 * payment. It does not move money or assume an unverified bank tariff.
 */
export function buildProcurementCashPreparation(input: {
  asOf: string;
  dueOn: string;
  requiredMinor: number | null;
  safeMinor: number | null;
  vtbCardMinor: number | null;
  vtbAccountMinor: number | null;
  tbankCardMinor: number | null;
  tbankAccountMinor: number | null;
  tbankTransferStatus: "verified" | "review" | "unavailable";
  tbankCurrentRateBps: number | null;
  tbankCurrentTierRemainingMinor: number | null;
}): ProcurementCashPreparation {
  const positions = [input.safeMinor, input.vtbCardMinor, input.vtbAccountMinor,
    input.tbankCardMinor, input.tbankAccountMinor];
  if (!validMinor(input.requiredMinor) || !validMinor(input.tbankCurrentTierRemainingMinor)
    || positions.some((value) => !validSignedMinor(value))
    || (input.tbankCurrentRateBps !== null && (!Number.isSafeInteger(input.tbankCurrentRateBps) || input.tbankCurrentRateBps < 0))) {
    throw new Error("CASH_PREPARATION_INVALID_MONEY");
  }
  const diagnostics: string[] = [];
  if (input.requiredMinor === null) diagnostics.push("cash_requirement_incomplete");
  if ([input.safeMinor, input.vtbCardMinor, input.vtbAccountMinor, input.tbankCardMinor, input.tbankAccountMinor]
    .some((value) => value === null)) diagnostics.push("money_positions_incomplete");
  if (diagnostics.length) {
    return { state: "unavailable", dueOn: input.dueOn, requiredMinor: input.requiredMinor,
      safeCoveredMinor: null, prepareMinor: null, unresolvedMinor: null,
      vtbDailyCapacityMinor: null, tbankEstimatedFeeMinor: null, steps: [], diagnostics };
  }

  const safe = Math.max(0, input.safeMinor!);
  const vtbCard = Math.max(0, input.vtbCardMinor!);
  const vtbAccount = Math.max(0, input.vtbAccountMinor!);
  const tbankCard = Math.max(0, input.tbankCardMinor!);
  const tbankAccount = Math.max(0, input.tbankAccountMinor!);

  const days = dayDistance(input.asOf, input.dueOn);
  const required = input.requiredMinor!;
  const safeCoveredMinor = Math.min(required, safe);
  const prepareMinor = Math.max(0, required - safeCoveredMinor);
  let remaining = prepareMinor;
  const steps: CashPreparationStep[] = [];

  const vtbDailyCapacityMinor = days * VTB_CARD_DAILY_WITHDRAWAL_MINOR;
  const vtbAmount = Math.min(remaining, vtbDailyCapacityMinor, vtbCard + vtbAccount);
  if (vtbAmount > 0) {
    const transferFromAccountMinor = Math.max(0, vtbAmount - vtbCard);
    steps.push({ source: "vtb", amountMinor: vtbAmount, transferFromAccountMinor,
      note: `Лимит снятия с карты ВТБ: 350 000 ₽ в день, доступно дней: ${days}.` });
    remaining -= vtbAmount;
  }

  const tbankCardAmount = Math.min(remaining, tbankCard);
  if (tbankCardAmount > 0) {
    steps.push({ source: "tbank_card", amountMinor: tbankCardAmount, transferFromAccountMinor: 0,
      note: "Деньги уже отражены на вашей карте Т‑Банка." });
    remaining -= tbankCardAmount;
  }

  let tbankEstimatedFeeMinor = 0;
  if (remaining > 0 && input.tbankTransferStatus === "verified" && input.tbankCurrentRateBps !== null
    && input.tbankCurrentTierRemainingMinor !== null) {
    const currentTierCapacity = input.tbankCurrentRateBps >= 1500
      ? tbankAccount
      : input.tbankCurrentTierRemainingMinor;
    const tbankAccountAmount = Math.min(remaining, tbankAccount, currentTierCapacity);
    if (tbankAccountAmount > 0) {
      tbankEstimatedFeeMinor = input.tbankCurrentRateBps === 0 ? 0
        : Math.ceil(tbankAccountAmount * input.tbankCurrentRateBps / 10_000) + TBANK_PAID_TRANSFER_FIXED_FEE_MINOR;
      steps.push({ source: "tbank_account", amountMinor: tbankAccountAmount,
        transferFromAccountMinor: tbankAccountAmount,
        note: input.tbankCurrentRateBps === 0
          ? "Перевод себе на карту укладывается в подтверждённый текущий тарифный уровень."
          : `Ориентировочная комиссия по текущему уровню: ${input.tbankCurrentRateBps / 100}% + 59 ₽.` });
      remaining -= tbankAccountAmount;
    }
    if (remaining > 0 && tbankAccount > tbankAccountAmount) {
      diagnostics.push("tbank_next_tier_needs_review");
    }
  } else if (remaining > 0 && tbankAccount > 0) {
    diagnostics.push("tbank_tariff_needs_review");
  }

  return { state: "ready", dueOn: input.dueOn, requiredMinor: required,
    safeCoveredMinor, prepareMinor, unresolvedMinor: remaining, vtbDailyCapacityMinor,
    tbankEstimatedFeeMinor, steps, diagnostics };
}
