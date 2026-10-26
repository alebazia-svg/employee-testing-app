const record = (value:unknown):Record<string,unknown> => value && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : {};
export type KkmCloseConfirmationMethod = 'photo' | 'not_printed';
export function kkmCloseConfirmation(data:unknown) {
 const source=record(data), confirmation=record(source.kkmCloseConfirmation), photo=record(record(source.photos).zReport);
 if(typeof confirmation.confirmedAt!=='string' || !Number.isFinite(Date.parse(confirmation.confirmedAt)) || typeof confirmation.userId!=='number' || confirmation.userId<=0)return null;
 if(confirmation.method==='not_printed')return {userId:confirmation.userId,confirmedAt:confirmation.confirmedAt,method:'not_printed' as const};
 return confirmation.method==='photo' && typeof photo.storagePath==='string' && /^uploads\/shift-control\/\d+\/\d+\/z-report-[^/]+$/.test(photo.storagePath)
  && confirmation.storagePath===photo.storagePath && typeof photo.sizeBytes==='number' && photo.sizeBytes>0
  && typeof photo.mimeType==='string' && photo.mimeType.startsWith('image/') ? {userId:confirmation.userId,confirmedAt:confirmation.confirmedAt,storagePath:photo.storagePath,method:'photo' as const} : null;
}
export function createKkmCloseConfirmation(data:unknown,userId:number,runId:number,taskId:number,now=new Date(),method:KkmCloseConfirmationMethod='photo') {
 const photo=record(record(record(data).photos).zReport);
 const confirmation={userId,confirmedAt:now.toISOString(),method,...(method==='photo'?{storagePath:photo.storagePath}:{})};
 if(method==='photo' && (typeof photo.storagePath!=='string' || !photo.storagePath.startsWith(`uploads/shift-control/${runId}/${taskId}/z-report-`)))return null;
 return kkmCloseConfirmation({...record(data),kkmCloseConfirmation:confirmation});
}

/** Confirmation is not a recount. Reuse server facts, even from an old phone. */
export function preserveKkmCloseFacts(form:FormData,data:unknown,comment='') {
 const source=record(data),cash=record(source.personalCash),reserve=record(source.reserveCash),terminal=record(source.terminalCheck),closing=record(source.storeClosing);
 const value=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)||typeof v==='string'?String(v):'';
 const bool=(v:unknown)=>typeof v==='boolean'?String(v):'';
 const fields:Record<string,string>={personalCashBalance:value(cash.cashBalance),reserveCashBalance:value(reserve.cashBalance),discrepancyType:value(cash.discrepancyType),discrepancyAmount:value(cash.discrepancyAmount),encashmentAmount:value(cash.encashmentAmount),encashmentDirection:value(cash.encashmentDirection),terminalHadOperations:bool(terminal.hadOperations),terminalReconciliation:value(terminal.reconciliation),terminalComment:value(terminal.comment),hasTbankCredit:bool(closing.hasTbankCredit),tbankTerminalTotal:value(closing.tbankTerminalTotal),comment:typeof source.comment==='string'?source.comment:comment};
 for(const [key,v]of Object.entries(fields))form.set(key,v);
 for(const key of ['personalStatementPhoto','terminalReceiptsPhoto','tbankReceiptsPhoto','tbankTerminalReportPhoto','encashmentDocumentPhoto'])form.delete(key);
}
