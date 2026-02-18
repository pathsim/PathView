const m="0.26.2",_=`https://cdn.jsdelivr.net/pyodide/v${m}/full/pyodide.mjs`,I=["numpy","scipy","micropip"],f=[{pip:"pathsim==0.17.0",required:!0,pre:!0,import:"pathsim"},{pip:"pathsim-chem==0.2rc3",required:!1,pre:!0,import:"pathsim_chem"}],y={LOADING_PYODIDE:"Loading Pyodide...",INSTALLING_DEPS:"Installing NumPy and SciPy...",INSTALLING_PATHSIM:"Installing PathSim...",INSTALLING_PATHSIM_CHEM:"Installing PathSim-Chem...",STARTING_WORKER:"Starting worker...",STARTING_SIMULATION:"Starting simulation..."},l={WORKER_NOT_INITIALIZED:"Worker not initialized",FAILED_TO_LOAD_PYODIDE:"Failed to load Pyodide"};let a=null,d=!1,c=!1;const p=[];function s(e){postMessage(e)}async function g(){if(d){s({type:"ready"});return}s({type:"progress",value:y.LOADING_PYODIDE});const{loadPyodide:e}=await import(_);if(a=await e(),!a)throw new Error(l.FAILED_TO_LOAD_PYODIDE);a.setStdout({batched:t=>s({type:"stdout",value:t})}),a.setStderr({batched:t=>s({type:"stderr",value:t})}),s({type:"progress",value:y.INSTALLING_DEPS}),await a.loadPackage([...I]);for(const t of f){const r=`INSTALLING_${t.import.toUpperCase()}`;s({type:"progress",value:y[r]??`Installing ${t.import}...`});try{const o=t.pre?", pre=True":"";await a.runPythonAsync(`
import micropip
await micropip.install('${t.pip}'${o})
			`),await a.runPythonAsync(`
import ${t.import}
print(f"${t.import} {${t.import}.__version__} loaded successfully")
			`)}catch(o){if(t.required)throw new Error(`Failed to install required package ${t.pip}: ${o}`);console.warn(`Optional package ${t.pip} failed to install:`,o)}}await a.runPythonAsync("import numpy as np"),await a.runPythonAsync("import gc"),await a.runPythonAsync("_clean_globals = set(globals().keys())"),d=!0,s({type:"ready"})}async function h(e,t){if(!a)throw new Error(l.WORKER_NOT_INITIALIZED);try{await a.runPythonAsync(t),s({type:"ok",id:e})}catch(r){const o=r instanceof Error?r.message:String(r);let n;try{n=await a.runPythonAsync(`
import traceback
traceback.format_exc()
			`)}catch{}s({type:"error",id:e,error:o,traceback:n})}}async function E(e,t){if(!a)throw new Error(l.WORKER_NOT_INITIALIZED);try{const r=await a.runPythonAsync(`
_eval_result = ${t}
json.dumps(_eval_result, default=_to_json if '_to_json' in dir() else str)
		`);s({type:"value",id:e,value:r})}catch(r){const o=r instanceof Error?r.message:String(r);let n;try{n=await a.runPythonAsync(`
import traceback
traceback.format_exc()
			`)}catch{}s({type:"error",id:e,error:o,traceback:n})}}async function w(e,t){if(!a)throw new Error(l.WORKER_NOT_INITIALIZED);c=!0,p.length=0;try{for(;c;){for(;p.length>0;){const n=p.shift();try{await a.runPythonAsync(n)}catch(i){const u=i instanceof Error?i.message:String(i);s({type:"stderr",value:`Stream exec error: ${u}`})}}const r=await a.runPythonAsync(`
_eval_result = ${t}
json.dumps(_eval_result, default=_to_json if '_to_json' in dir() else str)
			`),o=JSON.parse(r);if(!c){!o.done&&o.result&&s({type:"stream-data",id:e,value:r});break}if(o.done)break;s({type:"stream-data",id:e,value:r})}}catch(r){const o=r instanceof Error?r.message:String(r);let n;try{n=await a.runPythonAsync(`
import traceback
traceback.format_exc()
			`)}catch{}s({type:"error",id:e,error:o,traceback:n})}finally{c=!1,s({type:"stream-done",id:e})}}function A(){c=!1}self.onmessage=async e=>{const{type:t}=e.data,r="id"in e.data?e.data.id:void 0,o="code"in e.data?e.data.code:void 0,n="expr"in e.data?e.data.expr:void 0;try{switch(t){case"init":await g();break;case"exec":if(!r||typeof o!="string")throw new Error("Invalid exec request: missing id or code");await h(r,o);break;case"eval":if(!r||typeof n!="string")throw new Error("Invalid eval request: missing id or expr");await E(r,n);break;case"stream-start":if(!r||typeof n!="string")throw new Error("Invalid stream-start request: missing id or expr");w(r,n);break;case"stream-stop":A();break;case"stream-exec":typeof o=="string"&&c&&p.push(o);break;default:throw new Error(`Unknown message type: ${t}`)}}catch(i){s({type:"error",id:r,error:i instanceof Error?i.message:String(i)})}};
