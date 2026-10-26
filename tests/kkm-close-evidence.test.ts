import assert from 'node:assert/strict';
import test from 'node:test';
import { hasConfirmedKkmCloseEvidence as confirmed } from '../lib/kkm-close-confirmation';
const identity={taskId:508,userId:4,date:'2026-10-26'};
const issue={...identity,originDate:identity.date,ruleKey:'kkm_shift_not_closed',status:'resolved',sourceData:{status:'confirmed'}};
test('Zukhra: resolved OFD evidence overrides the earlier failed task snapshot without rewriting it',()=>{
 const original={personalCash:{cashBalance:11450},kkmCloseCheck:{status:'ofd_missing'},photos:{zReport:{storagePath:'retained'}}};
 const before=structuredClone(original);
 assert.equal(confirmed(original,[issue],identity),true);
 assert.deepEqual(original,before);
});
test('another task, employee or date cannot confirm this closure',()=>{
 for(const change of [{taskId:509},{userId:3},{originDate:'2026-10-25'},{ruleKey:'other'},{status:'open'},{sourceData:{status:'unavailable'}},{sourceData:{status:'one_c_open'}}])assert.equal(confirmed({},[{...issue,...change}],identity),false);
});
test('a photo or manually resolved issue is not an OFD confirmation',()=>{
 assert.equal(confirmed({kkmCloseConfirmation:{method:'photo'}},[{...issue,sourceData:null}],identity),false);
 assert.equal(confirmed({kkmCloseCheck:{status:'confirmed'}},[],identity),true);
 assert.equal(confirmed(null,[],identity),false);
});
