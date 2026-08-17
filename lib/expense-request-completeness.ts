export const EXPENSE_REQUEST_COMPLETENESS_VERSION = 'preview-2';

export type ExpenseRequestCategory =
  | 'supplier_payment'
  | 'customer_refund'
  | 'accountable_advance'
  | 'salary'
  | 'goods_delivery'
  | 'money_to_supplier'
  | 'communications'
  | 'works_services'
  | 'materials'
  | 'stationery'
  | 'household_purchase'
  | 'packaging'
  | 'rent_utilities'
  | 'other_expense'
  | 'unknown';

export type ExpenseRequestCompletenessState =
  | 'complete'
  | 'needs_clarification'
  | 'needs_document'
  | 'needs_review'
  | 'cannot_determine';

export type ExpenseRequestEvidenceState =
  | 'not_required'
  | 'present_unverified'
  | 'required_before_approval'
  | 'due_after_execution'
  | 'unavailable';

export type ExpenseRequestReasonCode =
  | 'SOURCE_INCOMPLETE'
  | 'CATEGORY_FROM_STRUCTURED_FIELDS'
  | 'CATEGORY_FROM_COMMENT'
  | 'CATEGORY_CONFLICT'
  | 'CATEGORY_UNDETERMINED'
  | 'STRUCTURED_DATA_SUFFICIENT'
  | 'DIRECT_SOURCE_DOCUMENT_PRESENT'
  | 'DIRECT_SOURCE_DOCUMENT_MISSING'
  | 'SUPPLIER_MISSING'
  | 'PAYMENT_BASIS_MISSING'
  | 'DELIVERY_ORIGIN_MISSING'
  | 'DELIVERY_CONTENT_MISSING'
  | 'DELIVERY_DESTINATION_MISSING'
  | 'MONEY_RECIPIENT_MISSING'
  | 'MONEY_OBLIGATION_MISSING'
  | 'INTERNET_ACCOUNT_OR_OBJECT_MISSING'
  | 'INTERNET_PERIOD_MISSING'
  | 'RETURN_SOURCE_DOCUMENT_MISSING'
  | 'ACCOUNTABLE_PURPOSE_MISSING'
  | 'ACCOUNTABLE_DEADLINE_MISSING'
  | 'WORK_PROVIDER_MISSING'
  | 'WORK_SCOPE_MISSING'
  | 'WORK_OBJECT_MISSING'
  | 'PURCHASE_DESCRIPTION_MISSING'
  | 'PAYROLL_SOURCE_DOCUMENT_MISSING'
  | 'EVIDENCE_PRESENT_UNVERIFIED'
  | 'EVIDENCE_REQUIRED_BEFORE_APPROVAL'
  | 'EVIDENCE_DUE_AFTER_EXECUTION'
  | 'REQUESTED_BY_MISSING'
  | 'REQUESTED_BY_UNMAPPED'
  | 'REQUESTED_BY_AMBIGUOUS';

export type ExpenseRequestReasonPolicy =
  | 'employee_confirmed'
  | 'admin_hypothesis'
  | 'admin_safety'
  | 'informational';

