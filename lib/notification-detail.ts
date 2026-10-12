import type {ExpenseListItem} from './expense-request-list-view';
import type {PaymentRevision} from './procurement-plan-revision';
export type NotificationPlan={id:string;planCode:string;supplierPartner:string;plannedDate:string;updatedAt:string;plannedAmount:string;foreignAmount:string|null;exchangeRate:string|null;paymentMethod:string;condition:string;orderNumbers:string[];status:string;paymentPurpose:string;revision:PaymentRevision|null};
export type NotificationDetail={kind:'payment'|'receipts';admin:boolean;plan:NotificationPlan}|{kind:'expense';item:ExpenseListItem};
