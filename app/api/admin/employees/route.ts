import { prisma } from '@/lib/prisma'; import bcrypt from 'bcryptjs'; import { Role } from '@prisma/client';
export async function POST(req:Request){const {login,password}=await req.json(); const u=await prisma.user.create({data:{login,passwordHash:await bcrypt.hash(password,10),role:Role.EMPLOYEE}}); return Response.json(u);}
