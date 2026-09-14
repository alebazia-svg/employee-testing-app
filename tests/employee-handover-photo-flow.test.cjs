const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the actual UI handler with isolated persistence boundaries.
const source = fs.readFileSync('app/(dashboard)/employee/EmployeeTodayClient.tsx', 'utf8');
const start = source.indexOf('  async function handleHandoverPhotoSelected(');
const end = source.indexOf('  async function sendKkmClosePhotoToAdmin(', start);
assert.ok(start >= 0 && end > start);
const code = ts.transpileModule(source.slice(start, end), {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;

test('draft network failure is translated before reaching the form', async () => {
  const begin = source.indexOf('async function submitFormData<T>');
  const end = source.indexOf('\nfunction photoSavingLabel', begin);
  const compiled = ts.transpileModule(source.slice(begin, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  class NetworkError extends Error {}
  const ctx = { FormData, File, EmployeeNetworkError: NetworkError, fetch: async () => { throw new TypeError('Failed to fetch'); } };
  vm.createContext(ctx); vm.runInContext(compiled, ctx);
  await assert.rejects(() => ctx.submitFormData('/test', 'PATCH', new FormData(), 'fallback'), /Нет связи с порталом/);
});

function harness({ fail = false, final = true } = {}) {
  const state = { saving: false, error: '', saves: 0, submits: 0, step: final ? 2 : 0, message: '' };
  const ctx = {
    Error,
    handoverDraft: { encashmentAmount: '25000', encashmentDirection: 'deposit_safe' },
    handoverStep: state.step,
    setHandoverAttemptedStep() {},
    setHandoverSaveError(value) { state.error = value; },
    setIsSaving(value) { state.saving = value; },
    setHandoverDraft(value) { state.draft = value; ctx.handoverDraft = value; },
    async saveHandoverDraft(task, draft) {
      state.saves++;
      if (fail) throw new Error('Нет связи с порталом');
      return { handoverData: { ...draft, encashmentDocumentPhoto: { storagePath: '/test/photo.jpg' } } };
    },
    isRecord: value => Boolean(value && typeof value === 'object'),
    draftFromHandoverData: value => value,
    buildHandoverSteps: () => ['personalCashBalance', 'reserveCashBalance', 'encashment'],
    async submitHandover(task, draft) { state.submits++; state.submitted = draft; },
    setMessage(value) { state.message = value; },
    setHandoverStep(fn) { state.step = fn(state.step); },
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { state, select: file => ctx.handleHandoverPhotoSelected({ id: 1 }, 'encashmentDocumentPhoto', file), recover: () => { fail = false; } };
}

test('cancelled camera does not save or submit', async () => {
  const h = harness(); await h.select(null);
  assert.equal(h.state.saves, 0); assert.equal(h.state.submits, 0);
});

test('final photo saves before submitting using server photo reference', async () => {
  const h = harness(); await h.select({ name: 'test.jpg' });
  assert.equal(h.state.saves, 1); assert.equal(h.state.submits, 1);
  assert.equal(h.state.submitted.encashmentDocumentPhoto.storagePath, '/test/photo.jpg');
  assert.equal(h.state.submitted.encashmentAmount, '25000');
  assert.equal(h.state.saving, false);
});

test('failed photo save does not complete shift and a retry can recover', async () => {
  const h = harness({ fail: true }); const file = { name: 'test.jpg' };
  await h.select(file);
  assert.equal(h.state.error, 'Нет связи с порталом');
  assert.equal(h.state.submits, 0); assert.equal(h.state.saving, false);
  assert.equal(h.state.draft.encashmentDocumentPhoto, file);
  h.recover(); await h.select(file);
  assert.equal(h.state.error, ''); assert.equal(h.state.submits, 1);
});

test('non-final photo advances without completing handover', async () => {
  const h = harness({ final: false }); await h.select({ name: 'test.jpg' });
  assert.equal(h.state.submits, 0); assert.equal(h.state.step, 1);
  assert.equal(h.state.message, 'Фото прикреплено');
});

test('lost finish response is recovered only from a confirmed completed snapshot', async () => {
  const begin = source.indexOf('  async function submitHandover(');
  const finish = source.indexOf('\n  useEffect(', begin);
  const compiled = ts.transpileModule(source.slice(begin, finish), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  for (const completed of [true, false]) {
    const state = { closed: false, message: '', error: '', calls: 0 };
    class EmployeeApiError extends Error {}
    const ctx = {
      Error, TypeError, FormData, EmployeeApiError, EmployeeNetworkError: class extends Error {},
      handoverDraft: {}, buildHandoverSteps: () => [], isHandoverFile: () => false,
      setError() {}, setIsHandoverKkmCheckPending() {}, setIsSaving() {},
      setHandoverSaveError: value => { state.error = value; },
      setActiveHandoverTaskId: () => { state.closed = true; },
      setMessage: value => { state.message = value; },
      submitFormData: async () => { state.calls++; throw new Error('Connection lost'); },
      syncCurrentWorkdayState: async () => ({ workDay: { status: completed ? 'completed' : 'active' }, shiftControl: { tasks: [{ id: 1, status: completed ? 'done' : 'pending' }] } }),
    };
    vm.createContext(ctx); vm.runInContext(compiled, ctx);
    await ctx.submitHandover({ id: 1 });
    assert.equal(state.calls, 1);
    assert.equal(state.closed, completed);
    assert.equal(state.message, completed ? 'Рабочий день завершён' : '');
    assert.equal(state.error, completed ? '' : 'Connection lost');
  }
});
