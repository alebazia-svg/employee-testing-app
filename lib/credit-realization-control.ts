import type { OneCSalesRealizationLinks } from '@/lib/one-c';
import { parseOneCDateTime } from '@/lib/one-c-date';

export type CreditControlStatus = 'confirmed' | 'pending' | 'mismatch' | 'needs_review' | 'unavailable';

export type CreditControlReasonCode =
  | 'CONFIRMED_NO_INITIAL_PAYMENT'
  | 'CONFIRMED_WITH_INITIAL_PAYMENT'
  | 'SOURCE_INCOMPLETE'
  | 'REALIZATION_NOT_POSTED'
  | 'REALIZATION_DELETED'
  | 'DIRECT_RETURN_OR_CORRECTION'
  | 'MULTIPLE_DIRECT_PAYMENT_DOCUMENTS'
  | 'FISCAL_EVIDENCE_CONFLICT'
  | 'PAYMENT_DOCUMENT_NOT_POSTED'
  | 'COUNTERPARTY_MISMATCH'
  | 'INVALID_DOCUMENT_AMOUNT'
  | 'FISCAL_GRACE_PERIOD'
  | 'REQUIRED_FISCAL_RECEIPT_MISSING'
  | 'REQUIRED_REALIZATION_FISCAL_RECEIPT_MISSING'
  | 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING'
  | 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING'
  | 'FISCALIZED_FROM_WRONG_SOURCE'
  | 'EXTRA_OR_DUPLICATE_FISCAL_RECEIPT'
  | 'FISCAL_TOTAL_MISMATCH'
  | 'CURRENT_PAYMENT_MISMATCH'
  | 'CREDIT_REMAINDER_MISMATCH'
  | 'FISCAL_RECEIPT_BEFORE_SOURCE_DOCUMENT'
  | 'FISCAL_RECEIPT_AFTER_SALE_DAY'
  | 'CORRECTION_RECEIPT_REQUIRES_ADMIN'
  | 'OFD_RECEIPT_WITHOUT_ONE_C_LINK'
  | 'OFD_CONFIRMATION_MISSING'
  | 'OFD_SOURCE_INCOMPLETE';

export type CreditPaymentKind = 'cash_receipt' | 'acquiring';

export type CreditPaymentDocument = {
  kind: CreditPaymentKind;
  ref: string;
  number: string;
  date: string;
  posted: boolean | null;
  amount: number | null;
  counterpartyRef: string;
};

export type CreditFiscalOperation = {
  datetime: string;
  amount: number | null;
  cashPayment: number | null;
  electronicPayment: number | null;
  prepayment: number | null;
  postpayment: number | null;
  documentType: string;
  fiscalDriveNumber: string;
  fiscalDocumentNumber: string;
  fiscalSign: string;
  fiscalized: boolean;
};

export type CreditFiscalDocument = {
  sourceType: 'realization' | CreditPaymentKind | string;
  documentRef: string;
  operations: CreditFiscalOperation[];
};

export type CreditOfdReceiptEvidence = {
  datetime: string;
  total: number;
  cash: number;
  electronic: number;
  credit: number;
};

export type CreditRealizationControlInput = {
  now: Date;
  graceMinutes?: number;
  realization: {
    ref: string;
    number: string;
    date: string;
    posted: boolean | null;
    deletionMark: boolean | null;
    amount: number | null;
    counterpartyRef: string;
    managerRef: string;
  };
  directPayments: CreditPaymentDocument[];
  fiscalDocuments: CreditFiscalDocument[];
  directReturns: number;
  directCorrections: number;
  completeness: {
    linksComplete: boolean;
    fiscalOperationsComplete: boolean;
    complete: boolean;
    absenceIsHardErrorEligible: boolean;
  };
  fiscalConflictCount?: number;
  ofd: {
    complete: boolean;
    confirmedFiscalKeys: string[];
    unlinkedExactReceipts: CreditOfdReceiptEvidence[];
  };
};

