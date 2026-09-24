/** Conservative duplicate-planning guard, not financial matching authority. */
export function mixedPaymentBasisSuppliers(rows: Array<{ supplierPartner: string; basis: 'ORDER' | 'DEBT' }>) {
  const suppliers = new Map<string, { name: string; bases: Set<string> }>();
  for (const row of rows) {
    const name = row.supplierPartner.trim();
    const key = name.toLocaleLowerCase('ru-RU').replaceAll('ё', 'е').replace(/\s+/g, ' ');
    if (!key) continue;
    const supplier = suppliers.get(key) ?? { name, bases: new Set<string>() };
    supplier.bases.add(row.basis);
    suppliers.set(key, supplier);
  }
  return [...suppliers.values()].filter(s => s.bases.size > 1).map(s => s.name);
}

export function mixedPaymentBasisMessage(suppliers: string[]) {
  return `${suppliers.join(', ')}: выберите оплату по заказам или в счёт общего долга. Вместе их отправить нельзя — суммы могут пересекаться.`;
}
