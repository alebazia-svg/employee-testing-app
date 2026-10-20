export function employeeAccessMessage(origin: string, access: { login: string; password: string }) {
  return `Вход в портал MOBO\n${new URL('/login', origin).href}\n\nЛогин: ${access.login}\nПароль: ${access.password}`;
}
