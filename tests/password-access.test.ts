import assert from 'node:assert/strict';
import test from 'node:test';
import { generateEmployeePassword, passwordRequestAllowed, passwordValidationError } from '../lib/password-access';
import { employeeAccessMessage } from '../lib/employee-access-message';

test('administrator passwords retain the long format and bcrypt limits', () => {
  const passwords = Array.from({ length: 100 }, () => generateEmployeePassword('ADMIN'));
  assert.equal(new Set(passwords).size, 100);
  assert.ok(passwords.every(value => /^[A-Za-z2-9]{4}(?:-[A-Za-z2-9]{4}){3}$/.test(value)));
  assert.ok(passwords.every(value => passwordValidationError(value) === null));
  assert.ok(passwordValidationError('short'));
  assert.ok(passwordValidationError(' '.repeat(12)));
  assert.ok(passwordValidationError('я'.repeat(37)));
  assert.ok(passwordValidationError('a'.repeat(65)));
});

test('credential endpoints accept JSON from same origin and reject cross-site forms', () => {
  const req = (headers: Record<string, string>) => new Request('https://portal.example/api/admin/employees/2/password', { method: 'POST', headers });
  assert.equal(passwordRequestAllowed(req({ 'content-type': 'application/json', origin: 'https://portal.example', 'sec-fetch-site': 'same-origin' })), true);
  assert.equal(passwordRequestAllowed(req({ 'content-type': 'application/json', origin: 'https://other.example' })), false);
  assert.equal(passwordRequestAllowed(req({ 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })), false);
  assert.equal(passwordRequestAllowed(req({ 'content-type': 'application/x-www-form-urlencoded' })), false);
});

test('copied credentials contain only the heading, link, login and password', () => {
  const message = employeeAccessMessage('https://portal.example', { login: 'demo.employee', password: 'DEMO-ONLY-NOT-A-SECRET' });
  assert.ok(message.includes('https://portal.example/login'));
  assert.ok(message.includes('Логин: demo.employee'));
  assert.ok(message.includes('Пароль: DEMO-ONLY-NOT-A-SECRET'));
  assert.equal(message, 'Вход в портал MOBO\nhttps://portal.example/login\n\nЛогин: demo.employee\nПароль: DEMO-ONLY-NOT-A-SECRET');
  assert.doesNotMatch(message, /24|временн|задайте|смените|первом входе|сброса|Откройте/i);
});


test('employees get exactly ten lowercase letters/digits, no ambiguous characters or separators', () => {
  const passwords = Array.from({ length: 1000 }, () => generateEmployeePassword('EMPLOYEE'));
  assert.equal(new Set(passwords).size, 1000);
  assert.ok(passwords.every(value => /^[abcdefghjkmnpqrstuvwxyz2-9]{10}$/.test(value)));
  assert.ok(passwords.every(value => /[a-z]/.test(value) && /[2-9]/.test(value)));
  assert.ok(passwords.every(value => passwordValidationError(value, 'EMPLOYEE') === null));
  assert.ok(passwordValidationError('abc234567', 'EMPLOYEE'));
  assert.ok(passwordValidationError('abc2345678', 'ADMIN'));
  assert.equal(generateEmployeePassword('FUTURE_ROLE').length, 19);
});
