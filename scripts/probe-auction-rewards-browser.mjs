// SPDX-License-Identifier: Apache-2.0
// Actual paid-signal component with synthetic callbacks in isolated Chrome. No wallet or service calls.
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const profile=await mkdtemp(join(tmpdir(),'senyap-auction-actions-'));
const directory=resolve('.impeccable/review/auction-rewards-app');await mkdir(directory,{recursive:true});
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
  await evaluate(`(async()=>{const React=(await import('/node_modules/.vite/deps/react.js')).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,{LiveAuctionRewards}=await import('/src/app/pages/LiveAuctionRewards.tsx');
const container=document.createElement('div');container.className='app live-workspace';container.style.paddingInline='22px';document.body.replaceChildren(container);window.probeRoot=createRoot(container);window.probeCalls=[];window.generation=0;
window.renderAuction=state=>{window.probeCalls=[];const mode=state==='claim-review'?'claim':state==='review'||state==='pending'?'bid':state;const eligible={bid:mode==='bid',settleBid:mode==='settle'?{buyer:new Uint8Array(32).fill(1),ceiling:100n,price:40n,refund:60n,recipient:new Uint8Array(32).fill(20)}:null,selection:mode==='select'?{rank:0,options:[0,1,2,3],deadline:2100n}:null,hits:mode==='hit'?[{slot:1,pool:0}]:[],claims:mode==='claim'?[{slot:1,stake:100n,reward:17n,total:117n,cancelled:false}]:[]};window.probeRoot.render(React.createElement('div',null,React.createElement('h1',null,'Synthetic auction and reward test'),React.createElement('p',null,'Isolated actual component. No wallet, service or transaction is connected.'),React.createElement(LiveAuctionRewards,{key:++window.generation,market:{id:1n,side:'A',reservePrice:40n},metadata:{options:Array.from({length:4},(_,i)=>({label:'Synthetic builder '+(i+1)}))},eligibility:eligible,disabled:state==='pending',onExecute:async intent=>{window.probeCalls.push(intent);}})));};window.renderAuction('bid');})()`);
  const settle=()=>new Promise(done=>setTimeout(done,100));await settle();
  const screenshots=[];
  const click=async text=>{await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);await settle();};
  const set=async(selector,value)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)}),prototype=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);await settle();};
  const checks={};
  for(const state of ['bid','settle','select','hit','claim','review','claim-review','pending','unavailable']){
    await evaluate(`window.renderAuction(${JSON.stringify(state)})`);await settle();
    if(state==='claim'||state==='claim-review')await set('select','1');if(state==='claim-review'){await evaluate("document.querySelector('form').requestSubmit()");await settle();}
    if(state==='review'){await set('input[id$="-bid"]','80');await set('input[id$="-ceiling"]','100');await evaluate("document.querySelector('form').requestSubmit()");await settle();}
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1100,mobile:width===390,deviceScaleFactor:1},sessionId);await settle();
      const noOverflow=await evaluate('document.documentElement.scrollWidth<=innerWidth');if(!noOverflow)throw Error('Component overflow');
      const dimensions=await evaluate('({width:innerWidth,height:Math.max(innerHeight,document.documentElement.scrollHeight)})');
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...dimensions,scale:1}},sessionId),path=join(directory,`${state}-${width}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));screenshots.push({state,width,path,noOverflow});
    }
  }
  await evaluate("window.renderAuction('bid')");await settle();await set('input[id$="-bid"]','101');await set('input[id$="-ceiling"]','100');await evaluate("document.querySelector('form').requestSubmit()");await settle();checks.overCeilingBlocks=await evaluate("!!document.querySelector('[role=alert]')&&!document.querySelector('.live-review')&&window.probeCalls.length===0");
  await set('input[id$="-bid"]','9007199254740993');await set('input[id$="-ceiling"]','9007199254740994');await evaluate("document.querySelector('form').requestSubmit()");await settle();checks.exactLargeBid=await evaluate("document.querySelector('.live-review').textContent.includes('9007199254740993')&&window.probeCalls.length===0");await click('Edit details');checks.editPreserves=await evaluate("document.querySelector('input[id$=\"-bid\"]').value==='9007199254740993'");await evaluate("document.querySelector('form').requestSubmit()");await settle();await click('Prepare proof');checks.explicitSubmit=await evaluate("window.probeCalls.length===1&&window.probeCalls[0].kind==='bid'&&window.probeCalls[0].amount===9007199254740993n");
  await evaluate("window.renderAuction('select')");await settle();await evaluate("document.querySelectorAll('input[type=checkbox]').forEach(el=>el.click())");await settle();await evaluate("document.querySelector('form').requestSubmit()");await settle();checks.maxThree=await evaluate("document.querySelector('[role=alert]').textContent.includes('at most three')&&!document.querySelector('.live-review')");
  await evaluate("window.renderAuction('settle')");await settle();checks.savedRecipient=await evaluate("document.querySelector('dl').textContent.includes('mn_addr_preprod1')&&document.querySelector('dl').textContent.includes('60 dUSD')");
  await evaluate("window.renderAuction('claim')");await settle();await set('select','1');await evaluate("document.querySelector('form').requestSubmit()");await settle();checks.claimReview=await evaluate("document.querySelector('.live-review').textContent.includes('117 dUSD')&&document.querySelector('.live-review').textContent.includes('100 dUSD')&&document.querySelector('.live-review').textContent.includes('17 dUSD')&&document.querySelector('.live-review').textContent.includes('Pick 1')&&window.probeCalls.length===0");
  for(const state of ['pending','unavailable']){await evaluate(`window.renderAuction(${JSON.stringify(state)})`);await settle();checks[state+'Blocks']=await evaluate("document.querySelector('fieldset').disabled&&window.probeCalls.length===0");}
  checks.walletAbsent=await evaluate('!window.midnight');checks.noExternalRequests=requests.every(url=>url.startsWith('http://127.0.0.1:5174/')||url.startsWith('data:'));
  if(Object.values(checks).some(v=>v!==true))throw Error('Component interaction check failed');
  await writeFile('docs/evidence/auction-rewards-browser.json',JSON.stringify({scope:'Actual auction/reward React component with synthetic eligibility and callbacks; no wallet, service or transaction',checks,screenshots},null,2)+'\n');console.log(JSON.stringify({checks,captures:screenshots.length}));
}finally{socket?.close();browser.kill('SIGTERM');}