export type CreditRealizationControlResult = {
  status: CreditControlStatus;
  reasonCodes: CreditControlReasonCode[];
  employeeManagerRef: string | null;
  employeeActionEligible: boolean;
  expectedCurrentPayment: number;
  expectedCreditRemainder: number;
  paymentDocumentRef: string | null;
  fiscalOperationCount: number;
  receiptDelayMinutes: number | null;
};

export function buildCreditRealizationControlInput(input: {
  links: OneCSalesRealizationLinks;
  now: Date;
  graceMinutes?: number;
  ofd: CreditRealizationControlInput['ofd'];
}): CreditRealizationControlInput | null {
  const realization = input.links.realization;
  if (!realization) return null;
  const mapPayment = (kind: CreditPaymentKind) => (document: OneCSalesRealizationLinks['cashReceipts']['direct'][number]) => ({
    kind,
    ref: document.ref,
    number: document.number,
    date: document.date,
    posted: document.posted,
    amount: document.amount,
    counterpartyRef: document.counterpartyRef,
  });

  return {
    now: input.now,
    graceMinutes: input.graceMinutes,
    realization: {
      ref: realization.ref,
      number: realization.number,
      date: realization.date,
      posted: realization.posted,
      deletionMark: realization.deletionMark,
      amount: realization.amount,
      counterpartyRef: realization.counterpartyRef,
      managerRef: realization.managerRef,
    },
    directPayments: [
      ...input.links.cashReceipts.direct.map(mapPayment('cash_receipt')),
      ...input.links.acquiring.direct.map(mapPayment('acquiring')),
    ],
    fiscalDocuments: input.links.fiscalControl.documents.map((document) => ({
      sourceType: document.sourceType,
      documentRef: document.documentRef,
      operations: document.operations.map((operation) => ({
        datetime: operation.datetime,
        amount: operation.amount,
        cashPayment: operation.cashPayment,
        electronicPayment: operation.electronicPayment,
        prepayment: operation.prepayment,
        postpayment: operation.postpayment,
        documentType: operation.documentType,
        fiscalDriveNumber: operation.fiscalDriveNumber,
        fiscalDocumentNumber: operation.fiscalDocumentNumber,
        fiscalSign: operation.fiscalSign,
        fiscalized: operation.fiscalized,
      })),
    })),
    directReturns: input.links.returns.direct.length,
    directCorrections: input.links.corrections.direct.length,
    completeness: input.links.completeness,
    fiscalConflictCount: input.links.fiscalControl.conflictCount,
    ofd: input.ofd,
  };
}

const MONEY_TOLERANCE = 0.01;
const DEFAULT_GRACE_MINUTES = 15;
const EARLY_RECEIPT_TOLERANCE_MS = 2 * 60_000;

function amountMatches(left: number | null, right: number) {
  return left !== null && Number.isFinite(left) && Math.abs(left - right) <= MONEY_TOLERANCE;
}

function canonicalFiscalPart(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.replace(/^0+(?=\d)/, '');
}

export function creditFiscalKey(value: Pick<CreditFiscalOperation, 'fiscalDriveNumber' | 'fiscalDocumentNumber' | 'fiscalSign'>) {
  const parts = [value.fiscalDriveNumber, value.fiscalDocumentNumber, value.fiscalSign].map(canonicalFiscalPart);
  return parts.every(Boolean) ? parts.join(':') : '';
}

function uniquePayments(payments: CreditPaymentDocument[]) {
  const byRef = new Map<string, CreditPaymentDocument>();
  for (const payment of payments) byRef.set(`${payment.kind}:${payment.ref}`, payment);
  return [...byRef.values()];
}

