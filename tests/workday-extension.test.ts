import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveExtensionProposal, type ExtensionDay} from '../lib/workday-extension';
const now=new Date('2026-11-01T10:00:00Z');
const days:ExtensionDay[]=[{id:1,userId:4,date:'2026-11-01',department:'retail',status:'active',startedAt:new Date('2026-11-01T05:57Z'),endedAt:null,shiftCode:'09_18',shiftEndMinutes:1080},
{id:2,userId:3,date:'2026-11-01',department:'retail',status:'completed',startedAt:new Date('2026-11-01T07:21Z'),endedAt:new Date('2026-11-01T08:00Z'),shiftCode:'11_20',shiftEndMinutes:1200}];
test('early departure produces a proposal, never modifies attendance',()=>{const original=structuredClone(days);assert.equal(deriveExtensionProposal(days,now)?.workDayId,1);assert.deepEqual(days,original);});
test('replacement removes proposal, including one who later leaves',()=>{const replacement={...days[0],id:3,userId:6,shiftCode:'11_20',shiftEndMinutes:1200};assert.equal(deriveExtensionProposal([...days,replacement],now),null);});
test('normal solo day and future departure do not extend',()=>{assert.equal(deriveExtensionProposal([days[0]],now),null);assert.equal(deriveExtensionProposal([days[0],{...days[1],endedAt:new Date('2026-11-01T14:00Z')}],now),null);});
test('past dates, closing time, completed or already extended day are excluded',()=>{assert.equal(deriveExtensionProposal(days,new Date('2026-11-02T10:00Z')),null);assert.equal(deriveExtensionProposal(days,new Date('2026-11-01T17:00Z')),null);assert.equal(deriveExtensionProposal([{...days[0],status:'completed'},days[1]],now),null);assert.equal(deriveExtensionProposal([{...days[0],shiftCode:'09_20',shiftEndMinutes:1200},days[1]],now),null);});
