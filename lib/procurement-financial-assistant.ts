import type { ProcurementCashPreparation } from "@/lib/procurement-cash-preparation";
import type { ProcurementDebtAllocation } from "@/lib/procurement-debt-allocation";

export type ProcurementAssistantFinding = {
  kind: "cash_gap" | "supplier_payment" | "supplier_review" | "no_action";
  text: string;
};

export type ProcurementFinancialAssistant = {
  state: "ready" | "review" | "unavailable";
  title: string;
  amountMinor: number | null;
  explanation: string;
  evidence: string[];
  findings: ProcurementAssistantFinding[];
  diagnostics: string[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU")
  .replaceAll("ё", "е")
  .replace(/[‐‑–—]/g, "-")
  .replace(/\s+/g, " ");

const isKnownPrioritySupplier = (supplier: string) => {
  const key = normalize(supplier);
  return /^95[\s-]*ru$/.test(key) || key === "зелим чечня";
};

/**
 * Turns verified calculation outputs into one short management recommendation.
 * The assistant never changes source data, approves a request, or invents a
 * supplier classification.
 */
export function buildProcurementFinancialAssistant(input: {
  cashPreparation: ProcurementCashPreparation;
  debtAllocation: ProcurementDebtAllocation;
  dataWarnings: string[];
}): ProcurementFinancialAssistant {
  const diagnostics = [...new Set(input.dataWarnings)];
  if (input.cashPreparation.state !== "ready") diagnostics.push("cash_preparation_unavailable");
  if (input.debtAllocation.state !== "ready") diagnostics.push("debt_allocation_unavailable");

  const controlledDebts = input.debtAllocation.debts.filter((item) => item.debtMinor >= 30_000_000);
  const leadingDebt = controlledDebts[0];

  if (input.cashPreparation.state !== "ready" || input.debtAllocation.state !== "ready") {
    if (leadingDebt) {
      const missing: string[] = [];
      if (input.cashPreparation.state !== "ready") missing.push("остатки и обязательные выплаты");
      if (input.debtAllocation.state !== "ready") missing.push("подтверждение расчёта свободных денег");
      return {
        state: "review",
        title: `На контроле долг ${leadingDebt.supplier}`,
        amountMinor: leadingDebt.debtMinor,
        explanation: `Долг уже виден в текущей выгрузке 1С. Точную сумму платежа портал рассчитает после получения: ${missing.join(" и ")}.`,
        evidence: ["Текущая выгрузка сальдо поставщиков", "Порог крупного долга 300 000 ₽"],
        findings: [
          { kind: "supplier_review", text: "Не терять долг из контроля, даже пока источник денег или окончательная сумма оплаты уточняются." },
          ...controlledDebts.slice(1, 3).map((item) => ({
            kind: "supplier_review" as const,
            text: `Следующий крупный долг: ${item.supplier}.`,
          })),
        ],
        diagnostics,
      };
    }
    return {
      state: "unavailable",
      title: "Сначала обновить данные",
      amountMinor: null,
      explanation: "Портал не даёт финансовую рекомендацию, пока не получены все остатки, обязательные выплаты и долги из 1С.",
      evidence: ["Остатки 1С", "Зарплата", "Сальдо поставщиков"],
      findings: [],
      diagnostics,
    };
  }

  const findings: ProcurementAssistantFinding[] = [];
  const unresolvedCashMinor = input.cashPreparation.unresolvedMinor ?? 0;
  if (unresolvedCashMinor > 0) {
    findings.push({ kind: "cash_gap", text: "Не согласовывать новые необязательные оплаты, пока не найден источник недостающей суммы." });
    return {
      state: "review",
      title: "Найти источник для обязательной выплаты",
      amountMinor: unresolvedCashMinor,
      explanation: "После денег в сейфе, доступного снятия через ВТБ и подтверждённого лимита Т‑Банка часть выплаты остаётся без источника.",
      evidence: ["Остатки 1С", "Зарплата", "Лимиты ВТБ и Т‑Банка"],
      findings,
      diagnostics: [...diagnostics, ...input.cashPreparation.diagnostics],
    };
  }

  const needsCashMinor = input.cashPreparation.prepareMinor ?? 0;
  if (needsCashMinor > 0) {
    const route = input.cashPreparation.steps.map((step) => step.source === "vtb" ? "ВТБ"
      : step.source === "tbank_card" ? "карта Т‑Банка"
        : step.source === "tbank_account" ? "счёт Т‑Банка" : "сейф").join(" → ");
    findings.push({ kind: "cash_gap", text: route ? `Предлагаемый источник: ${route}.` : "Источник снятия показан в расчёте ниже." });
    return {
      state: diagnostics.length ? "review" : "ready",
      title: "Подготовить наличные на обязательную выплату",
      amountMinor: needsCashMinor,
      explanation: "Эта сумма уже зарезервирована и не участвует в рекомендации по оплате поставщиков.",
      evidence: ["Остатки 1С", "Зарплата", "Лимиты ВТБ и Т‑Банка"],
      findings,
      diagnostics: [...diagnostics, ...input.cashPreparation.diagnostics],
    };
  }

  const payable = input.debtAllocation.recommendations.find((item) => item.recommendedMinor > 0);

  if (payable) {
    const priorityNeedsReview = payable.priority >= 4 && !isKnownPrioritySupplier(payable.supplier);
    if (priorityNeedsReview) {
      return {
        state: "review",
        title: `Проверить приоритет поставщика ${payable.supplier}`,
        amountMinor: payable.debtMinor,
        explanation: "Поставщик есть в сальдо 1С, но портал ещё не знает, нужно ли закрывать его долг раньше остальных.",
        evidence: ["Сальдо поставщиков", "Очередь после обязательного резерва"],
        findings: [{ kind: "supplier_review", text: "До подтверждения приоритета сумма не считается рекомендацией к оплате." }],
        diagnostics,
      };
    }
    findings.unshift({
      kind: "supplier_payment",
      text: payable.result === "full"
        ? `Долг ${payable.supplier} можно закрыть полностью.`
        : `Это частичная оплата; после неё останется долг.`,
    });
    return {
      state: diagnostics.length ? "review" : "ready",
      title: `Направить поставщику ${payable.supplier}`,
      amountMinor: payable.recommendedMinor,
      explanation: "Обязательные выплаты уже зарезервированы. Рекомендация использует только свободный остаток.",
      evidence: ["Остатки 1С", "Обязательный резерв", "Сальдо поставщиков"],
      findings,
      diagnostics,
    };
  }

  const totalDebtMinor = input.debtAllocation.totalDebtMinor ?? 0;
  if (totalDebtMinor > 0) {
    return {
      state: "review",
      title: "Поставщикам пока не распределять",
      amountMinor: totalDebtMinor,
      explanation: "После обязательного резерва свободных денег не остаётся. Сумма показывает долг, который пока не обеспечен деньгами.",
      evidence: ["Остатки 1С", "Обязательный резерв", "Сальдо поставщиков"],
      findings,
      diagnostics,
    };
  }

  return {
    state: diagnostics.length ? "review" : "ready",
    title: "Срочных финансовых действий нет",
    amountMinor: null,
    explanation: "Обязательная выплата обеспечена, а подтверждённого долга для распределения сейчас нет.",
    evidence: ["Остатки 1С", "Обязательный резерв", "Сальдо поставщиков"],
    findings: [{ kind: "no_action", text: "Портал пересчитает рекомендацию после обновления данных." }],
    diagnostics,
  };
}
