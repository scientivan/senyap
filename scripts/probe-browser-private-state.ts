// SPDX-License-Identifier: Apache-2.0
// Isolated Chromium profile and synthetic data only. Does not access Lace or submit transactions.
import { spawn } from "node:child_process";
import { mkdtemp,writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
const profile=await mkdtemp(join(tmpdir(),"senyap-private-browser-"));
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
  const {targetId}=await call("Target.createTarget",{url:"http://127.0.0.1:5174/app"});
  const {sessionId}=await call("Target.attachToTarget",{targetId,flatten:true});
  const evaluate=async(expression:string)=>{
    const result=await call("Runtime.evaluate",{expression,awaitPromise:true,returnByValue:true},sessionId);
    if(result.exceptionDetails)throw Error(`Browser evaluation failed: ${result.exceptionDetails.exception?.description??result.exceptionDetails.text}`);
    return result.result.value;
  };
  for(let attempt=0;attempt<30;attempt++){
    try{if(await evaluate("location.href==='http://127.0.0.1:5174/app'&&document.readyState==='complete'"))break;}catch{}
    if(attempt===29)throw Error("Local application did not load");await new Promise(resolve=>setTimeout(resolve,200));
  }
  const modulePath="/@fs"+resolve("packages/sdk/src/private-state.ts");
  const setup=`const {persistentState,packPrivateKey,restorePrivateKey}=await import(${JSON.stringify(modulePath)});const config={network:'undeployed',accountId:'synthetic-browser-probe',contractAddress:'${"a".repeat(64)}',password:()=> 'Synthet!c-Browser-Pass-58',databaseName:'senyap-browser-probe-v1'};const provider=persistentState(config);`;
  const cryptoModules=`const {generateRevealKey}=await import(${JSON.stringify("/@fs"+resolve("packages/crypto/src/identity-reveal.ts"))});const {generateBuyerKey,encryptForBuyer,decryptFromCommittee}=await import(${JSON.stringify("/@fs"+resolve("packages/crypto/src/buyer-channel.ts"))});`;
  const before=await evaluate(`(async()=>{${setup}${cryptoModules}const reveal=await generateRevealKey(),buyer=await generateBuyerKey();await provider.set('probe',{revealPrivate:await packPrivateKey(reveal.privateKey),revealPublic:reveal.publicKey,buyerPrivate:await packPrivateKey(buyer.privateKey),buyerPublic:buyer.publicKey,marker:'synthetic-browser-secret-marker',value:725n,bytes:new Uint8Array([4,8,15])});const result=await provider.get('probe');return {saved:result.value===725n&&result.bytes[2]===15};})()`);
  await call("Page.reload",{},sessionId);
  // Wait for the new document's module environment after reload, without touching the user browser.
  let after:any;
  for(let attempt=0;attempt<15;attempt++){
    try{after=await evaluate(`(async()=>{${setup}${cryptoModules}const result=await provider.get('probe');const privateKey=await restorePrivateKey(result.buyerPrivate,'X25519'),signer=await restorePrivateKey(result.revealPrivate,'Ed25519'),message=new TextEncoder().encode('synthetic-persisted-key-check');const signature=await crypto.subtle.sign('Ed25519',signer,message),pub=await crypto.subtle.importKey('raw',result.revealPublic,'Ed25519',false,['verify']);const signingRestored=await crypto.subtle.verify('Ed25519',pub,signature,message);const envelope=await encryptForBuyer(result.buyerPublic,message,'browser-probe'),opened=await decryptFromCommittee(privateKey,envelope,'browser-probe');const keysRestored=signingRestored&&opened.every((value,i)=>value===message[i]);const backup=await provider.exportPrivateStates();let rejected=false;try{await persistentState({...config,password:()=> 'Wrong-Synthet!c-Pass-76'}).get('probe');}catch{rejected=true;}return {keysRestored,reopened:result?.value===725n&&result?.bytes[2]===15,exportEncrypted:!JSON.stringify(backup).includes('synthetic-browser-secret-marker'),wrongPasswordRejected:rejected,indexedDB:typeof indexedDB!=='undefined'};})()`);break;}catch(error){if(attempt===14)throw error;await new Promise(resolve=>setTimeout(resolve,200));}
  }
  if(!before.saved||!after.reopened||!after.exportEncrypted||!after.wrongPasswordRejected||!after.indexedDB||!after.keysRestored)throw Error("Browser persistence assertions failed");
  const evidence={scope:"isolated Chromium profile, synthetic data, no wallet or blockchain transaction",provider:"midnight-js-level-private-state-provider 4.1.1",...before,...after};
  await writeFile("docs/evidence/private-state-browser.json",JSON.stringify(evidence,null,2)+"\n");console.log(JSON.stringify(evidence));
} finally {socket?.close();chrome.kill("SIGTERM");}
