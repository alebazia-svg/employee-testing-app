import type { WorkflowMetadata,workflowActions } from './employee-experience-policy';
export type WorkflowFact={id:string;key:string;caseKey?:string;title:string;section:'learning'|'procurement'|'payroll'|'day'|'schedule';at:string;label:string;status:'result'|'question'|'observed'|'unknown';action?:keyof typeof workflowActions;ref?:string;operation?:WorkflowMetadata['operation']};
export const paymentEventLabels:Record<string,{label:string;operation?:WorkflowMetadata['operation'];status:WorkflowFact['status']}>= {
 COMPLETED_WITHOUT_TOPUP:{label:'Заявка завершена администратором без доплаты; это не новая оплата',status:'result'},REOPENED:{label:'Заявка возвращена в работу',status:'question'},
 SUBMITTED:{label:'Заявка сохранена и передана на согласование',operation:'payment_create',status:'question'},
 UPDATED:{label:'Изменения заявки сохранены',operation:'payment_edit',status:'result'},COMMENT_UPDATED:{label:'Комментарий к заявке сохранён',operation:'payment_edit',status:'result'},
 REVISION_REQUESTED:{label:'Изменения отправлены на согласование; прежние условия действуют до решения',operation:'payment_edit',status:'question'},
 APPROVED:{label:'Заявка согласована; это не подтверждение оплаты',status:'question'},REJECTED:{label:'Заявка отклонена; требуется уточнение',status:'question'},NEEDS_CHANGES:{label:'Заявка возвращена на уточнение',status:'question'},
 REVISION_APPROVED:{label:'Изменения согласованы',status:'result'},REVISION_REJECTED:{label:'Изменения отклонены; прежние условия сохранены',status:'question'},
 RECEIPT_ADDED:{label:'Документ оплаты сохранён; исполнение оплаты проверяется отдельно',operation:'receipt_upload',status:'result'},PAYMENT_REQUISITES_ADDED:{label:'Реквизиты для оплаты сохранены',operation:'requisites_save',status:'result'},
 PAYMENT_QR_CONFIRMED:{label:'Актуальность QR подтверждена',operation:'document_change',status:'result'},RECEIPT_PAYMENT_LINKED:{label:'Документ связан с оплатой',operation:'document_change',status:'result'},PAYMENT_DOCUMENT_CLASSIFIED:{label:'Назначение документа сохранено',operation:'document_change',status:'result'},
};

export type WorkflowContext={key:string;title:string;pending?:string;priorResult?:string;priorResultAt?:string};
