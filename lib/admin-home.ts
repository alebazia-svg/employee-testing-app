export type HomeAction = { id: string; title: string; detail: string; href: string; tone?: 'attention' | 'normal'; who?: string };
export type HomeWorkday = { date: string; working: number; off: number; completed: number; notStarted: number; actions: HomeAction[]; timing: HomeAction[]; departments: {name:string;count:number}[]; missingPlans: HomeAction[]; devices: HomeAction[]; paymentCheck?:HomeAction };
export type HomePayments = { plans: {id:string;supplier:string;date:string;amount:number;foreign:number|null;currency:string;status:string;statusLabel:string;href:string}[]; receipts: HomeAction[]; expenseCount:number; expenseCheckedAt:string|null; expenseActions:HomeAction[] };
export type HomeTaxes = { cutoff:string|null; reviewedAt:string|null; confirmedOn?:string|null; confirmationSource?:string|null; income:number|null; threshold:number|null; excess:number|null; crossedOn:string|null; ausnEndedOn:string|null; usnConfirmed:false|null; findings:HomeAction[]; assessment:number|null; assessmentPeriod:string|null };
export type HomePayroll = {period:string;amount:number|null;through:string|null;sourceAt:string|null;provisional:boolean;label:string;reviews:HomeAction[];missing:HomeAction[];names:string[]};
export type HomeSettlement = {period:string;paid:number|null;remaining:number|null;checkedAt:string;unassigned:number;unresolved?:string[]};
export type HomeFinance = {cash:number|null;checkedAt:string|null;sourceComplete:boolean;detail:string};
export type HomeAnalytics = {period:string|null;revenue:number|null;profit:number|null;margin:number|null;sourceAt:string|null;source:string;priceReviewCount:number|null};
export type HomeService = {items:HomeAction[]};
export type HomeData = {workday:HomeWorkday;payments:HomePayments;taxes:HomeTaxes;payroll:HomePayroll;settlement:HomeSettlement;finance:HomeFinance;analytics:HomeAnalytics;service:HomeService};
export const homeSections = ['workday','payments','taxes','payroll','settlement','finance','analytics','service'] as const;
export type HomeSection = typeof homeSections[number];
export type HomeRead<K extends HomeSection=HomeSection> = {section:K;checkedAt:string;day:string;data:HomeData[K]};
export function isHomeSection(value:unknown):value is HomeSection {return typeof value==='string'&&homeSections.some(key=>key===value);}
export function homeRefreshInterval(section:HomeSection) {return section==='settlement'?300_000:section==='finance'?120_000:60_000;}
/** On a new Moscow day an old operational snapshot must not masquerade as today. */
export function retainHomeRead<K extends HomeSection>(previous:HomeRead<K>|undefined, day:string) {return previous?.day===day?previous:undefined;}

/** Reserve the first screen for an operational exception and administrator decisions;
 * every other active item remains in the counted full list. */
export function homePriorityActions(work:HomeAction[],payroll:HomeAction[],tax:HomeAction[]):HomeAction[]{
 const all=[work[0],payroll[0],tax[0],...work,...payroll,...tax].filter((row):row is HomeAction=>Boolean(row));
 return [...new Map(all.map(row=>[row.id,row])).values()];
}
