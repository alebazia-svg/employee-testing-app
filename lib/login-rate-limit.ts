type AttemptState = {
  failures: number[];
};

const windowMs = 15 * 60 * 1000;
const maxFailuresPerLogin = 5;
const maxFailuresPerIp = 12;
const attempts = new Map<string, AttemptState>();

function normalizedIp(request: Request) {
  return (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim();
}

function normalizedLogin(login: unknown) {
  return typeof login === 'string' ? login.trim().toLocaleLowerCase('ru-RU') : '';
}

function activeFailures(key: string, now: number) {
  const state = attempts.get(key);
  if (!state) return [];
  const failures = state.failures.filter((value) => now - value < windowMs);
  if (failures.length) attempts.set(key, { failures });
  else attempts.delete(key);
  return failures;
}

function keys(request: Request, login: unknown) {
  const ip = normalizedIp(request);
  return [`ip:${ip}`, `login:${ip}:${normalizedLogin(login)}`];
}

export function loginAllowed(request: Request, login: unknown, now = Date.now()) {
  const [ipKey, loginKey] = keys(request, login);
  return activeFailures(ipKey, now).length < maxFailuresPerIp
    && activeFailures(loginKey, now).length < maxFailuresPerLogin;
}

export function recordLoginFailure(request: Request, login: unknown, now = Date.now()) {
  for (const key of keys(request, login)) {
    const failures = activeFailures(key, now);
    attempts.set(key, { failures: [...failures, now] });
  }
}

export function clearLoginFailures(request: Request, login: unknown) {
  for (const key of keys(request, login)) attempts.delete(key);
}
