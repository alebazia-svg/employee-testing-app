import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTaxDocumentInput } from '../lib/tax-document-upload';

test('tax document metadata accepts a governed type and month', () => {
  assert.deepEqual(validateTaxDocumentInput({ documentType: 'ENS_OPERATIONS', periodKey: '2026-10' }), { documentType: 'ENS_OPERATIONS', periodKey: '2026-10' });
});

test('tax document metadata rejects unknown types and periods', () => {
  assert.throws(() => validateTaxDocumentInput({ documentType: 'OTHER', periodKey: '2026-10' }));
  assert.throws(() => validateTaxDocumentInput({ documentType: 'ENS_OPERATIONS', periodKey: '10.2026' }));
});
