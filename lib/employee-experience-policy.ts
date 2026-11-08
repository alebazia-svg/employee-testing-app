/** Explicit application events; never input values, arbitrary text or OS pixels. */
export const guideStages = {
 automatic_shown:'Справка автоматически появилась на экране', manual_shown:'Открыл справку через «?»',
 close_button:'Закрыл справку крестиком', close_outside:'Закрыл справку нажатием вне окна',
 close_swipe:'Закрыл справку свайпом', close_escape:'Закрыл справку командой возврата / Escape',
 page_left:'Страница со справкой закрылась или начала переход', interrupted:'Окно справки исчезло при смене экрана приложения',hidden:'Приложение со справкой ушло в фон', returned:'Вернулся к открытой справке',
 replaced:'Справка закрылась после обновления её состояния',
 acknowledge_clicked:'Нажал «Понятно»', acknowledge_failed:'Не удалось сохранить нажатие «Понятно»',
 schedule_clicked:'Из справки перешёл к заполнению графика',
} as const;
export const pushSetupStages = {
 shown:'Предложение включить уведомления появилось на экране', enable_clicked:'Нажал кнопку подключения уведомлений',
 permission_granted:'Браузер сообщил: уведомления разрешены', permission_denied:'Браузер сообщил: уведомления запрещены',
 permission_default:'Разрешение на уведомления не получено', connected:'Приложение получило подтверждение подключения',
 failed:'Подключение уведомлений не завершилось', settings_open:'Открыл инструкцию по включению уведомлений',
 settings_close:'Закрыл инструкцию по включению уведомлений',
} as const;
export const experienceReasons = {
 denied:'На устройстве действует запрет уведомлений. Кто и когда его установил, не определено.',
 default:'Браузер не выдал разрешение. Это не доказывает нажатие «Отказать».',
 offline:'Приложение сообщило об отсутствии сети.', unsupported:'В этом режиме уведомления недоступны.',
 request:'Не удалось завершить подключение; точная причина не установлена.',
 configuration:'Не удалось получить настройки подключения от портала.',
 subscription:'Не удалось создать подписку в браузере.', save:'Не удалось сохранить подключение в портале.',
} as const;
export const workflowActions={
 close_request:'Запрос завершения дня',encashment_request:'Запрос по инкассации',app:'Приложение',workday:'Рабочий экран',qr:'Сканирование QR-кода',shift_change:'Изменение смены',old_day_close:'Завершение предыдущего дня',deviation:'Сообщение об изменении рабочего дня',
 cash_form:'Форма кассовой операции',cash_photo:'Фото кассовой операции',task_form:'Форма проверки кассы',task_save:'Сохранение проверки кассы',task_photo:'Фото по заданию',
 handover_form:'Форма сдачи смены',handover_photo:'Фото сдачи смены',schedule_editor:'Выбор дня в графике',schedule_bulk:'Заполнение графика',vacation_editor:'Редактирование отпуска',
 notification_list:'Список уведомлений',learning:'Обучение',procurement_payment:'Платёж в закупках',procurement_receipt:'Чек по оплате',procurement_delivery:'Доставка',salary_review:'Уточнение рабочего дня',
} as const;
export const workflowStages={collection_gap:'Часть событий приложения не удалось доставить; история может быть неполной',download_requested:'Нажал скачать документ; завершение скачивания не подтверждено',copy_succeeded:'Реквизиты скопированы',completed_view:'Открыл сохранённый результат',cancel_requested:'Нажал отмену запроса',reset_by_app:'Приложение сбросило незавершённую форму',auto_finish:'Приложение начало завершение аттестации по таймеру',submit_clicked:'Нажал сохранение / отправку',background:'Приложение ушло в фон',returned:'Вернулся в приложение',history_open:'Открыл историю уведомлений',new_open:'Открыл новые уведомления',next_question:'Перешёл к другому вопросу',finish_requested:'Нажал завершение аттестации',request_failed:'Запрос не завершился успешно',opened:'Окно открыто',closed:'Окно закрыто',submitted:'Запрос отправлен',response_received:'Приложение получило ответ',validation:'На экране показана подсказка: проверьте заполнение',photo_selected:'Выбрал фото',photo_cancelled:'Выбор фото отменён',error_shown:'На экране показана ошибка',cancelled:'Отменил действие',confirmed_choice:'Подтвердил выбор',retry:'Повторил попытку'} as const;
export const workflowOperations={
 workday_qr:'Подтверждение QR-кода',workday_shift:'Изменение смены',workday_deviation:'Причина изменения рабочего дня',workday_close_request:'Разрешение завершить день',workday_encashment_request:'Исключение по инкассации',
 learning_start:'Начало аттестации',learning_progress:'Сохранение прогресса',learning_finish:'Завершение аттестации',learning_load:'Загрузка аттестации',
 payment_create:'Новая заявка на оплату',payment_edit:'Изменение заявки',payment_schedule:'Изменение даты оплаты',payment_load:'Загрузка оплат',
 document_copy:'Копирование реквизитов',receipt_upload:'Загрузка документа',document_change:'Изменение документа',requisites_save:'Сохранение реквизитов',qr_request:'Запрос чека',receipt_load:'Загрузка документов',
 delivery_request:'Запрос пополнения',delivery_load:'Обновление подотчёта',salary_send:'Отправка запроса дней',salary_cancel:'Отмена запроса дней',salary_load:'Загрузка запросов дней',
} as const;
export const workflowFailures={clipboard:'Браузеру не удалось скопировать реквизиты. Можно выделить и скопировать текст вручную.',rate:'Курс валюты пока недоступен.',source:'Данные для проверки получены не полностью.',balance:'Остаток средств не подтверждён или недостаточен для выбранного действия.',duplicate:'Такая незавершённая заявка уже существует.',already_completed:'Аттестация уже завершена; новая попытка не создана.',interrupted:'Запрос прерван; причина прерывания не установлена.',timeout:'Истекло время ожидания ответа; сохранение проверяется отдельно.',network:'Не удалось получить ответ по сети.',validation:'Портал не принял запрос: нужны уточнения или доступные данные.',conflict:'Данные изменились или действие уже выполнено. Нужна сверка актуального состояния.',access:'Для запроса недостаточно доступа или нужен повторный вход.',missing:'Запись или раздел не найдены.',unavailable:'Сервис не смог выполнить запрос.',request:'Запрос завершился ошибкой; точная причина не установлена.',response:'Ответ приложения не удалось прочитать.'} as const;
export type WorkflowMetadata={ref?:string;operation?:keyof typeof workflowOperations;failure?:keyof typeof workflowFailures;attemptId?:string};
export function workflowOperationMatches(action:string,operation:string){if(action==='qr')return operation==='workday_qr';if(action==='shift_change')return operation==='workday_shift';if(action==='deviation')return operation==='workday_deviation';if(action==='close_request')return operation==='workday_close_request';if(action==='encashment_request')return operation==='workday_encashment_request';return action==='learning'?operation.startsWith('learning_'):action==='salary_review'?operation.startsWith('salary_'):action==='procurement_payment'?operation.startsWith('payment_'):action==='procurement_receipt'?['receipt_','document_','requisites_','qr_'].some(p=>operation.startsWith(p)):action==='procurement_delivery'?operation.startsWith('delivery_'):false;}
export function workflowResourceKey(action:string,ref:string){return action==='qr'?`qr:${ref}`:action==='shift_change'?`shift-change:${ref}`:action==='deviation'?`deviation:${ref}`:['close_request','encashment_request'].includes(action)?`close-request:${ref}`:action==='learning'?`learning:${ref}`:action==='salary_review'?`day-review:${ref}`:action==='procurement_payment'||action==='procurement_receipt'?`payment:${ref}`:action==='procurement_delivery'?`delivery:${ref}`:null;}
export type ExperienceContext = {target:'workflow';action:keyof typeof workflowActions;stage:keyof typeof workflowStages;attemptId:string;taskId?:number;period?:string;ref?:string;operation?:keyof typeof workflowOperations;failure?:keyof typeof workflowFailures} | {target:'guide';stage:keyof typeof guideStages;attemptId:string} |
 {target:'push_setup';stage:keyof typeof pushSetupStages;attemptId:string;reason?:keyof typeof experienceReasons};
