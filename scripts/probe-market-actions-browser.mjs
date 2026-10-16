// SPDX-License-Identifier: Apache-2.0
// Actual component probe with synthetic props in an isolated Chrome profile. No wallet or service calls.
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const target=pathToFileURL(resolve('design/live-market-actions.html')).href;
const states=['stake','eligibility','buy','report','withdraw','review','pending','uncertain','reason','signal'];
const headings={stake:'Seal a private pick',eligibility:'Seal a private pick',buy:'Buy an option signal',report:'Report an outcome',withdraw:'Withdraw a refunded stake',review:'Review before preparing',pending:'Prepare your transaction',uncertain:'Check your transaction',reason:'Complete your reason delivery',signal:'Open your purchased signal'};
const profile=await mkdtemp(join(tmpdir(),'senyap-market-preview-'));
const directory=resolve('.impeccable/review/market-actions-app');await mkdir(directory,{recursive:true});
const browser=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless','--disable-gpu','--disable-background-networking','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{stdio:['ignore','ignore','pipe']});
let socket;
try{
  const endpoint=await new Promise((done,reject)=>{const timer=setTimeout(()=>reject(Error('Preview browser unavailable')),15000);browser.stderr.on('data',data=>{const match=String(data).match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);done(match[1]);}});browser.once('error',reject);});
  socket=new WebSocket(endpoint);await new Promise((done,reject)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',reject,{once:true});});
  let sequence=0;const pending=new Map(),requests=[];
  socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Network.requestWillBeSent')requests.push(message.params.request.url);const item=pending.get(message.id);if(!item)return;pending.delete(message.id);clearTimeout(item.timer);message.error?item.reject(Error(message.error.message)):item.done(message.result);});
  const call=(method,params={},sessionId)=>new Promise((done,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);reject(Error(method+' timed out'));},15000);pending.set(id,{done,reject,timer});socket.send(JSON.stringify({id,method,params,sessionId}));});
  const {targetId}=await call('Target.createTarget',{url:'about:blank'}),{sessionId}=await call('Target.attachToTarget',{targetId,flatten:true});
  await call('Page.enable',{},sessionId);await call('Network.enable',{},sessionId);
  const evaluate=async expression=>{const value=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(value.exceptionDetails)throw Error('Component probe evaluation failed: '+(value.exceptionDetails.exception?.description??value.exceptionDetails.text));return value.result.value;};
  await call('Page.navigate',{url:'http://127.0.0.1:5174/app/preprod'},sessionId);
  for(let i=0;i<100;i++){if(await evaluate("!!document.querySelector('.live-workspace')"))break;await new Promise(done=>setTimeout(done,100));}
  await evaluate(`(async()=>{const React=(await import('/node_modules/.vite/deps/react.js')).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,{LiveMarketActions}=await import('/src/app/pages/LiveMarketActions.tsx');
    const container=document.createElement('div');container.className='app live-workspace';container.id='action-probe';document.body.replaceChildren(container);
    window.probeCalls=[];
    window.renderActions=(state)=>{const market={id:1n,side:'B',outcomeMode:'objective',phase:state==='refund'?'cancelled':'open',flatPrice:10n};const props={market,metadata:{options:[{label:'Synthetic builder one'},{label:'Synthetic builder two'}]},eligibility:{stakeStatus:state==='eligibility'?'membership-unavailable':'eligible',stake:state==='eligibility'?[]:[{option:0,group:'a'.repeat(64),slot:1},{option:1,group:'a'.repeat(64),slot:1}],buy:[0,1],report:[0,1],pool:0},positions:[{id:'fixture',market:1n,slot:1,status:'active',stake:100n}],disabled:state==='pending',reasonConfigured:true,onExecute:async intent=>{window.probeCalls.push(intent.kind);}};window.probeRoot.render(React.createElement('div',null,React.createElement('h1',null,'Synthetic component test'),React.createElement('p',null,'Isolated test only. No wallet or service is connected.'),React.createElement(LiveMarketActions,{...props,key:state})));};window.probeRoot=createRoot(container);window.renderActions('stake');})()`);
  const settle=()=>new Promise(done=>setTimeout(done,100));await settle();
  const screenshots=[];
  const click=async text=>{await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);await settle();};
  const set=async(selector,value)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});const prototype=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await settle();};
  const checks={};
  for(const state of ['stake','eligibility','buy','report','refund','review','pending']){
    await evaluate(`window.renderActions(${JSON.stringify(state)})`);await settle();
    if(['buy','report','refund'].includes(state))await click({buy:'Buy',report:'Report',refund:'Refund'}[state]);
    if(state==='review'){await set('select','1');await set('textarea','Synthetic reason describing observed delivery.');await evaluate("document.querySelector('form').requestSubmit()");await settle();}
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1100,mobile:width===390,deviceScaleFactor:1},sessionId);await settle();
      const noOverflow=await evaluate('document.documentElement.scrollWidth<=innerWidth');if(!noOverflow)throw Error('Component overflow');
      const dimensions=await evaluate('({width:innerWidth,height:Math.max(innerHeight,document.documentElement.scrollHeight)})');
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...dimensions,scale:1}},sessionId),path=join(directory,`${state}-${width}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));screenshots.push({state,width,path,noOverflow});
    }
  }
  await evaluate("window.renderActions('stake')");await settle();await set('select','1');await set('textarea','Synthetic reason describing observed delivery.');await set('input[type=number]','9');checks.rejectsSmallStake=await evaluate("!document.querySelector('input[type=number]').checkValidity()");await set('input[type=number]','120');await evaluate("document.querySelector('form').requestSubmit()");await settle();checks.reviewBeforeSend=await evaluate("document.querySelector('.live-review').textContent.includes('120 dUSD')&&window.probeCalls.length===0");await click('Edit details');checks.editPreservesChoice=await evaluate("document.querySelector('select').value==='1'&&document.querySelector('input[type=number]').value==='120'");await evaluate("document.querySelector('form').requestSubmit()");await settle();await click('Prepare proof');checks.explicitSubmit=await evaluate("window.probeCalls.length===1&&window.probeCalls[0]==='stake'");
  await evaluate("window.renderActions('eligibility')");await settle();checks.membershipBlocks=await evaluate("document.querySelector('fieldset').disabled");await evaluate("window.renderActions('pending')");await settle();checks.pendingBlocks=await evaluate("document.querySelector('fieldset').disabled&&Array.from(document.querySelectorAll('.live-action-tabs button')).every(b=>b.disabled)");
  checks.walletAbsent=await evaluate('!window.midnight');checks.noExternalRequests=requests.every(url=>url.startsWith('http://127.0.0.1:5174/')||url.startsWith('data:'));
  if(Object.values(checks).some(v=>v!==true))throw Error('Component interaction check failed');
  await writeFile('docs/evidence/market-actions-browser.json',JSON.stringify({scope:'Actual React component in isolated synthetic test harness; no wallet, service or transaction',checks,screenshots},null,2)+'\n');console.log(JSON.stringify({checks,captures:screenshots.length}));
}finally{socket?.close();browser.kill('SIGTERM');}
