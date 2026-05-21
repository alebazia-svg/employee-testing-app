import { prisma } from '@/lib/prisma';
export async function GET(_:Request,{params}:{params:{id:string}}){const test=await prisma.test.findUnique({where:{id:Number(params.id)},include:{questions:true}}); if(!test) return Response.json({error:'not found'},{status:404}); return Response.json({...test,questions:test.questions.map(q=>({...q,correctIndex:undefined}))});}
