// SPDX-License-Identifier: Apache-2.0
// Isolated Chromium profile and synthetic data only. Does not access Lace or submit transactions.
import { spawn } from "node:child_process";
import { mkdtemp,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
const base=process.env.SENYAP_PROBE_PRODUCTION === "1" ? "http://127.0.0.1:5176" : "http://127.0.0.1:5174";
const profile=await mkdtemp(join(tmpdir(),"senyap-workspace-browser-"));
const chrome=spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",["--headless","--disable-gpu","--disable-background-networking","--no-first-run","--no-default-browser-check","--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"],{stdio:["ignore","ignore","pipe"]});
let socket:WebSocket|undefined;
try {
  const ws=await new Promise<string>((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error("Browser did not start")),15000);
    chrome.once("error",()=>{clearTimeout(timeout);reject(Error("Browser startup failed"));});
    chrome.stderr.on("data",chunk=>{const found=String(chunk).match(/DevTools listening on (ws:\/\/[^\s]+)/);if(found){clearTimeout(timeout);resolve(found[1]);}});
  });
  socket=new WebSocket(ws);await new Promise<void>((resolve,reject)=>{socket!.addEventListener("open",()=>resolve(),{once:true});socket!.addEventListener("error",()=>reject(Error("Browser connection failed")),{once:true});});
  let next=0;const pending=new Map<number,{method:string;resolve:(value:any)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  socket.addEventListener("message",event=>{
    const data=JSON.parse(String(event.data)),entry=pending.get(data.id);if(!entry)return;
    pending.delete(data.id);clearTimeout(entry.timer);if(data.error)entry.reject(Error(`Browser command failed (${entry.method}): ${data.error.message}`));else entry.resolve(data.result);
  });
  const call=(method:string,params:Record<string,unknown>={},sessionId?:string):Promise<any>=>new Promise((resolve,reject)=>{
    const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error(`Browser command timed out (${method})`));},30000);
    pending.set(id,{method,resolve,reject,timer});socket!.send(JSON.stringify({id,method,params,sessionId}));
  });
  const {targetId}=await call("Target.createTarget",{url:base+"/app/workspace"});
  const {sessionId}=await call("Target.attachToTarget",{targetId,flatten:true});
  const evaluate=async(expression:string)=>{
    const result=await call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true},sessionId);
    if(result.exceptionDetails)throw Error(`Browser evaluation failed: ${result.exceptionDetails.exception?.description??result.exceptionDetails.text}`);
    return result.result.value;
  };
  for(let attempt=0;attempt<30;attempt++){
    try{if(await evaluate(`location.href===${JSON.stringify(base+"/app/workspace")}&&document.readyState==='complete'`))break;}catch{}
    if(attempt===29)throw Error("Local application did not load");await new Promise(resolve=>setTimeout(resolve,200));
  }

  const wait = async (expression:string) => { for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error("Workspace UI did not reach expected state"); };
  await wait("!!document.querySelector('#vault-password')");
  await call("Emulation.setDeviceMetricsOverride",{width:1440,height:1100,deviceScaleFactor:1,mobile:false},sessionId);
  const capture=async(name:string)=>{const shot=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:true},sessionId);await writeFile(`/private/tmp/senyap-workspace-${name}.png`,Buffer.from(shot.data,"base64"));};
  await capture("desktop");
  await call("Emulation.setDeviceMetricsOverride",{width:390,height:1000,deviceScaleFactor:1,mobile:true},sessionId);
  const noOverflow=await evaluate("document.documentElement.scrollWidth<=innerWidth"); await capture("mobile");
  const submit=async(password:string,confirmation?:string)=>evaluate(`(()=>{const p=document.querySelector('#vault-password');p.value=${JSON.stringify(password)};const c=document.querySelector('#vault-confirmation');if(c)c.value=${JSON.stringify(confirmation??password)};document.querySelector('.vault-form').requestSubmit();})()`);
  await submit("Synthetic!Workspace58","Different!Workspace79");
  const mismatch=await evaluate("document.querySelector('#vault-status').textContent.includes('do not match')");
  await submit("Synthetic!Workspace58");await wait("!!document.querySelector('.vault-backup')");
  const created=await evaluate("!!localStorage.getItem('senyap-workspace-v1') && !document.querySelector('#vault-password')");
  // Capture the real download payload locally without printing secret or ciphertext.
  await evaluate("window.__backup='';window.__create=URL.createObjectURL;URL.createObjectURL=b=>{b.text().then(t=>window.__backup=t);return window.__create(b)};document.querySelector('.vault-backup .vault-action').click()");
  await wait("window.__backup.length>0 && !document.querySelector('.vault-backup .vault-action').disabled");
  const encrypted=await evaluate("JSON.parse(window.__backup).format==='midnight-private-state-export' && !window.__backup.includes('scout') && !window.__backup.includes('signing')");
  await evaluate("document.querySelector('.vault-backup .vault-link').click()");await wait("!!document.querySelector('#vault-password')");
  await submit("Wrong!Workspace79");await wait("!document.querySelector('.vault-action').disabled");
  const wrongPassword=await evaluate("document.querySelector('#vault-status').textContent.includes('could not be opened') && !document.querySelector('.vault-backup')");
  await submit("Synthetic!Workspace58");await wait("!!document.querySelector('.vault-backup')");
  const unlocked=true;
  const backup=await evaluate("window.__backup"); // encrypted payload only, held in this process for the independent-profile restore.
  await call("Page.reload",{},sessionId);await wait("!!document.querySelector('#vault-password')");
  const reloadLocked=await evaluate("!document.querySelector('.vault-backup') && document.querySelector('h1').textContent.includes('Unlock')");
  let pendingOpenStaysLocked=true;
  for(const expression of ["new Event('pagehide')", "new StorageEvent('storage',{key:'senyap-workspace-v1'})", "new StorageEvent('storage',{key:null})"]){
    await evaluate(`(()=>{document.querySelector('#vault-password').value='Synthetic!Workspace58';document.querySelector('.vault-form').requestSubmit();window.dispatchEvent(${expression});})()`);
    await wait("!document.querySelector('.vault-action').disabled");
    pendingOpenStaysLocked= pendingOpenStaysLocked && await evaluate("!document.querySelector('.vault-backup')");
  }
  await evaluate("Array.from(document.querySelectorAll('.vault-switch button')).find(b=>b.textContent.includes('Set up')).click()");
  await submit("Synthetic!Workspace58");await wait("!document.querySelector('.vault-action').disabled");
  const replacementRejected=await evaluate("document.querySelector('#vault-status').textContent.includes('already exists') && !document.querySelector('.vault-backup')");
  // Incognito browser context has a distinct storage partition, like another device.
  const {browserContextId}=await call("Target.createBrowserContext");
  const fresh=await call("Target.createTarget",{url:base+"/app/workspace",browserContextId});
  const attached=await call("Target.attachToTarget",{targetId:fresh.targetId,flatten:true});
  const freshEval=async(expression:string)=>{const r=await call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true},attached.sessionId);if(r.exceptionDetails)throw Error("Restore evaluation failed");return r.result.value;};
  for(let i=0;i<100;i++){if(await freshEval("!!document.querySelector('#vault-password')"))break;await new Promise(r=>setTimeout(r,100));}
  await freshEval("Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Restore encrypted backup').click()");
  const restoreSubmit=async(password:string)=>freshEval(`(()=>{const d=new DataTransfer();d.items.add(new File([${JSON.stringify(backup)}],'synthetic-encrypted.json',{type:'application/json'}));document.querySelector('#vault-backup').files=d.files;document.querySelector('#vault-password').value=${JSON.stringify(password)};document.querySelector('.vault-form').requestSubmit();})()`);
  await restoreSubmit("Wrong!Workspace79");
  for(let i=0;i<100;i++){if(await freshEval("document.querySelector('#vault-status').textContent.includes('could not be opened')"))break;await new Promise(r=>setTimeout(r,100));}
  const badRestore=await freshEval("!localStorage.getItem('senyap-workspace-v1') && !document.querySelector('.vault-backup')");
  await restoreSubmit("Synthetic!Workspace58");
  for(let i=0;i<100;i++){if(await freshEval("!!document.querySelector('.vault-backup')"))break;await new Promise(r=>setTimeout(r,100));}
  const restored=await freshEval("!!document.querySelector('.vault-backup') && !!localStorage.getItem('senyap-workspace-v1')");
  const evidence={scope:"isolated headless Chrome profiles; synthetic passwords and local keys; no wallet or transaction",noOverflow,mismatch,created,encrypted,wrongPassword,unlocked,reloadLocked,pendingOpenStaysLocked,replacementRejected,badRestore,restored};
  await writeFile(base.endsWith(":5176") ? "docs/evidence/workspace-production-browser.json" : "docs/evidence/workspace-browser.json",JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(evidence));
  if(Object.entries(evidence).some(([k,v])=>k!=="scope"&&v!==true))throw Error("Workspace acceptance failed");
} finally {socket?.close();chrome.kill("SIGTERM");}
