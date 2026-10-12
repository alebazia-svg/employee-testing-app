import type {Prisma} from '@prisma/client';
import {expenseListStage,expenseName,expenseRecord,expenseText,type ExpenseListItem} from './expense-request-list-view';
export function expenseListItem(item:Prisma.ExpenseRequestAdminCaseGetPayload<{include:{evaluations:true}}>):ExpenseListItem {
  const evaluation=item.evaluations[0],source=expenseRecord(evaluation?.normalizedSource);
  const statusKey=item.currentStatusKey||(item.isNotApproved?'not_approved':'unknown');
  const amount=item.amount===null?null:Number(item.amount);
  return {id:item.id,nativeRef:item.oneCRequestRef,number:item.oneCNumber||'',person:item.requestedByName||'',amount,
    date:item.oneCDate?.toISOString()||null,since:item.enteredNotApprovedAt?.toISOString()||null,checkedAt:item.lastSeenAt.toISOString(),
    operation:item.businessOperationName||'',purpose:expenseText(source.paymentPurpose),comment:expenseText(source.comment),
    cashbox:expenseName(source.cashbox),department:expenseName(source.department),article:expenseName(source.cashFlowItem),
    recipient:item.counterpartyName||expenseName(source.partner),basis:expenseName(source.sourceDocument),
    stage:expenseListStage(statusKey,amount,source,evaluation?.sourceComplete===true,item.deletionMark===true),
    status:item.deletionMark?'Удалена в 1С':item.currentStatusName||statusKey,statusKey,
    missing:[!expenseName(source.cashFlowItem)&&'Статья ДДС',expenseRecord(source.paymentForm).cash===true&&!expenseName(source.cashbox)&&'Касса'].filter(Boolean) as string[],
    archived:item.currentCycleOrigin!=='live',sourceComplete:evaluation?.sourceComplete===true,nativeEnabled:process.env.EXPENSE_REQUEST_NATIVE_ADMIN==='1'};
}
