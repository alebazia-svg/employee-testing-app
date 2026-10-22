import type {ExpenseListItem} from './expense-request-list-view';
import type {PaymentRevision} from './procurement-plan-revision';
import type {ReceiptPaymentPlan} from './procurement-receipt-policy';
export type NotificationPlan=ReceiptPaymentPlan & {id:string;planCode:string;supplierPartner:string;plannedDate:string;updatedAt:string;plannedAmount:string;foreignAmount:string|null;exchangeRate:string|null;paymentMethod:string;condition:string;orderNumbers:string[];status:string;paymentPurpose:string;revision:PaymentRevision|null};
export type NotificationDecision={label:string;name:string;at:string};
export type NotificationDetail=({kind:'payment'|'receipts';admin:boolean;plan:NotificationPlan}|{kind:'expense';item:ExpenseListItem}|{kind:'notice';body:string}) & {decision?:NotificationDecision};
