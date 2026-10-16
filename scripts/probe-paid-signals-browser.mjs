// SPDX-License-Identifier: Apache-2.0
// Actual paid-signal component with synthetic callbacks in isolated Chrome. No wallet or service calls.
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

const profile=await mkdtemp(join(tmpdir(),'senyap-paid-signal-'));
const directory=resolve('.impeccable/review/paid-signals-app');await mkdir(directory,{recursive:true});
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
  await evaluate(`(async()=>{const React=(await import('/node_modules/.vite/deps/react.js')).default,{createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,{LivePurchasedSignal}=await import('/src/app/pages/LivePurchasedSignal.tsx');
    const container=document.createElement('div');container.className='app live-workspace';document.body.replaceChildren(container);window.probeRoot=createRoot(container);window.probeCalls=[];window.probeGeneration=0;
    window.renderSignal=state=>{const key=++window.probeGeneration;window.probeCalls=[];window.renderedState=state;window.probeRoot.render(React.createElement('div',null,React.createElement('h1',null,'Synthetic purchased signal test'),React.createElement('p',null,'Isolated test only. No wallet or service is connected.'),React.createElement(LivePurchasedSignal,{key,label:'Synthetic builder one',configured:state!=='configuration',disabled:state==='blocked',onOpen:async offset=>{window.probeCalls.push(offset);if(state==='loading'||state==='late')return await new Promise(resolve=>{window.resolveSignal=resolve;});if(state==='unavailable')throw Error('Synthetic outage');if(state==='reasons-outage')return {total:480n,reasons:[],next:null,reasonsAvailable:false};if(state==='pagination'&&window.probeCalls.length===2)throw Error('Synthetic page outage');return {total:480n,reasons:[{status:'screened',rewritten:offset===0?'The synthetic team shipped its documented integration.':'A second synthetic reason from another stored report.',claims:['An integration was shipped.'],opinions:['The documentation is clear.'],flags:['Synthetic screening flag'],D:.2,A:.3,DRS:.44,informationalOnly:true}],next:offset===0?1:null,reasonsAvailable:true};}})));};window.renderSignal('ready');})()`);
  const settle=()=>new Promise(done=>setTimeout(done,100));await settle();
  const screenshots=[];
  const click=async text=>{await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent===${JSON.stringify(text)}).click()`);await settle();};
  const checks={};
  for(const state of ['ready','loading','unavailable','reasons-outage','success','configuration','blocked']){
    await evaluate(`window.renderSignal(${JSON.stringify(state)})`);await settle();
    if(['loading','unavailable','reasons-outage','success'].includes(state))await click('Open purchased signal');
    for(const width of [1440,390]){
      await call('Emulation.setDeviceMetricsOverride',{width,height:1100,mobile:width===390,deviceScaleFactor:1},sessionId);await settle();
      const noOverflow=await evaluate('document.documentElement.scrollWidth<=innerWidth');if(!noOverflow)throw Error('Component overflow');
      const dimensions=await evaluate('({width:innerWidth,height:Math.max(innerHeight,document.documentElement.scrollHeight)})');
      const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...dimensions,scale:1}},sessionId),path=join(directory,`${state}-${width}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));screenshots.push({state,width,path,noOverflow});
    }
  }
  await evaluate("window.renderSignal('pagination')");await settle();await click('Open purchased signal');
  checks.openIsExplicit=await evaluate("window.probeCalls.length===1&&window.probeCalls[0]===0");
  await click('Load more reasons');checks.pageFailurePreservesResult=await evaluate("document.body.textContent.includes('480')&&document.body.textContent.includes('documented integration')&&document.body.textContent.includes('Signal unavailable')");
  await click('Try opening again');checks.retrySamePage=await evaluate("JSON.stringify(window.probeCalls)==='[0,1,1]'");
  checks.paginationAppends=await evaluate("document.body.textContent.includes('documented integration')&&document.body.textContent.includes('second synthetic reason')&&!Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Load more reasons')");
  await evaluate("window.renderSignal('reasons-outage')");await settle();await click('Open purchased signal');checks.totalSurvivesReasonOutage=await evaluate("document.body.textContent.includes('480')&&document.body.textContent.includes('reasons unavailable')");
  await evaluate("window.renderSignal('late')");await settle();await click('Open purchased signal');await evaluate("window.renderSignal('ready')");await settle();await evaluate("window.resolveSignal({total:999999n,reasons:[],next:null,reasonsAvailable:true})");await settle();checks.unmountedResultDiscarded=await evaluate("!document.body.textContent.includes('999999')");
  for(const state of ['configuration','blocked']){await evaluate(`window.renderSignal(${JSON.stringify(state)})`);await settle();checks[state+'Blocks']=await evaluate("document.querySelector('button').disabled&&window.probeCalls.length===0");}
  checks.walletAbsent=await evaluate('!window.midnight');checks.noExternalRequests=requests.every(url=>url.startsWith('http://127.0.0.1:5174/')||url.startsWith('data:'));
  if(Object.values(checks).some(v=>v!==true))throw Error('Component interaction check failed');
  await writeFile('docs/evidence/paid-signals-browser.json',JSON.stringify({scope:'Actual paid signal React component with synthetic callbacks; no wallet, service or transaction',checks,screenshots},null,2)+'\n');console.log(JSON.stringify({checks,captures:screenshots.length}));
}finally{socket?.close();browser.kill('SIGTERM');}
