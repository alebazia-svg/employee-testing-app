/** Device observations, never proof of OS banner visibility or reading. */
export const employeePushReceiptStages = {
 received: 'Устройство сообщило о получении push',
 display_requested: 'Браузер принял запрос показа push',
 display_failed: 'Браузер не смог выполнить показ push',
 clicked: 'Нажал push-уведомление',
 closed: 'Браузер сообщил о закрытии push',
} as const;
export type EmployeePushReceiptStage = keyof typeof employeePushReceiptStages;
export const isEmployeePushReceiptStage = (value:unknown):value is EmployeePushReceiptStage => typeof value==='string'&&Object.hasOwn(employeePushReceiptStages,value);