export const EXPENSE_REQUEST_REASON_POLICY: Readonly<Record<ExpenseRequestReasonCode, ExpenseRequestReasonPolicy>> = {
  SOURCE_INCOMPLETE: 'admin_safety',
  CATEGORY_FROM_STRUCTURED_FIELDS: 'informational',
  CATEGORY_FROM_COMMENT: 'informational',
  CATEGORY_CONFLICT: 'employee_confirmed',
  CATEGORY_UNDETERMINED: 'employee_confirmed',
  STRUCTURED_DATA_SUFFICIENT: 'informational',
  DIRECT_SOURCE_DOCUMENT_PRESENT: 'informational',
  DIRECT_SOURCE_DOCUMENT_MISSING: 'admin_hypothesis',
  SUPPLIER_MISSING: 'admin_hypothesis',
  PAYMENT_BASIS_MISSING: 'admin_hypothesis',
  DELIVERY_ORIGIN_MISSING: 'employee_confirmed',
  DELIVERY_CONTENT_MISSING: 'employee_confirmed',
  DELIVERY_DESTINATION_MISSING: 'employee_confirmed',
  MONEY_RECIPIENT_MISSING: 'employee_confirmed',
  MONEY_OBLIGATION_MISSING: 'employee_confirmed',
  INTERNET_ACCOUNT_OR_OBJECT_MISSING: 'employee_confirmed',
  INTERNET_PERIOD_MISSING: 'employee_confirmed',
  RETURN_SOURCE_DOCUMENT_MISSING: 'admin_hypothesis',
  ACCOUNTABLE_PURPOSE_MISSING: 'admin_hypothesis',
  ACCOUNTABLE_DEADLINE_MISSING: 'admin_hypothesis',
  WORK_PROVIDER_MISSING: 'employee_confirmed',
  WORK_SCOPE_MISSING: 'employee_confirmed',
  WORK_OBJECT_MISSING: 'admin_hypothesis',
  PURCHASE_DESCRIPTION_MISSING: 'admin_hypothesis',
  PAYROLL_SOURCE_DOCUMENT_MISSING: 'admin_hypothesis',
  EVIDENCE_PRESENT_UNVERIFIED: 'informational',
  EVIDENCE_REQUIRED_BEFORE_APPROVAL: 'admin_hypothesis',
  EVIDENCE_DUE_AFTER_EXECUTION: 'informational',
  REQUESTED_BY_MISSING: 'admin_safety',
  REQUESTED_BY_UNMAPPED: 'admin_safety',
  REQUESTED_BY_AMBIGUOUS: 'admin_safety',
};

export type OneCNamedRef = { ref?: string | null; name?: string | null; value?: string | null };

export type ExpenseRequestInput = {
  ref?: string | null;
  number?: string | null;
  date?: string | null;
  amount?: number | null;
  posted?: boolean | null;
  deletion_mark?: boolean | null;
  status?: OneCNamedRef | null;
  business_operation?: OneCNamedRef | null;
  cash_flow_item?: OneCNamedRef | null;
  counterparty?: OneCNamedRef | null;
  partner?: OneCNamedRef | null;
  comment?: string | null;
  payment_purpose?: string | null;
  requested_by?: OneCNamedRef | null;
  source_document?: OneCNamedRef | null;
  supporting_documents?: { complete?: boolean; rows?: unknown[]; errors?: unknown[] } | null;
  attached_files?: { complete?: boolean; rows?: unknown[]; errors?: unknown[] } | null;
  execution?: { complete?: boolean; state?: string | null } | null;
  completeness?: { complete?: boolean; [key: string]: boolean | undefined } | null;
};

export type ExpenseRequestCompletenessOptions = {
  requestedByEmployeeIds?: Readonly<Record<string, number>>;
};

export type ExpenseRequestCompletenessEvaluation = {
  version: typeof EXPENSE_REQUEST_COMPLETENESS_VERSION;
  requestRef: string | null;
  category: ExpenseRequestCategory;
  categoryCandidates: ExpenseRequestCategory[];
  completenessState: ExpenseRequestCompletenessState;
  evidenceState: ExpenseRequestEvidenceState;
  reasonCodes: ExpenseRequestReasonCode[];
  missingInformation: string[];
  question: string | null;
  decisionSources: string[];
  confidence: 'high' | 'medium' | 'low';
  ambiguous: boolean;
  requestedBy: { ref: string | null; name: string | null };
  routing: { target: 'employee' | 'admin'; employeeId: number | null };
  precheck: {
    target: 'none' | 'employee' | 'admin';
    employeeId: number | null;
    employeeQuestionEligible: boolean;
    confirmedReasonCodes: ExpenseRequestReasonCode[];
    hypothesisReasonCodes: ExpenseRequestReasonCode[];
    safetyReasonCodes: ExpenseRequestReasonCode[];
  };
};

const GENERIC_COUNTERPARTIES = new Set(['доставка', 'хозрасходы', 'розничный покупатель']);
const GENERIC_COMMENTS = new Set([
  '', 'qr', 'доставка', 'доставка товара', 'доставка телефона', 'доставка телефонов',
  'доставка клиенту', 'доставка до клиента', 'отправка денег', 'отправка оплаты',
  'оплата', 'расход', 'купили',
]);

function normalized(value: unknown) {
  return String(value ?? '').toLocaleLowerCase('ru-RU').replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim().replace(/\s+/g, ' ');
}

