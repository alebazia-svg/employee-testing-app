export const interactionStages = {
 shown: 'Сообщение появилось в видимой области приложения', open: 'Открыл карточку', close: 'Закрыл карточку',
 retry: 'Нажал «Повторить / обновить»', submit: 'Отправил ответ', accepted: 'Приложение получило подтверждение сохранения ответа',
 error: 'На экране показана ошибка', warning: 'На экране показано предупреждение', help: 'Нажал «Нужна помощь»',
 not_found: 'Нажал ответ о ненайденном документе', not_mine: 'Нажал «Операция не моя»', undo_not_mine: 'Нажал отмену ответа «Не моя операция»',
 banner_hidden: 'Скрыл всплывающее уведомление',
} as const;
export const interactionMessages = {
 send_failed: 'Не удалось отправить. Попробуйте ещё раз.',
 data_unavailable: 'Данные не обновились. Проверьте заявки в 1С.',
 cash_unavailable: 'Не удалось проверить данные. Перед выдачей обновите статус или проверьте заявку в 1С.',
 load_failed: 'Не удалось загрузить данные карточки.',
 close_blocked: 'Закрытие смены заблокировано',
} as const;
export type InteractionContext = { target: 'notification'|'issue'|'review'|'cash'; ref: string; stage: keyof typeof interactionStages; message?: keyof typeof interactionMessages };
export function readInteraction(value: unknown): InteractionContext | null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const p=value as Record<string,unknown>;
 if(!Object.keys(p).every(k=>['target','ref','stage','message'].includes(k)))return null;
 if(!['notification','issue','review','cash'].includes(String(p.target))||typeof p.ref!=='string'||!p.ref||p.ref.length>80||!/^[-a-zA-Z0-9_]+$/.test(p.ref))return null;
 if(['notification','issue'].includes(String(p.target))&&(!/^[1-9]\d*$/.test(p.ref)||!Number.isSafeInteger(Number(p.ref))))return null;
 if(typeof p.stage!=='string'||!Object.hasOwn(interactionStages,p.stage))return null;
 if(p.message!==undefined&&(typeof p.message!=='string'||!Object.hasOwn(interactionMessages,p.message)||!['error','warning'].includes(p.stage)))return null;
 return p as InteractionContext;
}
