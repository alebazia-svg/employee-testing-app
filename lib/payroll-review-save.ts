import type { PayrollSalesClassificationRule } from './payroll-sales-classification';

export type PayrollReviewDecision = {
  item: string; category: string; department: 'retail' | 'wholesale';
  saleContext: 'regular' | 'credit';
  target: PayrollSalesClassificationRule['targetCalculationType'];
};

/** Existing single-rule API; partial saves are explicit and retry-safe. */
export async function savePayrollReviewDecisions(
  decisions: PayrollReviewDecision[],
  request: typeof fetch = fetch,
) {
  if (!decisions.length) throw new Error('Не выбраны товары.');
  const loaded = await request('/api/admin/payroll/classification-rules', { cache: 'no-store' });
  if (!loaded.ok) throw new Error('Не удалось проверить действующие правила. Ничего не сохранено.');
  const rules = await loaded.json() as PayrollSalesClassificationRule[];
  const normalize = (s: string | null) => (s ?? '').trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ');
  for (const d of decisions) {
    if (rules.some(r => r.isActive && r.matchType === 'EXACT_ITEM' &&
      normalize(r.itemText) === normalize(d.item) &&
      (!r.categoryText || normalize(r.categoryText) === normalize(d.category)) &&
      (!r.department || r.department === 'all' || r.department === d.department) &&
      (!r.saleContext || r.saleContext === 'all' || r.saleContext === d.saleContext) &&
      r.targetCalculationType !== d.target)) {
      throw new Error('У товара «'+d.item+'» уже есть другое точечное правило. Сначала проверьте его в настройках. Ничего не сохранено.');
    }
  }
  let saved = 0;
  for (const d of decisions) {
    try {
      const response = await request('/api/admin/payroll/classification-rules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: d.item, matchType: 'EXACT_ITEM', itemText: d.item,
          categoryText: d.category, article: null,
          department: d.department, saleContext: d.saleContext,
          targetCalculationType: d.target, priority: 100,
          reason: 'Подтверждено администратором при проверке товаров зарплаты.',
        }),
      });
      if (!response.ok) throw new Error('Не удалось сохранить правило.');
      saved++;
    } catch {
      throw new Error('Подтверждено сохранение '+saved+' из '+decisions.length+'. Последний запрос мог завершиться на сервере. Обновите проверку перед повтором; повторное одинаковое правило не добавляется.');
    }
  }
  return saved;
}