function namedValue(value: OneCNamedRef | null | undefined) {
  return String(value?.name ?? value?.value ?? '').trim();
}

function hasAny(value: string, words: readonly string[]) {
  return words.some((word) => value.includes(word));
}

function nonGenericNamed(value: OneCNamedRef | null | undefined) {
  const name = normalized(namedValue(value));
  return Boolean(name) && !GENERIC_COUNTERPARTIES.has(name);
}

function hasDirectSource(request: ExpenseRequestInput) {
  return Boolean(request.source_document?.ref || namedValue(request.source_document));
}

function hasEvidenceRows(request: ExpenseRequestInput) {
  return Boolean(request.supporting_documents?.rows?.length || request.attached_files?.rows?.length);
}

function sourceComplete(request: ExpenseRequestInput) {
  if (request.completeness?.complete === false) return false;
  if (request.supporting_documents?.complete === false) return false;
  if (request.attached_files?.complete === false) return false;
  if (request.execution?.complete === false) return false;
  return true;
}

function commentCandidates(comment: string): ExpenseRequestCategory[] {
  const candidates = new Set<ExpenseRequestCategory>();
  if (hasAny(comment, ['отправка денег', 'отправка оплаты', 'отправка долг', 'доставка денег', 'передача денег'])) candidates.add('money_to_supplier');
  if (hasAny(comment, ['доставка', 'курьер', 'забрали телефон', 'забрал телефон'])) candidates.add('goods_delivery');
  if (hasAny(comment, ['интернет', 'связь', 'сим карт', 'телефонная связь'])) candidates.add('communications');
  if (hasAny(comment, ['канц', 'бумаг', 'картридж', 'стикер', 'скотч', 'ручк', 'маркер', 'папк'])) candidates.add('stationery');
  if (hasAny(comment, ['салфет', 'швабр', 'тряп', 'вода', 'кофе', 'резинк', 'хоз', 'уборк'])) candidates.add('household_purchase');
  if (hasAny(comment, ['материал', 'расходник', 'краск', 'лезви', 'шпател', 'пинцет', 'лекал'])) candidates.add('materials');
  if (hasAny(comment, ['работ', 'мастер', 'монтаж', 'ремонт', 'покрас', 'почин'])) candidates.add('works_services');
  if (hasAny(comment, ['короб', 'упаковк', 'пакет'])) candidates.add('packaging');
  if (hasAny(comment, ['аренд', 'электр', 'свет за', 'коммунал'])) candidates.add('rent_utilities');
  return [...candidates];
}

function structuredCategory(request: ExpenseRequestInput): ExpenseRequestCategory | null {
  const cashFlow = normalized(namedValue(request.cash_flow_item));
  const operation = normalized(namedValue(request.business_operation));
  const combined = `${cashFlow} ${operation}`;
  if (combined.includes('возврат оплаты клиенту')) return 'customer_refund';
  if (combined.includes('подотчет')) return 'accountable_advance';
  if (combined.includes('заработн') || combined.includes('зарплат')) return 'salary';
  if (combined.includes('оплата поставщику')) return 'supplier_payment';
  return null;
}

function categoryDecision(request: ExpenseRequestInput) {
  const structured = structuredCategory(request);
  if (structured) return { category: structured, candidates: [structured], confidence: 'high' as const, ambiguous: false, source: 'structured' as const };
  const comment = normalized(request.comment);
  if (comment === 'qr' || /^\d+\s+короб(?:ка|ки|ок)?$/.test(comment)) {
    return { category: 'unknown' as const, candidates: [], confidence: 'low' as const, ambiguous: true, source: 'none' as const };
  }
  const candidates = commentCandidates(comment);
  if (candidates.length === 1) return { category: candidates[0], candidates, confidence: 'medium' as const, ambiguous: false, source: 'comment' as const };
  if (candidates.length > 1) return { category: candidates[0], candidates, confidence: 'low' as const, ambiguous: true, source: 'comment' as const };
  const hasMeaningfulComment = !GENERIC_COMMENTS.has(comment);
  return { category: hasMeaningfulComment ? 'other_expense' as const : 'unknown' as const, candidates: [], confidence: 'low' as const, ambiguous: true, source: 'none' as const };
}

