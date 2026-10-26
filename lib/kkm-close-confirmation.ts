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
