/** Public display identity only; never infer a job title or change a payroll key. */
export type PortalPerson = { name: string; payrollName?: string | null; role?: string };
export function portalPersonName(person: PortalPerson) {
  const name = person.name.trim();
  const generic = !name || /^(?:admin|администратор(?: портала)?)$/iu.test(name);
  return generic && person.payrollName?.trim() ? person.payrollName.trim() : name || 'Администратор портала';
}
export function portalPersonInitials(name: string) {
  return name.trim().split(/\s+/u).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toLocaleUpperCase('ru-RU');
}
export function portalMessageAuthor(message: { author: PortalPerson; createdAt: Date | string }) {
  return { name: portalPersonName(message.author), at: new Date(message.createdAt).toISOString() };
}