function explicitDeliveryOrigin(comment: string) {
  return /(?:^|\s)(?:с|из|от)\s+[a-zа-я0-9]/i.test(comment);
}

function explicitDeliveryDestination(comment: string) {
  return hasAny(comment, ['клиент', 'до ', 'кому', 'в магазин', 'на склад', 'в офис', 'в москв', 'в краснодар']);
}

function deliveryContents(comment: string) {
  return hasAny(comment, ['телефон', 'товар', 'короб', 'смартфон', 'айфон', 'аксессуар']);
}

function moneyRecipient(comment: string) {
  return /(?:отправка|передача|доставка)\s+(?:денег|оплаты|долга)\s+[a-zа-я0-9]/i.test(comment)
    || /(?:долг|оплата)\s+[a-zа-я0-9]/i.test(comment);
}

function moneyObligation(comment: string) {
  return hasAny(comment, ['долг', 'оплат', 'за ', 'поставка', 'товар', 'телефон']);
}

function internetObject(comment: string) {
  return hasAny(comment, ['лицев', 'счет', 'офис', 'магазин', 'склад', 'искож', 'оператор']) || /интернет\s+[-:]\s+\S+/i.test(comment);
}

function internetPeriod(comment: string) {
  return hasAny(comment, ['январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'])
    || /(?:^|\s)20\d{2}(?:\s|$)/.test(comment)
    || /(?:за|период)\s+(?:\d{1,2}[./-]\d{2,4}|[a-zа-я]+\s+20\d{2})/.test(comment);
}

function accountableDeadline(comment: string) {
  return hasAny(comment, ['срок отчет', 'срок возврат', 'отчитаться до', 'вернуть до'])
    || /(?:до|срок)\s+\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?/.test(comment);
}

function meaningfulPurpose(comment: string) {
  return Boolean(comment) && !GENERIC_COMMENTS.has(comment) && hasAny(comment, [
    'товар', 'телефон', 'короб', 'долг', 'оплат', 'поставка', 'покуп', 'трейд', 'услуг', 'работ',
  ]);
}

function workObject(comment: string) {
  return hasAny(comment, ['склад', 'офис', 'магазин', 'комнат', 'кондиционер', 'двер', 'проводк', 'экран', 'ламп', 'стен', 'камера']);
}

function purchaseDescription(comment: string) {
  const words = comment.split(' ').filter(Boolean);
  return words.length >= 2 && !GENERIC_COMMENTS.has(comment);
}

function exactQuestion(category: ExpenseRequestCategory, missing: string[]) {
  const has = (field: string) => missing.includes(field);
  if (category === 'goods_delivery') {
    const parts: string[] = [];
    if (has('delivery_origin')) parts.push('от какого поставщика или откуда забирали');
    if (has('delivery_contents')) parts.push('что доставляли');
    if (has('delivery_destination')) parts.push('куда или кому доставили');
    return `Укажите, ${parts.join(', ')}.`;
  }
  if (category === 'money_to_supplier') {
    if (has('money_recipient') && has('money_obligation')) return 'Укажите, кому передаются деньги и за какую поставку, задолженность или документ.';
    if (has('money_recipient')) return 'Укажите, кому передаются деньги.';
    return 'Укажите, за какую поставку, задолженность или документ передаются деньги.';
  }
  if (category === 'communications') {
    if (has('internet_account_or_object') && has('internet_period')) return 'Укажите объект или лицевой счёт, за который оплачивается интернет/связь, и оплачиваемый период.';
    if (has('internet_account_or_object')) return 'Укажите объект или лицевой счёт, за который оплачивается интернет/связь.';
    return 'Укажите оплачиваемый период интернета/связи.';
  }
  if (category === 'supplier_payment') {
    if (has('supplier')) return 'Укажите поставщика и документ или поставку, за которую производится оплата.';
    return 'Укажите, за какую поставку или товар производится оплата, либо выберите документ-основание в 1С.';
  }
  if (category === 'customer_refund') return 'Укажите документ возврата клиенту, на основании которого выдаются деньги.';
  if (category === 'accountable_advance') {
    if (has('accountable_purpose') && has('accountable_deadline')) return 'Укажите цель выдачи денег под отчёт и срок отчёта или возврата остатка.';
    if (has('accountable_purpose')) return 'Укажите цель выдачи денег под отчёт.';
    return 'Укажите срок отчёта или возврата остатка по подотчётным деньгам.';
  }
  if (category === 'works_services') {
    const parts: string[] = [];
    if (has('work_provider')) parts.push('кто выполняет работу');
    if (has('work_scope')) parts.push('какая работа или услуга требуется');
    if (has('work_object')) parts.push('для какого объекта или места');
    return `Укажите, ${parts.join(', ')}.`;
  }
  if (category === 'rent_utilities') return 'Укажите объект, за который производится оплата, оплачиваемый период и документ-основание.';
  if (['materials', 'stationery', 'household_purchase', 'packaging'].includes(category)) return 'Укажите, что именно нужно купить и для какой рабочей цели.';
  return 'Выберите вид расхода и укажите, за что требуется выплата.';
}

