import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateExpenseRequestCompleteness,
  expenseRequestStructuredDataIsSufficient,
  type ExpenseRequestInput,
} from '../lib/expense-request-completeness';

const requester = { ref: 'requester-1', name: 'Менеджер' };
const options = { requestedByEmployeeIds: { 'requester-1': 3 } };

function request(overrides: Partial<ExpenseRequestInput> = {}): ExpenseRequestInput {
  return {
    ref: 'request-1', amount: 1_000, comment: '', requested_by: requester,
    completeness: { complete: true },
    supporting_documents: { complete: true, rows: [] },
    attached_files: { complete: true, rows: [] },
    execution: { complete: true, state: 'not_executed' },
    ...overrides,
  };
}

test('supplier payment with supplier and direct source is complete without comment', () => {
  const input = request({
    cash_flow_item: { name: 'Оплата поставщику' }, business_operation: { name: 'Оплата поставщику' },
    partner: { ref: 'supplier', name: 'Поставщик' }, source_document: { ref: 'purchase', name: 'Приобретение товаров и услуг' },
  });
  const result = evaluateExpenseRequestCompleteness(input, options);
  assert.equal(result.category, 'supplier_payment');
  assert.equal(result.completenessState, 'complete');
  assert.equal(result.question, null);
  assert.equal(expenseRequestStructuredDataIsSufficient(input), true);
});

test('customer refund with direct return document does not ask for repeated explanation', () => {
  const result = evaluateExpenseRequestCompleteness(request({
    cash_flow_item: { name: 'Возврат оплаты клиенту' }, business_operation: { name: 'Возврат оплаты клиенту' },
    counterparty: { name: 'Розничный покупатель' }, source_document: { ref: 'return', name: 'Возврат товаров от клиента' },
  }), options);
  assert.equal(result.category, 'customer_refund');
  assert.equal(result.completenessState, 'complete');
  assert.equal(result.question, null);
});

test('delivery asks only concrete missing delivery fields and evidence is due after execution', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Доставка телефона' }), options);
  assert.equal(result.category, 'goods_delivery');
  assert.equal(result.completenessState, 'needs_clarification');
  assert.equal(result.evidenceState, 'due_after_execution');
  assert.deepEqual(result.missingInformation, ['delivery_origin', 'delivery_destination']);
  assert.match(result.question ?? '', /от какого поставщика/);
  assert.match(result.question ?? '', /куда или кому/);
  assert.equal(result.precheck.target, 'employee');
  assert.equal(result.precheck.employeeQuestionEligible, true);
});

test('money transfer without recipient and obligation gets exact question', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Отправка денег' }), options);
  assert.equal(result.category, 'money_to_supplier');
  assert.equal(result.completenessState, 'needs_clarification');
  assert.deepEqual(result.missingInformation, ['money_recipient', 'money_obligation']);
  assert.equal(result.question, 'Укажите, кому передаются деньги и за какую поставку, задолженность или документ.');
});

test('internet without object and period asks both fields', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Оплата интернета' }), options);
  assert.equal(result.category, 'communications');
  assert.equal(result.completenessState, 'needs_clarification');
  assert.deepEqual(result.missingInformation, ['internet_account_or_object', 'internet_period']);
});

test('phrase payment for internet is not mistaken for a billing period', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Оплата за интернет' }), options);
  assert.ok(result.reasonCodes.includes('INTERNET_PERIOD_MISSING'));
});

test('accountable advance requires both purpose and reporting deadline', () => {
  const result = evaluateExpenseRequestCompleteness(request({
    cash_flow_item: { name: 'Выдача подотчетному лицу' },
    business_operation: { name: 'Выдача ДС подотчетнику' },
    comment: 'Покупка расходных материалов',
  }), options);
  assert.equal(result.completenessState, 'needs_clarification');
  assert.deepEqual(result.missingInformation, ['accountable_deadline']);
  assert.match(result.question ?? '', /срок отчёта/);
  assert.equal(result.precheck.target, 'admin');
  assert.ok(result.precheck.hypothesisReasonCodes.includes('ACCOUNTABLE_DEADLINE_MISSING'));
});

test('generic QR and one box are not guessed', () => {
  for (const comment of ['qr', '1 коробка']) {
    const result = evaluateExpenseRequestCompleteness(request({ comment }), options);
    assert.equal(result.completenessState, 'cannot_determine');
    assert.equal(result.confidence, 'low');
    assert.equal(result.ambiguous, true);
  }
});

test('future purchase may be complete while evidence remains due after execution', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Покупка бумаги для кассы' }), options);
  assert.equal(result.category, 'stationery');
  assert.equal(result.completenessState, 'complete');
  assert.equal(result.evidenceState, 'due_after_execution');
});

