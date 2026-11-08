import { requireAdminApi } from '@/lib/admin-api-auth';
import { isHomeSection } from '@/lib/admin-home';
import { loadHomeSection } from '@/lib/admin-home-data';
import { getMoscowDateKey } from '@/lib/workday';
export const dynamic='force-dynamic';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie'};
export async function GET(request:Request){
 const access=await requireAdminApi();
 if(!access.ok)return new Response(access.response.body,{status:access.response.status,headers});
 const section=new URL(request.url).searchParams.get('section');
 if(!isHomeSection(section))return Response.json({error:'Неизвестный источник Главной.'},{status:400,headers});
 try{const data=await loadHomeSection(section,access.user.id);return Response.json({section,checkedAt:new Date().toISOString(),day:getMoscowDateKey(),data},{headers});}
 catch{return Response.json({section,error:'Не удалось обновить источник. Последние данные не заменены нулями.'},{status:503,headers});}
}
