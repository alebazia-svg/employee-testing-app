import 'server-only';
import {extraReceiptTransaction} from './terminal-extra-receipt-transaction';
import type {PrismaClient} from '@prisma/client';
export const EXTRA_RECEIPT_RESPONSES=['duplicate','second_sale','help','second_cash','second_terminal','second_other'] as const;
export type ExtraReceiptResponse=typeof EXTRA_RECEIPT_RESPONSES[number];
export function validExtraReceiptResponse(x:unknown):x is ExtraReceiptResponse{return typeof x==='string'&&(EXTRA_RECEIPT_RESPONSES as readonly string[]).includes(x);}
export async function respondToExtraReceipt(db:PrismaClient,id:number,userId:number,action:ExtraReceiptResponse){
 return extraReceiptTransaction(db,async tx=>{
  const user=await tx.user.findFirst({where:{id:userId,role:'EMPLOYEE',isActive:true},select:{id:true}});if(!user)throw Error('FORBIDDEN');
  const issue=await tx.workdayControlIssue.findFirst({where:{id,userId,ruleKey:'terminal_extra_receipt',status:'open',employeeActionRequired:true}});
  if(!issue)throw Error('ISSUE_NOT_AVAILABLE');
  const source=issue.sourceData&&typeof issue.sourceData==='object'&&!Array.isArray(issue.sourceData)?issue.sourceData:{};
  if(source.response===action)return {alreadyAnswered:true};
  if(action.startsWith('second_')&&action!=='second_sale'&&source.response!=='second_sale')throw Error('RESPONSE_CHANGED');
  await tx.workdayControlIssue.update({where:{id},data:{sourceData:{...source,response:action,responseAt:new Date().toISOString()}}});
  const copy:Record<ExtraReceiptResponse,string>={duplicate:'Сотрудник подтвердил повторное пробитие. Исправление ещё не подтверждено.',second_sale:'Сотрудник сообщил о второй продаже. Способ оплаты уточняется.',help:'Сотрудник просит помочь с проверкой.',second_cash:'Вторая продажа оплачена наличными. Требуется проверить способ оплаты в кассовом чеке.',second_terminal:'Вторая продажа оплачена картой или СБП. Требуется найти подтверждение второй оплаты.',second_other:'Вторая продажа оплачена другим способом. Требуется уточнение.'};
  const event=await tx.adminInboxEvent.upsert({where:{eventKey:`extra-receipt:${id}:response:${userId}:${action}`},update:{},create:{eventKey:`extra-receipt:${id}:response:${userId}:${action}`,type:'workday_issue.employee_message',title:'Ответ по возможному лишнему чеку',body:copy[action],sourceType:'workday_control_issue',sourceId:String(id),href:`/admin/workday/issues/${id}`,occurredAt:new Date()}});
  const admins=await tx.user.findMany({where:{role:'ADMIN',isActive:true},select:{id:true}});
  await tx.adminInboxReceipt.createMany({data:admins.map(a=>({eventId:event.id,userId:a.id})),skipDuplicates:true});
  return {alreadyAnswered:false};
 });
}
