import { buildProcurementCashPreparation, type CashPreparationStep } from "@/lib/procurement-cash-preparation";

export type FundingPlan = { id: string; status: string; paymentMethod: string; plannedDate: string; remainingMinor: number; foreignAmount: number | null };
export type RequestFundingAssessment = { planId: string; state: "covered" | "prepare" | "gap" | "unavailable"; title: string; detail: string; amountMinor: number | null; foreignAmount: number | null; steps: CashPreparationStep[] };
type MoneyInput = { asOf: string; plans: FundingPlan[]; salary: { dueOn: string; amountMinor: number | null }; rent: { dueOn: string; amountMinor: number }; safeMinor: number | null; cardsMinor: number | null; bankAccountsMinor: number | null; vtbCardMinor: number | null; vtbAccountMinor: number | null; tbankCardMinor: number | null; tbankAccountMinor: number | null; tbankTransferStatus: "verified" | "review" | "unavailable"; tbankCurrentRateBps: number | null; tbankCurrentTierRemainingMinor: number | null; usdtBalance: number | null; accountableBalanceMinor: number | null; usdtRate: number | null };

const beforeOrOn = (left: string, right: string) => left.slice(0, 10) <= right.slice(0, 10);
const approvedBefore = (plans: FundingPlan[], candidate: FundingPlan, method: string) => plans.filter((plan) => plan.id !== candidate.id && plan.status === "APPROVED" && plan.paymentMethod === method && beforeOrOn(plan.plannedDate, candidate.plannedDate));
const sumMinor = (plans: FundingPlan[]) => plans.reduce((sum, plan) => sum + Math.max(0, plan.remainingMinor), 0);
const planUsdt = (plan: FundingPlan, rate: number | null) => plan.foreignAmount && plan.foreignAmount > 0 ? plan.foreignAmount : rate && rate > 0 && plan.remainingMinor > 0 ? plan.remainingMinor / 100 / rate : null;

const allApproved = (plans: FundingPlan[], candidate: FundingPlan) => plans.filter((plan) => plan.id !== candidate.id && plan.status === "APPROVED");

function rubleCapacity(input: MoneyInput, candidate: FundingPlan) {
  if (input.salary.amountMinor === null || input.safeMinor === null || input.cardsMinor === null || input.bankAccountsMinor === null) return null;
  const approved = allApproved(input.plans, candidate);
  const directRublesMinor = sumMinor(approved.filter((plan) => plan.paymentMethod === "CASH" || plan.paymentMethod === "BANK"));
  const qrTotalMinor = sumMinor(approved.filter((plan) => plan.paymentMethod === "ACCOUNTABLE_QR"));
  const qrTopUpMinor = input.accountableBalanceMinor === null ? null : Math.max(0, qrTotalMinor - input.accountableBalanceMinor);
  const approvedUsdt = approved.filter((plan) => plan.paymentMethod === "USDT").map((plan) => planUsdt(plan, input.usdtRate));
  const usdtTopUpMinor = input.usdtBalance === null || input.usdtRate === null || approvedUsdt.some((amount) => amount === null)
    ? null
    : Math.round(Math.max(0, approvedUsdt.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) - input.usdtBalance) * input.usdtRate * 100);
  if (qrTopUpMinor === null || usdtTopUpMinor === null) return null;
  return {
    totalMinor: input.safeMinor + input.cardsMinor + input.bankAccountsMinor,
    mandatoryMinor: input.salary.amountMinor + input.rent.amountMinor,
    directRublesMinor,
    qrTopUpMinor,
    usdtTopUpMinor,
  };
}

const remainingAfter = (capacity: NonNullable<ReturnType<typeof rubleCapacity>>, extraMinor: number, exclude: "qr" | "usdt" | null = null) => capacity.totalMinor
  - capacity.mandatoryMinor
  - capacity.directRublesMinor
  - (exclude === "qr" ? 0 : capacity.qrTopUpMinor)
  - (exclude === "usdt" ? 0 : capacity.usdtTopUpMinor)
  - extraMinor;

