export type SupplierDebtForAllocation = {
  supplier: string;
  debtMinor: number;
  priority: number;
  verified: boolean;
};

export type SupplierDebtRecommendation = {
  supplier: string;
  debtMinor: number;
  recommendedMinor: number;
  result: "full" | "partial" | "no_capacity";
  priority: number;
};

export type ProcurementDebtAllocation = {
  state: "ready" | "unavailable";
  debts: SupplierDebtForAllocation[];
  resourcesMinor: number | null;
  mandatoryReserveMinor: number | null;
  availableForDebtMinor: number | null;
  totalDebtMinor: number | null;
  uncoveredDebtMinor: number | null;
  recommendations: SupplierDebtRecommendation[];
  diagnostics: string[];
};

const normalize = (value: string) => value.trim().toLocaleLowerCase("ru-RU")
  .replaceAll("ё", "е")
  .replace(/[‐‑–—]/g, "-")
  .replace(/\s+/g, " ");

const validSignedMinor = (value: number | null) => value === null || Number.isSafeInteger(value);
const validReserveMinor = (value: number | null) => value === null || (Number.isSafeInteger(value) && value >= 0);

/**
 * Conservative decision support. It allocates only money left after known
 * reserves and never treats the recommendation as an approved payment.
 */
export function buildProcurementDebtAllocation(input: {
  resourcesMinor: number | null;
  mandatoryReserveMinor: number | null;
  debts: SupplierDebtForAllocation[];
  resourcesComplete: boolean;
  debtsComplete: boolean;
}): ProcurementDebtAllocation {
  if (!validSignedMinor(input.resourcesMinor) || !validReserveMinor(input.mandatoryReserveMinor)) {
    throw new Error("DEBT_ALLOCATION_INVALID_MONEY");
  }
  const grouped = new Map<string, SupplierDebtForAllocation>();
  for (const debt of input.debts) {
    if (!debt.supplier.trim() || !Number.isSafeInteger(debt.debtMinor) || debt.debtMinor < 0 || !Number.isSafeInteger(debt.priority)) {
      throw new Error("DEBT_ALLOCATION_INVALID_DEBT");
    }
    if (!debt.debtMinor) continue;
    const key = normalize(debt.supplier);
    const current = grouped.get(key);
    if (current) {
      current.debtMinor += debt.debtMinor;
      current.priority = Math.min(current.priority, debt.priority);
      current.verified = current.verified && debt.verified;
    } else {
      grouped.set(key, { ...debt, supplier: debt.supplier.trim() });
    }
  }
  const debts = [...grouped.values()].sort((left, right) => left.priority - right.priority
    || right.debtMinor - left.debtMinor
    || left.supplier.localeCompare(right.supplier, "ru-RU"));
  const totalDebtMinor = debts.reduce((sum, debt) => sum + debt.debtMinor, 0);
  const diagnostics: string[] = [];
  if (!input.resourcesComplete || input.resourcesMinor === null) diagnostics.push("resources_incomplete");
  if (input.mandatoryReserveMinor === null) diagnostics.push("mandatory_reserve_incomplete");
  if (!input.debtsComplete || debts.some((debt) => !debt.verified)) diagnostics.push("debts_incomplete");
  if (diagnostics.length) {
    return {
      state: "unavailable",
      debts,
      resourcesMinor: input.resourcesMinor,
      mandatoryReserveMinor: input.mandatoryReserveMinor,
      availableForDebtMinor: null,
      totalDebtMinor: input.debtsComplete ? totalDebtMinor : null,
      uncoveredDebtMinor: null,
      recommendations: [],
      diagnostics,
    };
  }
  const availableForDebtMinor = Math.max(0, input.resourcesMinor! - input.mandatoryReserveMinor!);
  let remaining = availableForDebtMinor;
  const recommendations = debts.map((debt) => {
    const recommendedMinor = Math.min(debt.debtMinor, remaining);
    remaining -= recommendedMinor;
    return {
      supplier: debt.supplier,
      debtMinor: debt.debtMinor,
      recommendedMinor,
      result: recommendedMinor === 0 ? "no_capacity" as const
        : recommendedMinor === debt.debtMinor ? "full" as const : "partial" as const,
      priority: debt.priority,
    };
  });
  return {
    state: "ready",
    debts,
    resourcesMinor: input.resourcesMinor,
    mandatoryReserveMinor: input.mandatoryReserveMinor,
    availableForDebtMinor,
    totalDebtMinor,
    uncoveredDebtMinor: Math.max(0, totalDebtMinor - availableForDebtMinor),
    recommendations,
    diagnostics,
  };
}
