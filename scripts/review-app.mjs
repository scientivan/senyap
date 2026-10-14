import { mkdir, readFile, writeFile } from "node:fs/promises";

// Connect only to the separate temporary headless Chrome started for this audit.
const targets = await (await fetch("http://127.0.0.1:9222/json")).json();
const target = targets.find((t) => t.type === "page");
if (!target) throw new Error("No audit Chrome page available");
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => { ws.onopen=resolve; ws.onerror=reject; });
let next=0;
const pending=new Map();
ws.onmessage=({data})=>{
  const message=JSON.parse(data);
  if (!message.id) return;
  const p=pending.get(message.id);if(!p)return;
  pending.delete(message.id);
  message.error?p.reject(new Error(message.error.message)):p.resolve(message.result);
};
function cdp(method,params={}) {
  const id=++next;
  return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
}
const evaluate=async(expression)=>(await cdp("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true})).result.value;
await cdp("Page.enable");await cdp("Runtime.enable");
await cdp("Emulation.setEmulatedMedia",{features:[{name:"prefers-reduced-motion",value:"reduce"}]});
await mkdir("docs/evidence",{recursive:true});
const routes=["/app","/app/markets","/app/markets/12","/app/markets/11","/app/markets/9","/app/markets/8","/app/markets/6","/app/new","/app/positions","/app/tier","/app/registry","/app/profile","/app/operator","/app/committee","/app/verify","/app/faucet","/app/guide"];
const reports=[];
for (const width of [1440,390]) {
  await cdp("Emulation.setDeviceMetricsOverride",{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:false});
  for (const route of routes.filter(route=>!process.argv[2]||route===process.argv[2])) {
    await cdp("Page.navigate",{url:`http://127.0.0.1:5174${route}`});
    await evaluate(`new Promise(resolve => setTimeout(resolve, 600))`);
    await evaluate("document.fonts.ready.then(() => true)");
    const report=await evaluate(`(()=>{
      const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
      const headings=[...document.querySelectorAll('h1,h2,h3')].filter(visible).map(e=>({text:e.textContent.trim(),size:getComputedStyle(e).fontSize,weight:getComputedStyle(e).fontWeight}));
      const fields=[...document.querySelectorAll('input,select,textarea')].filter(visible).filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')).map(e=>({tag:e.tagName,type:e.type,id:e.id}));
      const borders=[...document.querySelectorAll('button')].filter(visible).filter(e=>getComputedStyle(e).borderStyle!=='none'&&parseFloat(getComputedStyle(e).borderWidth)>0).map(e=>({text:e.textContent.trim(),border:getComputedStyle(e).border}));
      const body=document.body.innerText;
      return {route:location.pathname,width:innerWidth,height:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight),overflow:document.documentElement.scrollWidth>innerWidth,h1:[...document.querySelectorAll('h1')].map(e=>e.textContent.trim()),headings,unlabelledFields:fields,buttonBorders:borders,hasDemoLabel:/demo/i.test(body),emDash:/\u2014/.test(body),unicodeArrows:/[\u2190-\u21ff]/.test(body),paragraphs:[...document.querySelectorAll('p')].filter(visible).map(e=>({class:e.className,align:getComputedStyle(e).textAlign,text:e.textContent.trim().slice(0,100)}))};
    })()`);
    if (!report?.h1?.length) throw new Error(`Page failed to render: ${route}`);
    const name=`F4-${route.replace(/^\//,'').replaceAll('/','-')}-${width}.png`;
    const shot=await cdp("Page.captureScreenshot",{format:"png",captureBeyondViewport:true,clip:{x:0,y:0,width,height:report.height,scale:1}});
    await writeFile(`docs/evidence/${name}`,Buffer.from(shot.data,"base64"));
    reports.push({...report,screenshot:name});
    console.log(`${width} ${route} overflow=${report.overflow} unlabelledFields=${report.unlabelledFields.length}`);
  }
}
const previous=process.argv[2]?JSON.parse(await readFile("docs/evidence/F4-dom-review.json","utf8")):[];
await writeFile("docs/evidence/F4-dom-review.json",JSON.stringify([...previous.filter(r=>r.route!==process.argv[2]),...reports],null,2)+"\n");
ws.close();
