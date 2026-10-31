import { DayReviewError } from './payroll-day-review-store';
export const dayReviewHeaders={'Cache-Control':'private, no-store',Vary:'Cookie'};
export function dayReviewFailure(error:unknown) {
 if(error instanceof DayReviewError)return Response.json({error:error.message},{status:error.status,headers:dayReviewHeaders});
 if(error instanceof Error&&error.message.startsWith('Выберите прошедшие'))return Response.json({error:error.message},{status:400,headers:dayReviewHeaders});
 // Concurrent changes must be re-read, never replayed as an unverified approval.
 if(error&&typeof error==='object'&&'code'in error&&['P2034','P2002'].includes(String(error.code)))return Response.json({error:'Данные изменились. Обновите запрос.'},{status:409,headers:dayReviewHeaders});
 console.error('PAYROLL_DAY_REVIEW_FAILED');return Response.json({error:'Не удалось обработать запрос. Повторите попытку.'},{status:503,headers:dayReviewHeaders});
}
