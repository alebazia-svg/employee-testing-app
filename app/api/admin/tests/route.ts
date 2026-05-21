import { prisma } from '@/lib/prisma';
export async function POST(req:Request){const body=await req.json(); const t=await prisma.test.create({data:{title:body.title,passingScore:Number(body.passingScore),showCorrectAnswers:!!body.showCorrectAnswers,questions:{create:body.questions.map((q:any)=>({text:q.text,options:q.options,correctIndex:Number(q.correctIndex)}))}}}); return Response.json(t);}