function uniqueOperations(documents: CreditFiscalDocument[]) {
  const seen = new Set<string>();
  return documents.flatMap((document) => document.operations.map((operation) => ({ document, operation })))
    // In production UT, FiscalOperations can carry fiscalized=false even when
    // FN+FD+FP are already present. The complete fiscal identity, later
    // confirmed against OFD, is stronger evidence than this technical flag.
    .filter(({ operation }) => operation.fiscalized || Boolean(creditFiscalKey(operation)))
    .filter(({ document, operation }) => {
      const key = creditFiscalKey(operation)
        || `${document.sourceType}:${document.documentRef}:${operation.datetime}:${operation.amount}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function result(
  input: CreditRealizationControlInput,
  status: CreditControlStatus,
  reasonCodes: CreditControlReasonCode[],
  expectedCurrentPayment: number,
  expectedCreditRemainder: number,
  paymentDocumentRef: string | null,
  fiscalOperationCount: number,
): CreditRealizationControlResult {
  return {
    status,
    reasonCodes,
    employeeManagerRef: input.realization.managerRef || null,
    employeeActionEligible: status === 'mismatch'
      && !reasonCodes.includes('FISCAL_RECEIPT_AFTER_SALE_DAY')
      && Boolean(input.realization.managerRef),
    expectedCurrentPayment,
    expectedCreditRemainder,
    paymentDocumentRef,
    fiscalOperationCount,
    receiptDelayMinutes: null,
  };
}

export function evaluateCreditRealization(input: CreditRealizationControlInput): CreditRealizationControlResult {
  const payments = uniquePayments(input.directPayments);
  const allOperations = uniqueOperations(input.fiscalDocuments);
  const fiscalOperationCount = allOperations.length;
  const realizationAmount = input.realization.amount;
  const payment = payments.length === 1 ? payments[0] : null;
  const paymentAmount = payment?.amount ?? 0;
  const expectedCreditRemainder = realizationAmount === null ? 0 : realizationAmount - paymentAmount;

  const finish = (status: CreditControlStatus, reasons: CreditControlReasonCode[]) => result(
    input,
    status,
    reasons,
    paymentAmount,
    expectedCreditRemainder,
    payment?.ref ?? null,
    fiscalOperationCount,
  );

  if (!input.completeness.complete
    || !input.completeness.linksComplete
    || !input.completeness.fiscalOperationsComplete) {
    return finish('unavailable', ['SOURCE_INCOMPLETE']);
  }
  if (input.realization.deletionMark === true) return finish('needs_review', ['REALIZATION_DELETED']);
  if (input.realization.posted !== true) return finish('pending', ['REALIZATION_NOT_POSTED']);
  if (realizationAmount === null || !Number.isFinite(realizationAmount) || realizationAmount < 0) {
    return finish('unavailable', ['INVALID_DOCUMENT_AMOUNT']);
  }
  if (input.directReturns > 0 || input.directCorrections > 0) {
    return finish('needs_review', ['DIRECT_RETURN_OR_CORRECTION']);
  }
  if ((input.fiscalConflictCount ?? 0) > 0) return finish('needs_review', ['FISCAL_EVIDENCE_CONFLICT']);
  if (payments.length > 1) return finish('needs_review', ['MULTIPLE_DIRECT_PAYMENT_DOCUMENTS']);
  if (payment && (payment.amount === null || !Number.isFinite(payment.amount) || payment.amount < 0 || payment.amount > realizationAmount)) {
    return finish('unavailable', ['INVALID_DOCUMENT_AMOUNT']);
  }
  if (payment && payment.posted !== true) return finish('mismatch', ['PAYMENT_DOCUMENT_NOT_POSTED']);
  if (payment
    && input.realization.counterpartyRef
    && payment.counterpartyRef
    && input.realization.counterpartyRef !== payment.counterpartyRef) {
    return finish('mismatch', ['COUNTERPARTY_MISMATCH']);
  }

  const expectedSourceType = payment?.kind ?? 'realization';
  const expectedDocumentRef = payment?.ref ?? input.realization.ref;
  const expectedOperations = allOperations.filter(({ document }) => (
    document.sourceType === expectedSourceType && document.documentRef === expectedDocumentRef
  ));
  const unexpectedOperations = allOperations.filter(({ document }) => !(
    document.sourceType === expectedSourceType && document.documentRef === expectedDocumentRef
  ));

  if (allOperations.some(({ operation }) => /коррекц/i.test(operation.documentType))) {
    return finish('needs_review', ['CORRECTION_RECEIPT_REQUIRES_ADMIN']);
  }

  if (expectedOperations.length === 0) {
    if (unexpectedOperations.length > 0) return finish('mismatch', ['FISCALIZED_FROM_WRONG_SOURCE']);
    if (input.ofd.unlinkedExactReceipts.length > 0) return finish('needs_review', ['OFD_RECEIPT_WITHOUT_ONE_C_LINK']);

    const sourceDates = [input.realization.date, ...(payment ? [payment.date] : [])]
      .map(parseOneCDateTime)
      .filter((value): value is Date => value !== null);
    if (sourceDates.length === 0) return finish('unavailable', ['INVALID_DOCUMENT_AMOUNT']);
    const latestSourceAt = Math.max(...sourceDates.map((value) => value.getTime()));
    const graceMinutes = input.graceMinutes ?? DEFAULT_GRACE_MINUTES;
    if (input.now.getTime() - latestSourceAt < graceMinutes * 60_000) {
      return finish('pending', ['FISCAL_GRACE_PERIOD']);
    }
    if (!input.completeness.absenceIsHardErrorEligible || !input.ofd.complete) {
      return finish('needs_review', ['OFD_SOURCE_INCOMPLETE']);
    }
    return finish('mismatch', [payment?.kind === 'cash_receipt'
      ? 'REQUIRED_CASH_RECEIPT_FISCAL_RECEIPT_MISSING'
      : payment?.kind === 'acquiring'
        ? 'REQUIRED_ACQUIRING_FISCAL_RECEIPT_MISSING'
        : 'REQUIRED_REALIZATION_FISCAL_RECEIPT_MISSING']);
  }

  if (expectedOperations.length > 1 || unexpectedOperations.length > 0) {
    return finish('mismatch', ['EXTRA_OR_DUPLICATE_FISCAL_RECEIPT']);
  }

  const operation = expectedOperations[0].operation;
  if (!amountMatches(operation.amount, realizationAmount)) return finish('mismatch', ['FISCAL_TOTAL_MISMATCH']);

  const expectedCash = payment?.kind === 'cash_receipt' ? paymentAmount : 0;
  const expectedElectronic = payment?.kind === 'acquiring' ? paymentAmount : 0;
  if (!amountMatches(operation.cashPayment, expectedCash)
    || !amountMatches(operation.electronicPayment, expectedElectronic)
    || !amountMatches(operation.prepayment, 0)) {
    return finish('mismatch', ['CURRENT_PAYMENT_MISMATCH']);
  }
  if (!amountMatches(operation.postpayment, expectedCreditRemainder)) {
    return finish('mismatch', ['CREDIT_REMAINDER_MISMATCH']);
  }

  const operationAt = parseOneCDateTime(operation.datetime);
  const sourceAt = parseOneCDateTime(payment?.date ?? input.realization.date);
  const receiptDelayMinutes = operationAt && sourceAt
    ? Math.max(0, Math.round((operationAt.getTime() - sourceAt.getTime()) / 60_000))
    : null;
  if (operationAt
    && sourceAt
    && operationAt.getTime() + EARLY_RECEIPT_TOLERANCE_MS < sourceAt.getTime()) {
    return finish('needs_review', ['FISCAL_RECEIPT_BEFORE_SOURCE_DOCUMENT']);
  }
  if (operationAt
    && sourceAt
    && operationAt.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' })
      !== sourceAt.toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' })) {
    return { ...finish('mismatch', ['FISCAL_RECEIPT_AFTER_SALE_DAY']), receiptDelayMinutes };
  }
  if (!input.ofd.complete) return finish('needs_review', ['OFD_SOURCE_INCOMPLETE']);
  const fiscalKey = creditFiscalKey(operation);
  if (!fiscalKey || !input.ofd.confirmedFiscalKeys.includes(fiscalKey)) {
    return finish('needs_review', ['OFD_CONFIRMATION_MISSING']);
  }

  return {
    ...finish('confirmed', [payment ? 'CONFIRMED_WITH_INITIAL_PAYMENT' : 'CONFIRMED_NO_INITIAL_PAYMENT']),
    receiptDelayMinutes,
  };
}