export function assessProcurementRequests(input: MoneyInput): RequestFundingAssessment[] {
  return input.plans.filter((plan) => plan.status === "SUBMITTED").map((candidate) => {
    const dueOn = candidate.plannedDate.slice(0, 10);
    if (candidate.paymentMethod === "USDT") {
      const candidateUsdt = planUsdt(candidate, input.usdtRate);
      const reserved = approvedBefore(input.plans, candidate, "USDT").map((plan) => planUsdt(plan, input.usdtRate));
      if (candidateUsdt === null || reserved.some((value) => value === null) || input.usdtBalance === null) return { planId: candidate.id, state: "unavailable", title: "Обеспеченность USDT уточняется", detail: "Нужны остаток кассы USDT, сумма оплаты и последний курс из 1С.", amountMinor: null, foreignAmount: null, steps: [] };
      const required = candidateUsdt + reserved.reduce<number>((sum, value) => sum + (value ?? 0), 0);
      const shortfall = Math.max(0, required - input.usdtBalance);
      if (!shortfall) return { planId: candidate.id, state: "covered", title: "USDT достаточно", detail: `После этой и уже согласованных оплат останется ${(input.usdtBalance - required).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT.`, amountMinor: 0, foreignAmount: 0, steps: [] };
      const rubMinor = input.usdtRate ? Math.round(shortfall * input.usdtRate * 100) : null;
      const capacity = rubleCapacity(input, candidate);
      if (rubMinor === null || capacity === null) return { planId: candidate.id, state: "unavailable", title: "Пополнение USDT пока не рассчитано", detail: "Нужны курс, остатки денег и суммы обязательных выплат из 1С.", amountMinor: null, foreignAmount: shortfall, steps: [] };
      const uncoveredMinor = Math.max(0, -remainingAfter(capacity, rubMinor, "usdt"));
      if (uncoveredMinor > 0) return { planId: candidate.id, state: "gap", title: `Не хватает ${(uncoveredMinor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: `После резерва на зарплату, аренду и согласованные оплаты рублей для покупки ${shortfall.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT недостаточно.`, amountMinor: uncoveredMinor, foreignAmount: shortfall, steps: [] };
      return { planId: candidate.id, state: "prepare", title: `Купить ${shortfall.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} USDT`, detail: `Потребуется примерно ${(rubMinor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽ по последнему курсу 1С; обязательный резерв сохранится.`, amountMinor: rubMinor, foreignAmount: shortfall, steps: [] };
    }
    if (candidate.paymentMethod === "ACCOUNTABLE_QR") {
      if (input.accountableBalanceMinor === null) return { planId: candidate.id, state: "unavailable", title: "Остаток денег на QR уточняется", detail: "Нужен актуальный остаток денег на карте Астемира из 1С.", amountMinor: null, foreignAmount: null, steps: [] };
      const required = candidate.remainingMinor + sumMinor(approvedBefore(input.plans, candidate, "ACCOUNTABLE_QR"));
      const shortfall = Math.max(0, required - input.accountableBalanceMinor);
      if (!shortfall) return { planId: candidate.id, state: "covered", title: "Денег на QR достаточно", detail: `После этой и уже согласованных QR-оплат останется ${((input.accountableBalanceMinor - required) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽.`, amountMinor: 0, foreignAmount: null, steps: [] };
      const capacity = rubleCapacity(input, candidate);
      if (capacity === null) return { planId: candidate.id, state: "unavailable", title: "Перевод на QR пока не рассчитан", detail: "Нужны остатки денег и суммы обязательных выплат из 1С.", amountMinor: null, foreignAmount: null, steps: [] };
      const uncoveredMinor = Math.max(0, -remainingAfter(capacity, shortfall, "qr"));
      if (uncoveredMinor > 0) return { planId: candidate.id, state: "gap", title: `Не хватает ${(uncoveredMinor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "После зарплаты, аренды и согласованных оплат денег для перевода Астемиру недостаточно.", amountMinor: uncoveredMinor, foreignAmount: null, steps: [] };
      return { planId: candidate.id, state: "prepare", title: `Перевести Астемиру ${(shortfall / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "С учётом уже согласованных QR-оплат текущего остатка на карте не хватит, но обязательный резерв сохранится.", amountMinor: shortfall, foreignAmount: null, steps: [] };
    }
    if (candidate.paymentMethod === "CASH") {
      const capacity = rubleCapacity(input, candidate);
      if (capacity === null) return { planId: candidate.id, state: "unavailable", title: "Наличие денег уточняется", detail: "Нужны сумма зарплаты и актуальные остатки сейфа, карт и счетов из 1С.", amountMinor: null, foreignAmount: null, steps: [] };
      const globalGapMinor = Math.max(0, -remainingAfter(capacity, candidate.remainingMinor));
      if (globalGapMinor > 0) return { planId: candidate.id, state: "gap", title: `Не хватает ${(globalGapMinor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "После зарплаты, аренды и уже согласованных оплат денег на эту заявку недостаточно.", amountMinor: globalGapMinor, foreignAmount: null, steps: [] };
      const approvedCash = sumMinor(approvedBefore(input.plans, candidate, "CASH"));
      const salaryMinor = beforeOrOn(input.salary.dueOn, dueOn) ? input.salary.amountMinor : 0;
      const requiredMinor = salaryMinor === null ? null : salaryMinor + approvedCash + candidate.remainingMinor;
      const route = buildProcurementCashPreparation({ asOf: input.asOf, dueOn, requiredMinor, safeMinor: input.safeMinor, vtbCardMinor: input.vtbCardMinor, vtbAccountMinor: input.vtbAccountMinor, tbankCardMinor: input.tbankCardMinor, tbankAccountMinor: input.tbankAccountMinor, tbankTransferStatus: input.tbankTransferStatus, tbankCurrentRateBps: input.tbankCurrentRateBps, tbankCurrentTierRemainingMinor: input.tbankCurrentTierRemainingMinor });
      if (route.state !== "ready") return { planId: candidate.id, state: "unavailable", title: "Наличие денег уточняется", detail: "Нужны сумма зарплаты и актуальные остатки сейфа, карт и счетов из 1С.", amountMinor: null, foreignAmount: null, steps: [] };
      if ((route.unresolvedMinor ?? 0) > 0) return { planId: candidate.id, state: "gap", title: `Не найден источник для ${((route.unresolvedMinor ?? 0) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "Если согласовать заявку, денег с учётом обязательных выплат будет недостаточно.", amountMinor: route.unresolvedMinor, foreignAmount: null, steps: route.steps };
      if ((route.prepareMinor ?? 0) > 0) return { planId: candidate.id, state: "prepare", title: `Нужно подготовить наличными ${((route.prepareMinor ?? 0) / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "Расчёт учитывает зарплату и уже согласованные наличные оплаты до этой даты.", amountMinor: route.prepareMinor, foreignAmount: null, steps: route.steps };
      return { planId: candidate.id, state: "covered", title: "Наличных достаточно", detail: "Заявка обеспечена деньгами в сейфе с учётом обязательных выплат.", amountMinor: 0, foreignAmount: null, steps: [] };
    }
    const capacity = rubleCapacity(input, candidate);
    if (input.cardsMinor === null || input.bankAccountsMinor === null || capacity === null) return { planId: candidate.id, state: "unavailable", title: "Деньги для перевода уточняются", detail: "Нужны актуальные остатки карт и расчётных счетов из 1С.", amountMinor: null, foreignAmount: null, steps: [] };
    const globalGapMinor = Math.max(0, -remainingAfter(capacity, candidate.remainingMinor));
    if (globalGapMinor > 0) return { planId: candidate.id, state: "gap", title: `Не хватает ${(globalGapMinor / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "После зарплаты, аренды и уже согласованных оплат денег на этот перевод недостаточно.", amountMinor: globalGapMinor, foreignAmount: null, steps: [] };
    const approvedBank = sumMinor(approvedBefore(input.plans, candidate, "BANK"));
    const rentMinor = beforeOrOn(input.rent.dueOn, dueOn) ? input.rent.amountMinor : 0;
    const required = approvedBank + rentMinor + candidate.remainingMinor;
    const cardShortfall = Math.max(0, required - input.cardsMinor);
    const totalShortfall = Math.max(0, required - input.cardsMinor - input.bankAccountsMinor);
    if (totalShortfall > 0) return { planId: candidate.id, state: "gap", title: `Не хватает ${(totalShortfall / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "На картах и расчётных счетах недостаточно денег с учётом аренды и согласованных переводов.", amountMinor: totalShortfall, foreignAmount: null, steps: [] };
    if (cardShortfall > 0) return { planId: candidate.id, state: "prepare", title: `Перевести со счёта на карту ${(cardShortfall / 100).toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`, detail: "После перевода денег хватит на заявку и уже согласованные платежи до этой даты.", amountMinor: cardShortfall, foreignAmount: null, steps: [] };
    return { planId: candidate.id, state: "covered", title: "Денег для перевода достаточно", detail: "Заявка обеспечена остатком на картах с учётом аренды и согласованных платежей.", amountMinor: 0, foreignAmount: null, steps: [] };
  });
}
