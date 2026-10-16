// SPDX-License-Identifier: Apache-2.0
// Static design probe in an isolated Chrome profile. No wallet or network calls.
import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const target=pathToFileURL(resolve('design/live-builder-market.html')).href;
const states=['register','withdraw','create','metadata','blocked','pending'];
const profile=await mkdtemp(join(tmpdir(),'senyap-builder-preview-'));
const directory=resolve('.impeccable/review/builder-preview');await mkdir(directory,{recursive:true});
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
  const evaluate=async expression=>{const value=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true},sessionId);if(value.exceptionDetails)throw Error('Preview script failed');return value.result.value;};
  const navigate=async state=>{await call('Page.navigate',{url:`${target}?state=${state}`},sessionId);for(let i=0;i<100;i++){if(await evaluate(`document.readyState==='complete' && document.querySelector('h1')?.textContent==='Builders and markets' && new URLSearchParams(location.search).get('state')===${JSON.stringify(state)}`))return;await new Promise(done=>setTimeout(done,30));}throw Error('Preview state unavailable');};
  const screenshots=[];
  for(const state of states)for(const width of [1440,390]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:1100,mobile:width===390,deviceScaleFactor:1},sessionId);await navigate(state);
    const checks=await evaluate(`({noOverflow:document.documentElement.scrollWidth<=innerWidth,previewLabel:document.querySelector('.preview-notice').textContent.includes('Synthetic'),noWallet:!window.midnight,expectedPanelVisible:!document.querySelector('[data-panel=${state}]').hidden})`);
    if(Object.values(checks).some(value=>value!==true))throw Error('Preview capture checks failed');
    const dimensions=await evaluate('({width:innerWidth,height:Math.max(innerHeight,document.documentElement.scrollHeight)})');
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{x:0,y:0,...dimensions,scale:1}},sessionId);
    const path=join(directory,`${state}-${width}.png`);await writeFile(path,Buffer.from(shot.data,'base64'));screenshots.push({state,width,path,...checks});
  }
  await navigate('register');
  const checks=await evaluate(`(()=>{const f=document.querySelector('[data-panel=register]');const requiresConsent=!f.checkValidity();f.elements.consent.checked=true;f.requestSubmit();const registrationReview=document.querySelector('#review-text').textContent.includes('Public consent becomes active')&&!document.querySelector('#review').hidden;document.querySelector('#backup').click();const publicExport=document.querySelector('#review-json').textContent.includes('syntheticPreviewOnly')&&!document.querySelector('#review-json').textContent.includes('secret');document.querySelector('#edit').click();const editRetains=f.elements.consent.checked&&f.elements.builderLabel.value==='Synthetic builder one';return {requiresConsent,registrationReview,publicExport,editRetains};})()`);
  await navigate('create');
  Object.assign(checks,await evaluate(`(()=>{const f=document.querySelector('[data-panel=create]');f.requestSubmit();const t=document.querySelector('#review-text').textContent;const exactTerms=t.includes('100 dUSD per option')&&t.includes('150 dUSD')&&t.includes('fixed')&&t.includes('UTC');document.querySelector('#edit').click();f.querySelectorAll('[name=builderOption]').forEach(e=>e.checked=false);f.requestSubmit();const requiresOption=document.querySelector('#form-error').textContent.includes('one to eight');f.querySelector('[name=builderOption]').checked=true;f.elements.outcome.value='2026-10-16T08:00';f.requestSubmit();const requiresSchedule=document.querySelector('#form-error').textContent.includes('opening before close');return {exactTerms,requiresOption,requiresSchedule};})()`));
  await navigate('metadata');
  Object.assign(checks,await evaluate(`(()=>{document.querySelector('#retry').click();document.querySelector('#export').click();const doc=JSON.parse(document.querySelector('#public-json').textContent);return {completeRecoveryDocument:doc.version===1&&doc.side==='A'&&doc.category==='c'.repeat(64)&&doc.options.length===1&&doc.options[0].reference==='1'.repeat(64)&&doc.options[0].label==='Synthetic builder one',uploadOnly:document.querySelector('#status').textContent.includes('no wallet request or new market')};})()`));
  await navigate('pending');
  Object.assign(checks,await evaluate(`({pendingBlocked:document.querySelector('[data-panel=pending] .button').disabled})`));
  checks.noExternalRequests=requests.every(url=>url.startsWith('file:')||url.startsWith('data:'));
  if(Object.values(checks).some(value=>value!==true))throw Error('Preview interaction checks failed');
  await writeFile('docs/evidence/builder-preview-browser.json',JSON.stringify({scope:'Static synthetic design preview only; fresh isolated Chrome profile, no wallet/storage/service/transaction',checks,screenshots},null,2)+'\n');
  console.log(JSON.stringify({checks,captures:screenshots.length}));
}finally{socket?.close();browser.kill('SIGTERM');}
