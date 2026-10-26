import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createRequire} from 'node:module';

const at=new Date();
const review=()=>({id:'review',matchingHash:'hash',status:'admin_review',reasonCode:'ONE_C_CANDIDATE_NOT_FOUND',bankOperationAt:at,lastCheckedAt:new Date(+at+25*60000),amountKopecks:680000,mappingId:'mapping',mapping:{label:'Касса Миланы',terminalKey:'bank-terminal',oneCCashRegisterRef:'m',workstation:{label:'Розница · место 2'}},employee:{name:'ADMIN'},participants:[],messages:[],assignmentScope:'admin_gate'});
let current:any=review(),match:any=null,cashier:any=null,googleFails=false;
const users=[{id:1,name:'Зухра',oneCCashboxMapping:{isActive:true,oneCCashRegisterRef:'z'}},{id:2,name:'Милана',oneCCashboxMapping:{isActive:true,oneCCashRegisterRef:'m'}},{id:3,name:'Магомед',oneCCashboxMapping:null}];
const db={terminalFiscalEmployeeReview:{findUnique:async()=>current},terminalFiscalMatch:{findUnique:async()=>match},userOneCCashboxMapping:{findUnique:async()=>cashier},user:{findMany:async()=>users},workDayEntry:{findMany:async()=>[2,3].map(userId=>({userId,status:'active',startedAt:new Date(+at),endedAt:null}))},workScheduleEntry:{findMany:async()=>[]}};
const proposed={users:[{id:2,name:'Милана'},{id:3,name:'Магомед'}],primary:{id:2,name:'Милана'},confidence:'high'};
const mocks:Record<string,any>={'server-only':{},'./prisma':{prisma:db},'./google-sheets':{getAttendanceRows:async()=>{if(googleFails)throw Error('offline');return {mode:'google-sheets',rows:[]};},getScheduleRows:async()=>({mode:'google-sheets',rows:[]})},'./team-control':{googleDay:()=>({plan:null,arrival:null,departure:null,shift:'',lateMinutes:0,note:'',ambiguous:false})},'./terminal-fiscal-runner':{runTerminalFiscalHistoricalDryRun:async()=>({acquired:false})},'./terminal-fiscal-admin-gate':{TERMINAL_FISCAL_ADMIN_FIRST:true,fiscalProposedRecipients:async()=>proposed},'./terminal-fiscal-sources':{aqsiTerminalIdForPortalKey:()=>10693079,technicalHash:()=>''}};
test('review facts, cashier proof, mixed-source fallback and closed lifecycle',async t=>{
const out=await build({entryPoints:['lib/fiscal-review-data.ts'],bundle:true,write:false,platform:'node',format:'cjs',packages:'external',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/.*/},a=>a.path in mocks?{path:a.path,external:true}:undefined);}}]});
const mod={exports:{} as any},require=createRequire(import.meta.url);
new Function('require','module','exports',out.outputFiles[0].text)((n:string)=>mocks[n]??require(n),mod,mod.exports);
const load=()=>mod.exports.loadFiscalReviewData('review',1);
const fullMatch=(reasonCode='ONE_C_CANDIDATE_NOT_FOUND')=>({status:'needs_review',reasonCode,oneCSourceRef:null,oneCCashierRef:null,timeDifferenceSeconds:null,tbankComplete:true,oneCComplete:true,ofdComplete:true});
 await t.test('actual app marks survive Google failure; equipment is separate from cashier proof',async()=>{current=review();match=fullMatch();googleFails=true;cashier=null;const d=await load();assert.equal(d.workstation,'Розница · место 2 (Милана)');assert.equal(d.responsible,'Милана');assert.equal(d.terminal,'aQsi · 10693079');assert.equal(d.manager,null);assert.equal(d.googleHint,null);assert.equal(d.simpleCheck,true);});
 await t.test('known 1C cashier wins seating inference even on another home computer',async()=>{match={...fullMatch('MATCH_CONFIRMED_LATE'),status:'confirmed',oneCSourceRef:'receipt-ref',oneCCashierRef:'magomed-ref',timeDifferenceSeconds:1752};cashier={isActive:true,user:{name:'Магомед'}};const d=await load();assert.equal(d.manager,'Магомед');assert.equal(d.googleHint,null);assert.equal(d.resolved,true);assert.equal(d.canApprove,false);assert.equal(d.canTest,false);assert.doesNotMatch(d.message,/receipt-ref/);assert.doesNotMatch(d.message,/пробит через|29 мин 12 сек/);});
 await t.test('incomplete source is not proof of missing receipt',async()=>{cashier=null;match={...fullMatch('SOURCE_ONE_C_INCOMPLETE'),oneCComplete:false};const d=await load();assert.equal(d.simpleCheck,false);assert.equal(d.sources.oneC,false);});
 await t.test('missing stored match is unknown rather than a failed data read',async()=>{match=null;const d=await load();assert.deepEqual(d.sources,{bank:null,oneC:null,ofd:null});});
 await t.test('a found 1C document suppresses duplicate receipt request',async()=>{match={...fullMatch('OFD_RECEIPT_NOT_FOUND'),oneCSourceRef:'existing-check'};const d=await load();assert.equal(d.hasOneCCheck,true);assert.equal(d.canApprove,false);assert.equal(d.canTest,false);});
 await t.test('split sale cannot be forwarded as a missing receipt',async()=>{match=fullMatch('ONE_C_POSSIBLE_SPLIT_SALE');const d=await load();assert.equal(d.canApprove,false);});
 await t.test('OFD candidate prevents forwarding even when stored review still says missing',async()=>{current=review();match=fullMatch('OFD_CANDIDATE_REQUIRES_LINK');const d=await load();assert.equal(d.canApprove,false);assert.equal(d.resolved,false);assert.match(d.message,/Повторно пробивать чек пока не требуется/);});
 await t.test('missing review returns null',async()=>{current=null;assert.equal(await load(),null);});
});
