/** Presentation only. Never clears a source issue or permits payroll approval. */
export function payrollReviewPresentation(message: string) {
  if (/не сопоставлен/i.test(message)) return {
    title: 'Кому выдан аванс', reason: message.replace(/не сопоставлен\.?/i, 'не найден в расчёте.'),
    action: 'Перепроверить авансы', target: 'advances' as const,
    hint: 'Уточните получателя этого расходника в 1С. Затем перепроверьте авансы здесь.',
  };
  if (/Finbox/i.test(message)) return {
    title: 'Агентские Дианы', reason: 'Агентские за этот месяц не получены.',
    action: 'Открыть агентские', target: 'finbox' as const,
    hint: 'Проверьте сумму Finbox в карточке Дианы.',
  };
  if (/дни и опоздания/i.test(message)) return {
    title: 'Рабочие дни', reason: 'Не удалось обновить дни и опоздания.',
    action: 'Обновить рабочие дни', target: 'attendance' as const,
    hint: 'Повторите обновление. Если данные не появятся, проверьте табель.',
  };
  if (/классифи/i.test(message)) return {
    title: 'Начисления за товары', reason: (/: 1 строк/.test(message) ? 'Нужно выбрать правило для одного товара.' : message.replace('Не классифицировано однозначно:', 'Нужно выбрать правила начисления:')),
    action: 'Проверить товары', target: 'products' as const,
    hint: 'Выберите категорию товара — она определяет бонус сотрудника.',
  };
  if (/поставщик/i.test(message)) return {
    title: 'Закупки Астемира', reason: message,
    action: 'Проверить поставщиков', target: 'suppliers' as const,
    hint: 'Укажите, какие поставщики входят в расчёт закупок.',
  };
  if (/себестоим/i.test(message)) return {
    title: 'Себестоимость', reason: message,
    action: 'Проверить данные 1С', target: 'source' as const,
    hint: 'Завершите расчёт себестоимости в 1С, затем обновите данные. Бонус от прибыли может измениться.',
  };
  if (/менеджер/i.test(message)) return {
    title: 'Продавец в документе', reason: message,
    action: 'Проверить данные 1С', target: 'source' as const,
    hint: 'Укажите продавца в документе 1С, затем обновите данные.',
  };
  if (/аванс|выплат/i.test(message)) return {
    title: 'Авансы', reason: 'Авансы не проверены — сумма к выплате пока неизвестна.',
    action: 'Перепроверить авансы', target: 'advances' as const,
    hint: 'Повторите проверку авансов из 1С.',
  };
  if (/не обновлен|не обновлён|недоступ|сохранённый расчёт/i.test(message)) return {
    title: 'Обновление расчёта', reason: 'Показан последний сохранённый расчёт.',
    action: 'Проверить данные 1С', target: 'source' as const,
    hint: 'Повторите обновление данных 1С.',
  };
  return {
    title: 'Данные для расчёта', reason: message,
    action: 'Проверить данные 1С', target: 'source' as const,
    hint: 'Проверьте указанные данные перед утверждением ведомости.',
  };
}
export type PayrollReviewTarget = ReturnType<typeof payrollReviewPresentation>['target'];

export function payrollEmployeeReviewPresentation(reason: string) {
  if (/опоздан/i.test(reason)) return { reason, hint: 'Укажите число опозданий. От него зависит премия за дисциплину.' };
  if (/дн|дни/i.test(reason)) return { reason, hint: 'Сверьте отработанные дни с табелем и укажите их в карточке.' };
  if (/Finbox|агентск/i.test(reason)) return { reason, hint: 'Внесите агентские Finbox за этот месяц.' };
  return { reason, hint: 'Проверьте эту сумму или значение в карточке сотрудника.' };
}