export function readExperience(value:unknown):ExperienceContext|null {
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const p=value as Record<string,unknown>;
 if(Object.keys(p).some(k=>!['target','stage','attemptId','reason','action','taskId','period','ref','operation','failure'].includes(k))||typeof p.attemptId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(p.attemptId)||typeof p.stage!=='string')return null;
 if(p.period!==undefined){
  if(p.target!=='workflow'||typeof p.period!=='string')return null;
  const month=['schedule_bulk','salary_review'].includes(String(p.action))&&/^20\d{2}-(0[1-9]|1[0-2])$/.test(p.period);
  if(!month&&(!/^20\d{2}-\d{2}-\d{2}$/.test(p.period)||!Number.isFinite(Date.parse(p.period))||new Date(p.period).toISOString().slice(0,10)!==p.period))return null;
 }
 if(p.ref!==undefined&&(p.target!=='workflow'||!['cash_form','cash_photo','learning','salary_review','procurement_payment','procurement_receipt','procurement_delivery','qr','shift_change','deviation','close_request','encashment_request'].includes(String(p.action))||typeof p.ref!=='string'||! /^[a-zA-Z0-9_-]{1,80}$/.test(p.ref)||(['learning','shift_change'].includes(String(p.action))&&!/^[1-9]\d{0,8}$/.test(p.ref))||(['cash_form','cash_photo'].includes(String(p.action))&&p.ref.length<8)))return null;
 if(p.operation!==undefined&&(p.target!=='workflow'||typeof p.operation!=='string'||!Object.hasOwn(workflowOperations,p.operation)||!workflowOperationMatches(String(p.action),p.operation)))return null;
 if(p.failure!==undefined&&(p.target!=='workflow'||typeof p.failure!=='string'||!Object.hasOwn(workflowFailures,p.failure)||!['request_failed','error_shown','validation'].includes(p.stage)))return null;
 if(p.target==='workflow')return typeof p.action==='string'&&Object.hasOwn(workflowActions,p.action)&&Object.hasOwn(workflowStages,p.stage)&&p.reason===undefined&&(p.taskId===undefined||Number.isSafeInteger(p.taskId)&&Number(p.taskId)>0)?p as ExperienceContext:null;
 if(p.action!==undefined||p.taskId!==undefined)return null;
 if(p.target==='guide')return Object.hasOwn(guideStages,p.stage)&&p.reason===undefined?p as ExperienceContext:null;
 if(p.target!=='push_setup'||!Object.hasOwn(pushSetupStages,p.stage))return null;
 if(p.reason!==undefined&&(typeof p.reason!=='string'||!Object.hasOwn(experienceReasons,p.reason)))return null;
 return p as ExperienceContext;
}
