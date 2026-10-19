import 'server-only';
import { randomInt } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const employeeAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';

export function generateEmployeePassword(role: string) {
  if (role === 'EMPLOYEE') {
    // Rejection sampling keeps the distribution uniform while requiring both letters and digits.
    let password: string;
    do {
      password = Array.from({ length: 10 }, () => employeeAlphabet[randomInt(employeeAlphabet.length)]).join('');
    } while (!/[a-z]/.test(password) || !/[2-9]/.test(password));
    return password;
  }
  // ADMIN and any future/unknown role retain the stronger format.
  return Array.from({ length: 4 }, () => Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join('')).join('-');
}

export function passwordValidationError(password: unknown, role = 'ADMIN') {
  const minimum = role === 'EMPLOYEE' ? 10 : 16;
  if (typeof password !== 'string' || password.length < minimum) return `Используйте не меньше ${minimum} символов.`;
  if (password.length > 64 || Buffer.byteLength(password, 'utf8') > 72) return 'Пароль слишком длинный: до 64 символов и 72 байт.';
  if (!password.trim()) return 'Пароль не может состоять только из пробелов.';
  return null;
}

export function passwordRequestAllowed(request: Request) {
  // Browser POSTs must be JSON and same-origin; never accept cross-site forms.
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return false;
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return false;
  const origin = request.headers.get('origin');
  if (!origin) return true; // Non-browser clients still require the signed ADMIN session.
  try { return new URL(origin).host === (request.headers.get('x-forwarded-host') || request.headers.get('host') || new URL(request.url).host); }
  catch { return false; }
}

export class PasswordAccessError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function resetEmployeePassword(db: PrismaClient, employeeId: number, adminId: number, expectedVersion: number, now = new Date()) {
  if (employeeId === adminId) throw new PasswordAccessError('Для сброса своего пароля обратитесь к другому администратору.');
  const user = await db.user.findUnique({ where: { id: employeeId } });
  if (!user) throw new PasswordAccessError('Сотрудник не найден.', 404);
  if (!user.isActive) throw new PasswordAccessError('Сначала включите доступ сотруднику.');
  const password = generateEmployeePassword(user.role);
  const passwordHash = await bcrypt.hash(password, 12);
  const changed = await db.user.updateMany({
    where: { id: employeeId, sessionVersion: expectedVersion, isActive: true, login: user.login, role: user.role },
    data: { passwordHash,
      sessionVersion: { increment: 1 }, passwordResetAt: now, passwordResetById: adminId },
  });
  if (changed.count !== 1) throw new PasswordAccessError('Доступ уже изменился. Обновите список сотрудников перед повторным сбросом.', 409);
  return { userId: user.id, name: user.name, login: user.login, password, sessionVersion: expectedVersion + 1 };
}
