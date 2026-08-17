export type TerminalFiscalMappingIdentity = {
  terminalKey: string;
  oneCAcquiringTerminalRef: string;
  oneCCashRegisterRef: string;
  kktRegistrationNumber: string;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
};

export type TerminalFiscalMappingConflictField = 'terminalKey' | 'oneCCashRegisterRef' | 'kktRegistrationNumber';

export function mappingPeriodsOverlap(a: Pick<TerminalFiscalMappingIdentity, 'effectiveFrom' | 'effectiveTo'>, b: Pick<TerminalFiscalMappingIdentity, 'effectiveFrom' | 'effectiveTo'>) {
  const aTo = a.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTo = b.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.effectiveFrom.getTime() < bTo && b.effectiveFrom.getTime() < aTo;
}

export function terminalFiscalMappingConflictFields(
  candidate: TerminalFiscalMappingIdentity,
  existing: TerminalFiscalMappingIdentity,
): TerminalFiscalMappingConflictField[] {
  if (!mappingPeriodsOverlap(candidate, existing)) return [];
  const fields: TerminalFiscalMappingConflictField[] = [];
  if (candidate.terminalKey === existing.terminalKey) fields.push('terminalKey');
  if (candidate.oneCCashRegisterRef === existing.oneCCashRegisterRef) fields.push('oneCCashRegisterRef');
  if (candidate.kktRegistrationNumber === existing.kktRegistrationNumber) fields.push('kktRegistrationNumber');
  return fields;
}
