import 'server-only';
import {prisma} from './prisma';
import {savedPaymentEvidence} from './procurement-evidence-continuity';
import {documentPaymentRefs, type DocumentPurpose} from './procurement-document-policy';
import {canCollectQrReceiptBeforePayment, hasConfirmedReceiptPayment} from './procurement-receipt-policy';
import {ReceiptError} from './procurement-receipts';

export function parseDocumentPaymentRefs(raw:unknown):string[] {
  let parsed:unknown;
  try{parsed=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw new ReceiptError('Выберите оплату для чека.',400);}
  if(!Array.isArray(parsed)||!parsed.length||parsed.length>100||parsed.some(ref=>typeof ref!=='string'||ref.length>150)||new Set(parsed).size!==parsed.length)throw new ReceiptError('Выберите оплату для чека.',400);
  return parsed;
}
/** Association only; never changes the reconciled payments or plan completion. */
export async function verifyDocumentPaymentRefs(id:string,purpose:DocumentPurpose,raw:unknown) {
  if(purpose!=='RECEIPT')throw new ReceiptError('Реквизиты не подтверждают выполненную оплату.',400);
  const refs=parseDocumentPaymentRefs(raw);
  const plan=await prisma.supplierPaymentPlan.findUnique({where:{id}});
  if(!plan)throw new ReceiptError('Заявка не найдена.',404);
  // QR proof is explicitly allowed before 1C records the expense. It must not
  // silently cover an arbitrary later expense: association is a separate step.
  if(refs.length===1&&refs[0]==='pending-qr'){
    if(!canCollectQrReceiptBeforePayment({...plan,plannedDate:plan.plannedDate.toISOString(),createdAt:plan.createdAt.toISOString()}))throw new ReceiptError('Для этой заявки выберите проведённую оплату.',409);
    return {paymentRefs:refs,planVersion:plan.updatedAt.toISOString()};
  }
  // Attaching a file is NOT a financial action. Use exact references from the
  // server's identity-validated complete observation, not another remote scan.
  // A later cancellation removes that reference from the current receipt queue;
  // this association can neither match an expense nor close a payment plan.
  const paid=savedPaymentEvidence(plan)?.evidence;
  const view={paymentMethod:plan.paymentMethod,status:plan.status,evidence:paid};
  const allowed=new Set(documentPaymentRefs(view));
  if(!hasConfirmedReceiptPayment(view)||refs.some(ref=>!allowed.has(ref)))throw new ReceiptError('Не удалось подтвердить выбранный расходник. Обновите данные заявки и повторите.',409);
  return {paymentRefs:refs,planVersion:plan.updatedAt.toISOString()};
}
