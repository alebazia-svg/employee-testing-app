import { adminPaymentComment } from "@/lib/procurement-admin-comment";
export function ProcurementAdminComment({ value, historical = false }: { value: string; historical?: boolean }) {
 const { warning, comment } = adminPaymentComment(value, historical);
 return <>{warning ? <div className={`mt-3 rounded-lg border-l-2 p-3 text-xs leading-relaxed ${historical ? "border-slate-300 bg-slate-50 text-slate-600" : "border-amber-400 bg-amber-50 text-amber-950"}`}>{warning}</div> : null}{comment ? <div className="mt-3 text-sm"><p className="mb-1 text-xs font-bold text-slate-500">Комментарий закупщика</p><p className="whitespace-pre-wrap break-words text-slate-700">{comment}</p></div> : null}</>;
}
import React from "react";
