const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup({preview=null,visible=true,inViewport=true,covered=false}={}) {
  let effect, observer, cleanup;
  const calls=[],listeners=new Map();
  const element={getBoundingClientRect:()=>({width:200,height:40,top:inViewport?20:1000,bottom:inViewport?60:1040})};
  const context={exports:{},document:{visibilityState:visible?'visible':'hidden',querySelectorAll:()=>covered?[{contains:()=>false}]:[],addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)},innerHeight:800,window:{innerHeight:800},crypto:{randomUUID:()=> 'test-attempt-123'},
    IntersectionObserver: class {constructor(fn){observer=fn;} observe(){} disconnect(){observer=null;}},
    require:name=>name==='react'?{useEffect:fn=>{effect=fn;},useRef:()=>({current:{parentElement:element}})}:name==='react/jsx-runtime'?{jsx:()=>null}:name.includes('PreviewProvider')?{useEmployeePreview:()=>preview}:{sendEmployeeActivity:value=>calls.push(value)}};
  const source=fs.readFileSync('components/EmployeeInteractionAudit.tsx','utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
  context.exports.InteractionShown({context:{target:'notification',ref:'12',stage:'shown'}});cleanup=effect();
  return {calls,intersect:()=>observer?.([{isIntersecting:true}]),show:()=>{context.document.visibilityState='visible';listeners.get('visibilitychange')?.();},cleanup:()=>cleanup?.()};
}
test('a visible handover message is reported once; repeating checks do not repeat the row',()=>{const p=setup();p.intersect();p.intersect();p.show();assert.equal(p.calls.length,1);assert.equal(p.calls[0].context.stage,'shown');p.cleanup();p.intersect();assert.equal(p.calls.length,1);});
test('background, off-screen and administrator inspection never pretend a warning was shown',()=>{for(const config of [{preview:{}},{inViewport:false},{covered:true}]){const p=setup(config);p.intersect();p.show();assert.equal(p.calls.length,0);}const p=setup({visible:false});p.intersect();assert.equal(p.calls.length,0);p.show();assert.equal(p.calls.length,1);});
