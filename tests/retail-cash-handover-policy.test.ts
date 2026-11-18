import test from 'node:test';import assert from 'node:assert/strict';
import {selectCashHandoverRecipient,handoverMoney,type HandoverCandidate} from '../lib/retail-cash-handover-policy';
const now=new Date('2026-11-18T14:00:00Z');const scope={senderId:1,sourceRef:'sender',date:'2026-11-18',minutes:1020,now};
const candidate=(id:number,end:number):HandoverCandidate=>({id,userId:id,startedAt:new Date('2026-11-18T06:00:00Z'),shiftEndMinutes:end,endedAt:null,status:'active',date:scope.date,user:{id,name:`Manager ${id}`,isActive:true,role:'EMPLOYEE',department:'retail',workdayControlMode:'STANDARD',oneCCashboxMapping:{isActive:true,oneCCashboxRef:`cash-${id}`}},shiftControlRun:null});
test('later end wins, stable tie ordering is independent of query order',()=>{const a=candidate(3,1080),b=candidate(4,1200),c=candidate(5,1200);assert.equal(selectCashHandoverRecipient([a,c,b],scope)?.userId,4);assert.equal(selectCashHandoverRecipient([b,a,c],scope)?.userId,4);});
test('started WorkDay, open shift, distinct active personal retail mapping required',()=>{const cases=[{...candidate(3,1200),endedAt:now},{...candidate(3,1200),date:'2026-11-17'},{...candidate(3,1200),status:'missing_checkout'},{...candidate(3,1200),startedAt:new Date(+now+1000)},candidate(1,1200)];for(const c of cases)assert.equal(selectCashHandoverRecipient([c],scope),null);const c=candidate(3,1200);c.user.oneCCashboxMapping!.oneCCashboxRef='sender';assert.equal(selectCashHandoverRecipient([c],scope),null);});
test('manager who has begun handover is not a recipient',()=>{const c=candidate(3,1200);c.shiftControlRun={status:'active',tasks:[{category:'handover',status:'pending',handoverData:{draft:true}}]};assert.equal(selectCashHandoverRecipient([c],scope),null);});
test('money is the actual amount, with zero allowed and invalid precision rejected',()=>{assert.equal(handoverMoney(0),0);assert.equal(handoverMoney(500.25),500.25);for(const v of [-1,NaN,Infinity,1.001,'500',null])assert.throws(()=>handoverMoney(v));});

test('after planned end an open manager remains eligible; later end still wins', () => {
 const early = candidate(3, 960), later = candidate(4, 1020);
 assert.equal(selectCashHandoverRecipient([early, later], scope)?.id, later.id);
 later.endedAt = now;
 assert.equal(selectCashHandoverRecipient([early, later], scope)?.id, early.id);
});
