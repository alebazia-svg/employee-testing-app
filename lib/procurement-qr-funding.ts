/** Funding is a transfer to the accountable cashbox, NEVER supplier payment. */
export type QrFunding = {state:'confirmed'|'none'|'unavailable';checkedAt:string;lastConfirmed?:boolean;documentRef?:string;documentNumber?:string;date?:string;amount?:number;match?:'code'|'supplier'};
export type QrFundingPlan = {id:string;planCode:string;supplierPartner:string;supplierCounterparty:string;plannedAmount:number;paymentMethod:string;status:string;createdAt:string;hasPendingRevision?:boolean};
type Row = Record<string, any>;
const obj=(v:unknown):Row=>v&&typeof v==='object'&&!Array.isArray(v)?v as Row:{};
const key=(v:unknown)=>String(v||'').normalize('NFKC').toLocaleLowerCase('ru-RU').replaceAll('ё','е').replace(/[^\p{L}\p{N}]/gu,'');
const minor=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0&&Number.isSafeInteger(Math.round(v*100))&&Math.abs(v*100-Math.round(v*100))<0.00001?Math.round(v*100):null;
export function qrMovementTime(value:unknown) {
 const s=String(value||'');const m=/^(\d{2})\.(\d{2})\.(\d{4})(?:[ T](\d{2}):(\d{2}):(\d{2}))?$/.exec(s);
 return Date.parse(m?`${m[3]}-${m[2]}-${m[1]}T${m[4]||'00'}:${m[5]||'00'}:${m[6]||'00'}+03:00`:/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(s)?s+'+03:00':s);
}
/** Full cash statement for one organization; reciprocal document/account links,
 * equal posted movements, exact supplier token or code, and one-to-one ownership.
 * No fuzzy names, balance inference, nearest-date guesses or amount-only matches.
 */
export function matchQrFunding(plans:QrFundingPlan[],raw:unknown,targetRef:string,from:string,to:string,checkedAt:string) {
 const p=obj(raw);const result=new Map<string,QrFunding>();
 const unavailable=()=>new Map(plans.map(plan=>[plan.id,{state:'unavailable',checkedAt} as QrFunding]));
 if(p.ok!==true||p.endpoint!=='money-statement'||p.money_type!=='cash'||p.date_from!==from||p.date_to!==to||p.complete!==true||p.truncated!==false||!Array.isArray(p.movements)||!targetRef)return unavailable();
 for(const plan of plans)result.set(plan.id,{state:Date.parse(plan.createdAt)<Date.parse(from+'T00:00:00+03:00')?'unavailable':'none',checkedAt});
 const rows=p.movements.map(obj);const proposals:{id:string;funding:QrFunding}[]=[];
 for(const incoming of rows.filter((r:Row)=>r.account_ref===targetRef&&minor(r.incoming)!==null)) {
  const amount=minor(incoming.incoming);const sourceRef=obj(incoming.transfer_account).ref;
  const outgoingRef=obj(incoming.linked_document).ref;const incomingRef=obj(incoming.document).ref;
  if(!sourceRef||sourceRef===targetRef||!outgoingRef||!incomingRef||incoming.flow_class!=='internal_transfer'||incoming.metadata_available!==true||Number(incoming.outgoing)!==0||incoming.currency_group!=='cash')continue;
  const paired=rows.filter((r:Row)=>obj(r.document).ref===outgoingRef);
  if(paired.length!==1||rows.filter((r:Row)=>obj(r.document).ref===incomingRef).length!==1)continue;
  const out=paired[0];
  // 1C receipt links its expense, but the expense need not link back. If a
  // reverse link exists, it must agree; both cashbox directions are mandatory.
  if(out.account_ref!==sourceRef||obj(out.transfer_account).ref!==targetRef||(obj(out.linked_document).ref&&obj(out.linked_document).ref!==incomingRef)||out.flow_class!=='internal_transfer'||out.metadata_available!==true||out.currency_group!=='cash'||minor(out.outgoing)!==amount||Number(out.incoming)!==0)continue;
  const at=qrMovementTime(out.period),received=qrMovementTime(incoming.period);
  if(!Number.isFinite(at)||!Number.isFinite(received)||at>Date.parse(checkedAt)||received>Date.parse(checkedAt)||at>Date.parse(to+'T23:59:59+03:00')||at<Date.parse(from+'T00:00:00+03:00')||Math.abs(received-at)>86400000)continue;
  const comment=String(out.comment||'').trim();
  if(!/^qr(?:\s*[-–]?\s*код)?(?:\s|[,;:])/i.test(comment))continue;
  const codes=[...comment.matchAll(/\bPAY-\d{8}-\d{6}\b/gi)].map(m=>m[0].toUpperCase());
  const supplier=key(comment.replace(/^qr(?:\s*[-–]?\s*код)?/i,''));
  // Include cancelled/finished/other methods in competition: an old transfer
  // must never migrate to a newer request after the original one closes.
  const candidates=plans.filter(plan=>codes.length?codes.length===1&&plan.planCode.toUpperCase()===codes[0]:[key(plan.supplierPartner),key(plan.supplierCounterparty)].filter(Boolean).includes(supplier)&&minor(plan.plannedAmount)===amount&&Date.parse(plan.createdAt)<=at);
  if(candidates.length!==1)continue;
  const plan=candidates[0];
  if(plan.paymentMethod!=='ACCOUNTABLE_QR'||plan.status!=='APPROVED'||plan.hasPendingRevision||minor(plan.plannedAmount)!==amount||!Number.isFinite(Date.parse(plan.createdAt))||Date.parse(plan.createdAt)>at)continue;
  proposals.push({id:plan.id,funding:{state:'confirmed',checkedAt,documentRef:outgoingRef,documentNumber:String(obj(out.document).number||''),date:String(out.period),amount:amount!/100,match:codes.length?'code':'supplier'}});
 }
 for(const proposal of proposals)if(proposals.filter(p=>p.id===proposal.id).length===1&&proposals.filter(p=>p.funding.documentRef===proposal.funding.documentRef).length===1)result.set(proposal.id,proposal.funding);
 return result;
}
