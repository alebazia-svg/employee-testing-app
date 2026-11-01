import type {PrismaClient,Prisma} from '@prisma/client';
export async function extraReceiptTransaction<T>(db:PrismaClient,run:(tx:Prisma.TransactionClient)=>Promise<T>):Promise<T>{
 for(let attempt=0;attempt<3;attempt++){
  try{return await db.$transaction(run,{isolationLevel:'Serializable'});}
  catch(e){const code=e&&typeof e==='object'&&'code' in e?e.code:null;if(attempt===2||!['P2034','P2002'].includes(String(code)))throw e;}
 }
 throw Error('EXTRA_RECEIPT_TRANSACTION_RETRY_EXHAUSTED');
}
