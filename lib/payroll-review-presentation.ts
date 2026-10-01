/** Presentation only. Never clears a source issue or permits payroll approval. */
export function payrollReviewPresentation(message: string) {
  if (/классифи/i.test(message)) return { title: 'Категории товаров', action: 'Выбрать категории', target: 'products' as const, hint: 'Отметьте товары и проверьте правило начисления. Можно выбрать несколько сразу.' };
  if (/поставщик/i.test(message)) return { title: 'Поставщики закупок', action: 'Проверить поставщиков', target: 'suppliers' as const, hint: 'Подтвердите, какие поставщики относятся к закупкам Астемира.' };
  if (/себестоим/i.test(message)) return { title: 'Себестоимость', action: 'Открыть источник', target: 'source' as const, hint: 'Проверьте себестоимость затронутых документов в 1С, затем обновите данные. Пока она не завершена, процент от прибыли может измениться.' };
  if (/менеджер/i.test(message)) return { title: 'Продавец в документе', action: 'Открыть источник', target: 'source' as const, hint: 'Уточните продавца в исходном документе 1С. Автор документа сам по себе не определяет получателя зарплаты.' };
  if (/аванс|выплат/i.test(message)) return { title: 'Авансы', action: 'Открыть источник', target: 'source' as const, hint: 'До сверки выплат остаток не подтверждён. Не считайте отсутствие данных нулевым авансом.' };
  if (/не обновлен|не обновлён|недоступ|сохранённый расчёт/i.test(message)) return { title: 'Обновление данных', action: 'Проверить источник', target: 'source' as const, hint: 'Сохранённые суммы доступны, но перед утверждением нужно получить актуальные данные. Это не доказательство ошибки начисления.' };
  return { title: 'Проверка исходных данных', action: 'Открыть источник', target: 'source' as const, hint: 'Уточните причину перед утверждением. Этот вопрос не снимается автоматически.' };
}