test('existing attachment presence is preserved instead of being overwritten by due-after policy', () => {
  const result = evaluateExpenseRequestCompleteness(request({
    comment: 'Покупка бумаги для кассы', attached_files: { complete: true, rows: [{}] },
  }), options);
  assert.equal(result.evidenceState, 'present_unverified');
});

test('conflicting comment categories remain admin needs_review', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Покупка материалов и оплата за работу мастера' }), options);
  assert.equal(result.completenessState, 'needs_review');
  assert.equal(result.ambiguous, true);
  assert.ok(result.reasonCodes.includes('CATEGORY_CONFLICT'));
  assert.equal(result.precheck.target, 'admin');
  assert.equal(result.precheck.employeeQuestionEligible, false);
});

test('incomplete source never creates a definitive employee request', () => {
  const result = evaluateExpenseRequestCompleteness(request({
    comment: 'Доставка телефона', completeness: { complete: false },
  }), options);
  assert.equal(result.completenessState, 'cannot_determine');
  assert.equal(result.evidenceState, 'unavailable');
  assert.equal(result.precheck.target, 'admin');
});

test('trainee and unmapped requested_by route only to admin', () => {
  const trainee = evaluateExpenseRequestCompleteness(request({ requested_by: { ref: 'trainee', name: 'СтажерРозница' }, comment: 'Доставка телефона' }), options);
  assert.deepEqual(trainee.routing, { target: 'admin', employeeId: null });
  assert.ok(trainee.reasonCodes.includes('REQUESTED_BY_AMBIGUOUS'));
  assert.equal(trainee.precheck.target, 'admin');
  const unmapped = evaluateExpenseRequestCompleteness(request({ requested_by: { ref: 'unknown', name: 'Другой сотрудник' }, comment: 'Доставка телефона' }), options);
  assert.deepEqual(unmapped.routing, { target: 'admin', employeeId: null });
  assert.ok(unmapped.reasonCodes.includes('REQUESTED_BY_UNMAPPED'));
  assert.equal(unmapped.precheck.target, 'admin');
});

test('mapped requested_by routes by stable ref, not author/name', () => {
  const result = evaluateExpenseRequestCompleteness(request({ requested_by: { ref: 'requester-1', name: 'Другое отображаемое имя' }, comment: 'Доставка телефона' }), options);
  assert.deepEqual(result.routing, { target: 'employee', employeeId: 3 });
  assert.deepEqual(result.precheck.target, 'employee');
});

test('supplier source requirement remains an ADMIN-only hypothesis even for a mapped requester', () => {
  const result = evaluateExpenseRequestCompleteness(request({
    cash_flow_item: { name: 'Оплата поставщику' },
    business_operation: { name: 'Оплата поставщику' },
    partner: { ref: 'supplier', name: 'Поставщик' },
    comment: 'Оплата товара',
  }), options);
  assert.equal(result.completenessState, 'needs_clarification');
  assert.equal(result.precheck.target, 'admin');
  assert.equal(result.precheck.employeeQuestionEligible, false);
  assert.ok(result.precheck.hypothesisReasonCodes.includes('DIRECT_SOURCE_DOCUMENT_MISSING'));
});

test('undetermined category gets a concrete employee question only for a mapped requester', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'qr' }), options);
  assert.equal(result.completenessState, 'cannot_determine');
  assert.equal(result.question, 'Выберите вид расхода и укажите, за что требуется выплата.');
  assert.equal(result.precheck.target, 'employee');
  assert.deepEqual(result.precheck.confirmedReasonCodes, ['CATEGORY_UNDETERMINED']);
});

test('mixed confirmed and hypothetical requirements remain ADMIN-only', () => {
  const result = evaluateExpenseRequestCompleteness(request({ comment: 'Работа мастера' }), options);
  assert.equal(result.category, 'works_services');
  assert.ok(result.precheck.confirmedReasonCodes.includes('WORK_PROVIDER_MISSING'));
  assert.ok(result.precheck.hypothesisReasonCodes.includes('WORK_OBJECT_MISSING'));
  assert.equal(result.precheck.target, 'admin');
});

test('supplier row with enough structured data is never a false positive even with generic comment', () => {
  const input = request({
    comment: 'qr', cash_flow_item: { name: 'Оплата поставщику' }, business_operation: { name: 'Оплата поставщику' },
    counterparty: { ref: 'supplier', name: 'Поставщик' }, source_document: { ref: 'purchase', name: 'Заказ поставщику' },
  });
  const result = evaluateExpenseRequestCompleteness(input, options);
  assert.equal(result.completenessState, 'complete');
  assert.equal(expenseRequestStructuredDataIsSufficient(input), true);
});
