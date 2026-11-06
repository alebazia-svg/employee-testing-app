import { cookies } from 'next/headers';
import { requireAdminApi } from '@/lib/admin-api-auth';
import { passwordRequestAllowed } from '@/lib/password-access';
import { parseAdminVisit } from '@/lib/admin-page-policy';
import { readAdminJournal, writeAdminVisit } from '@/lib/admin-page-journal';
import { accessBrowserCookie, validAccessBrowserId } from '@/lib/portal-access-identity';
import { accessSessionIdentity } from '@/lib/portal-access-journal';
import { sessionCookieName } from '@/lib/session';
const headers = {'Cache-Control':'private, no-store'};
export async function POST(req: Request) {
  if (!passwordRequestAllowed(req)) return new Response(null,{status:403,headers});
  if (Number(req.headers.get('content-length')||0)>512) return new Response(null,{status:413,headers});
  const auth=await requireAdminApi(); if (!auth.ok) return auth.response;
  const text=await req.text(); if (text.length>512) return new Response(null,{status:413,headers});
  let value: unknown; try {value=JSON.parse(text);} catch {return new Response(null,{status:400,headers});}
  const input=parseAdminVisit(value); if (!input) return new Response(null,{status:400,headers});
  const jar=await cookies(), browser=jar.get(accessBrowserCookie)?.value;
  const identity=accessSessionIdentity(jar.get(sessionCookieName)?.value,auth.user.id);
  if (!identity || !validAccessBrowserId(browser)) return Response.json({recorded:false},{status:409,headers});
  try { const recorded=await writeAdminVisit(auth.user.id,identity.sessionHash,browser!,input); return Response.json({recorded},{status:recorded?200:409,headers}); }
  catch {return Response.json({recorded:false},{status:503,headers});}
}
export async function GET(req: Request) {
  const auth=await requireAdminApi(); if (!auth.ok) return auth.response;
  try {return Response.json(await readAdminJournal(new URL(req.url).searchParams),{headers});}
  catch(e) {return Response.json({error:e instanceof RangeError?e.message:'Не удалось загрузить журнал. Повторите попытку.'},{status:e instanceof RangeError?400:503,headers});}
}
