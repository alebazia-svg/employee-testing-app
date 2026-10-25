const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
function setup(fail=false) {
  const jobs=[],writes=[];
  const modules={
    'next/server':{after:fn=>{if(fail)throw Error('No after context');jobs.push(fn);}},
    './portal-access-journal':{accessSessionIdentity:(token,user)=>token==='signed-test'&&user===5?{sessionHash:'safe-hash'}:null},
    './session':{sessionCookieName:'offonika_session'},
    './employee-activity':{writeEmployeeActivity:async(...args)=>{writes.push(args);return true;}},
    './employee-handover-audit-policy':{readHandoverContext:c=> c.stage&&c.attemptId==='attempt-test'?c:null},
  };
  const ctx={exports:{},require:n=>modules[n]||{},Date};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/employee-handover-audit-server.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,ctx);
  const call=(cookie='offonika_session=signed-test')=>ctx.exports.scheduleHandoverCheckAudit(new Request('http://localhost/test',{headers:{cookie}}),5,3,'attempt-test','confirmed');
  return {jobs,writes,call};
}
test('server proof is deferred until after response and uses signed session identity',async()=>{const p=setup();p.call();assert.equal(p.writes.length,0);assert.equal(p.jobs.length,1);await p.jobs[0]();assert.equal(p.writes[0][0],5);assert.equal(p.writes[0][2].kind,'handover_check');assert.equal(p.writes[0][2].context.stage,'check_confirmed');const q=setup();q.call('offonika_session=invalid');assert.equal(q.jobs.length,0);});
test('unavailable audit scheduling never throws into shift completion',()=>{const p=setup(true);assert.doesNotThrow(()=>p.call());assert.equal(p.writes.length,0);});
