import {requireAdminApi} from '@/lib/admin-api-auth';
import {editApprovedPlan} from '@/lib/procurement-approved-edit-server';
export async function PATCH(req:Request,props:{params:Promise<{id:string}>}) {
  const access=await requireAdminApi();if(!access.ok)return access.response;
  try{return Response.json(await editApprovedPlan((await props.params).id,access.user.id,await req.json().catch(()=>null)));}
  catch(error){return Response.json({error:error instanceof Error&&/^[А-ЯЁ]/.test(error.message)?error.message:'Не удалось сохранить изменения. Повторите позже.'},{status:409});}
}

import { prisma } from '@/lib/prisma';
import { fetchRequestOrderCatalogue } from '@/lib/procurement-request-catalogue';
import { ordersForManager } from '@/lib/procurement-payment-source';
import { ordersForRequest } from '@/lib/procurement-order-selection';
import { fetchSupplierSettlements, summarizeSupplierSettlements } from '@/lib/procurement-supplier-settlements';
import { buyerOrderPurpose, supplierPosition } from '@/lib/procurement-supplier-position';
export async function GET(_req:Request,props:{params:Promise<{id:string}>}) {
  const access=await requireAdminApi();if(!access.ok)return access.response;
  const plan=await prisma.supplierPaymentPlan.findUnique({where:{id:(await props.params).id},include:{manager:true}});
  if(!plan)return Response.json({error:'Заявка не найдена.'},{status:404});
  try {
    const [catalog,settlements]=await Promise.all([fetchRequestOrderCatalogue(),fetchSupplierSettlements()]);
    const balances=summarizeSupplierSettlements(settlements.rows,[plan.supplierPartner]);
    if(!catalog.complete||!settlements.complete||balances.unsupportedCurrencyRows)throw Error();
    const balance=balances.bySupplier[plan.supplierPartner];
    const orders=ordersForRequest(ordersForManager(catalog.rows,plan.manager.oneCManagerName?.trim()||plan.manager.name))
      .filter(o=>o.supplierPartner===plan.supplierPartner && ['order','prepayment'].includes(buyerOrderPurpose(o,balance)))
      .map(({ref,number})=>({ref,number}));
    return Response.json({orders,debt:supplierPosition(balance)==='debt'},{headers:{'Cache-Control':'private, no-store'}});
  }catch{return Response.json({error:'Не удалось проверить заказы и долг в 1С.'},{status:503});}
}