export function evaluateExpenseRequestCompleteness(
  request: ExpenseRequestInput,
  options: ExpenseRequestCompletenessOptions = {},
): ExpenseRequestCompletenessEvaluation {
  const decision = categoryDecision(request);
  const comment = normalized(request.comment);
  const reasons: ExpenseRequestReasonCode[] = [];
  const missing: string[] = [];
  const sources = new Set<string>();
  let completenessState: ExpenseRequestCompletenessState = 'complete';
  let evidenceState: ExpenseRequestEvidenceState = 'not_required';

  if (!sourceComplete(request)) {
    reasons.push('SOURCE_INCOMPLETE');
    completenessState = 'cannot_determine';
    evidenceState = 'unavailable';
  }
  if (decision.source === 'structured') {
    reasons.push('CATEGORY_FROM_STRUCTURED_FIELDS');
    sources.add('cash_flow_item');
    sources.add('business_operation');
  } else if (decision.source === 'comment') {
    reasons.push('CATEGORY_FROM_COMMENT');
    sources.add('comment');
  } else {
    reasons.push('CATEGORY_UNDETERMINED');
    sources.add('comment');
  }
  if (decision.ambiguous && decision.candidates.length > 1) reasons.push('CATEGORY_CONFLICT');
  if (hasEvidenceRows(request)) {
    reasons.push('EVIDENCE_PRESENT_UNVERIFIED');
    evidenceState = 'present_unverified';
    sources.add('supporting_documents_or_attached_files');
  }

  if (completenessState !== 'cannot_determine' && decision.ambiguous && decision.candidates.length > 1) {
    completenessState = 'needs_review';
    if (evidenceState !== 'present_unverified') evidenceState = 'unavailable';
  } else if (completenessState !== 'cannot_determine') {
    switch (decision.category) {
      case 'supplier_payment': {
        const supplier = nonGenericNamed(request.partner) || nonGenericNamed(request.counterparty);
        const directSource = hasDirectSource(request);
        if (supplier) sources.add('counterparty_or_partner');
        if (directSource) {
          sources.add('source_document');
          reasons.push('DIRECT_SOURCE_DOCUMENT_PRESENT');
        }
        if (supplier && directSource) {
          reasons.push('STRUCTURED_DATA_SUFFICIENT');
          evidenceState = 'present_unverified';
        } else {
          completenessState = 'needs_clarification';
          evidenceState = 'required_before_approval';
          reasons.push('EVIDENCE_REQUIRED_BEFORE_APPROVAL');
          if (!supplier) { missing.push('supplier'); reasons.push('SUPPLIER_MISSING'); }
          if (!directSource) {
            missing.push('payment_basis');
            reasons.push('DIRECT_SOURCE_DOCUMENT_MISSING');
            if (!meaningfulPurpose(comment)) reasons.push('PAYMENT_BASIS_MISSING');
          }
        }
        break;
      }
      case 'customer_refund':
        if (hasDirectSource(request)) {
          sources.add('source_document');
          reasons.push('DIRECT_SOURCE_DOCUMENT_PRESENT', 'STRUCTURED_DATA_SUFFICIENT');
          evidenceState = 'present_unverified';
        } else {
          completenessState = 'needs_document';
          evidenceState = 'required_before_approval';
          missing.push('return_source_document');
          reasons.push('RETURN_SOURCE_DOCUMENT_MISSING', 'EVIDENCE_REQUIRED_BEFORE_APPROVAL');
        }
        break;
      case 'accountable_advance':
        if (evidenceState !== 'present_unverified') evidenceState = 'due_after_execution';
        reasons.push('EVIDENCE_DUE_AFTER_EXECUTION');
        if (!meaningfulPurpose(comment)) {
          completenessState = 'needs_clarification';
          missing.push('accountable_purpose');
          reasons.push('ACCOUNTABLE_PURPOSE_MISSING');
        }
        if (!accountableDeadline(comment)) {
          completenessState = 'needs_clarification';
          missing.push('accountable_deadline');
          reasons.push('ACCOUNTABLE_DEADLINE_MISSING');
        }
        break;
      case 'salary':
        if (hasDirectSource(request)) {
          sources.add('source_document');
          reasons.push('DIRECT_SOURCE_DOCUMENT_PRESENT', 'STRUCTURED_DATA_SUFFICIENT');
          evidenceState = 'present_unverified';
        } else {
          completenessState = 'needs_review';
          evidenceState = 'required_before_approval';
          missing.push('payroll_source_document');
          reasons.push('PAYROLL_SOURCE_DOCUMENT_MISSING', 'EVIDENCE_REQUIRED_BEFORE_APPROVAL');
        }
        break;
      case 'goods_delivery': {
        if (evidenceState !== 'present_unverified') evidenceState = 'due_after_execution';
        reasons.push('EVIDENCE_DUE_AFTER_EXECUTION');
        if (!explicitDeliveryOrigin(comment) && !hasDirectSource(request) && !nonGenericNamed(request.partner)) { missing.push('delivery_origin'); reasons.push('DELIVERY_ORIGIN_MISSING'); }
        if (!deliveryContents(comment) && !hasDirectSource(request)) { missing.push('delivery_contents'); reasons.push('DELIVERY_CONTENT_MISSING'); }
        if (!explicitDeliveryDestination(comment)) { missing.push('delivery_destination'); reasons.push('DELIVERY_DESTINATION_MISSING'); }
        if (missing.length) completenessState = 'needs_clarification';
        break;
      }
      case 'money_to_supplier':
        if (evidenceState !== 'present_unverified') evidenceState = 'due_after_execution';
        reasons.push('EVIDENCE_DUE_AFTER_EXECUTION');
        if (!moneyRecipient(comment) && !nonGenericNamed(request.partner)) { missing.push('money_recipient'); reasons.push('MONEY_RECIPIENT_MISSING'); }
        if (!moneyObligation(comment) && !hasDirectSource(request)) { missing.push('money_obligation'); reasons.push('MONEY_OBLIGATION_MISSING'); }
        if (missing.length) completenessState = 'needs_clarification';
        break;
      case 'communications':
        if (evidenceState !== 'present_unverified') evidenceState = 'due_after_execution';
        reasons.push('EVIDENCE_DUE_AFTER_EXECUTION');
        if (!internetObject(comment) && !nonGenericNamed(request.partner)) { missing.push('internet_account_or_object'); reasons.push('INTERNET_ACCOUNT_OR_OBJECT_MISSING'); }
        if (!internetPeriod(comment)) { missing.push('internet_period'); reasons.push('INTERNET_PERIOD_MISSING'); }
        if (missing.length) completenessState = 'needs_clarification';
        break;
      case 'works_services':
        if (evidenceState !== 'present_unverified') evidenceState = 'due_after_execution';
        reasons.push('EVIDENCE_DUE_AFTER_EXECUTION');
        if (!nonGenericNamed(request.counterparty) && !nonGenericNamed(request.partner)) { missing.push('work_provider'); reasons.push('WORK_PROVIDER_MISSING'); }
        if (!hasAny(comment, ['работ', 'услуг', 'монтаж', 'ремонт', 'покрас', 'почин'])) { missing.push('work_scope'); reasons.push('WORK_SCOPE_MISSING'); }
        if (!workObject(comment) && !hasDirectSource(request)) { missing.push('work_object'); reasons.push('WORK_OBJECT_MISSING'); }
        if (missing.length) completenessState = 'needs_clarification';
        break;
      case 'materials':
      case 'stationery':
      case 'household_purchase':
      case 'packaging':
        if (evidenceState !== 'present_unverified') evidenceState = 'due_after_execution';
        reasons.push('EVIDENCE_DUE_AFTER_EXECUTION');
        if (!purchaseDescription(comment) && !hasDirectSource(request)) {
          completenessState = 'needs_clarification';
          missing.push('purchase_description');
          reasons.push('PURCHASE_DESCRIPTION_MISSING');
        }
        break;
      case 'rent_utilities':
        if (evidenceState !== 'present_unverified') evidenceState = 'required_before_approval';
        reasons.push('EVIDENCE_REQUIRED_BEFORE_APPROVAL');
        if (!internetObject(comment) || !internetPeriod(comment)) {
          completenessState = 'needs_clarification';
          missing.push('rent_or_utility_object_and_period');
        }
        break;
      case 'other_expense':
      case 'unknown':
        completenessState = 'cannot_determine';
        break;
    }
  }

  const requestedByRef = String(request.requested_by?.ref ?? '').trim() || null;
  const requestedByName = String(request.requested_by?.name ?? '').trim() || null;
  const requestedByAmbiguous = normalized(requestedByName) === 'стажеррозница';
  const employeeId = requestedByRef ? options.requestedByEmployeeIds?.[requestedByRef] ?? null : null;
  if (!requestedByRef) reasons.push('REQUESTED_BY_MISSING');
  else if (requestedByAmbiguous) reasons.push('REQUESTED_BY_AMBIGUOUS');
  else if (!employeeId) reasons.push('REQUESTED_BY_UNMAPPED');

  const question = completenessState === 'needs_clarification' || completenessState === 'needs_document' || completenessState === 'cannot_determine'
    ? exactQuestion(decision.category, missing)
    : null;
  const uniqueReasons = [...new Set(reasons)];
  const confirmedReasonCodes = uniqueReasons.filter((reason) => EXPENSE_REQUEST_REASON_POLICY[reason] === 'employee_confirmed');
  const hypothesisReasonCodes = uniqueReasons.filter((reason) => EXPENSE_REQUEST_REASON_POLICY[reason] === 'admin_hypothesis');
  const safetyReasonCodes = uniqueReasons.filter((reason) => EXPENSE_REQUEST_REASON_POLICY[reason] === 'admin_safety');
  const employeeQuestionEligible = Boolean(
    question
    && employeeId
    && !requestedByAmbiguous
    && confirmedReasonCodes.length
    && hypothesisReasonCodes.length === 0
    && safetyReasonCodes.length === 0
    && completenessState !== 'needs_review'
    && !uniqueReasons.includes('CATEGORY_CONFLICT'),
  );
  const precheckTarget = completenessState === 'complete'
    ? 'none'
    : employeeQuestionEligible ? 'employee' : 'admin';

  return {
    version: EXPENSE_REQUEST_COMPLETENESS_VERSION,
    requestRef: String(request.ref ?? '').trim() || null,
    category: decision.category,
    categoryCandidates: decision.candidates,
    completenessState,
    evidenceState,
    reasonCodes: uniqueReasons,
    missingInformation: [...new Set(missing)],
    question,
    decisionSources: [...sources],
    confidence: decision.confidence,
    ambiguous: decision.ambiguous,
    requestedBy: { ref: requestedByRef, name: requestedByName },
    routing: requestedByRef && !requestedByAmbiguous && employeeId
      ? { target: 'employee', employeeId }
      : { target: 'admin', employeeId: null },
    precheck: {
      target: precheckTarget,
      employeeId: employeeQuestionEligible ? employeeId : null,
      employeeQuestionEligible,
      confirmedReasonCodes,
      hypothesisReasonCodes,
      safetyReasonCodes,
    },
  };
}

export function expenseRequestStructuredDataIsSufficient(request: ExpenseRequestInput) {
  const category = structuredCategory(request);
  if (category === 'supplier_payment') return Boolean((nonGenericNamed(request.partner) || nonGenericNamed(request.counterparty)) && hasDirectSource(request));
  if (category === 'customer_refund') return hasDirectSource(request);
  if (category === 'salary') return hasDirectSource(request);
  return false;
}
