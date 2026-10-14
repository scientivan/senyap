// SPDX-License-Identifier: Apache-2.0
// Explicit dev-only entry point for Apple Events' isolated execution context.
// This module runs in the page realm where Lace injects its connector. The DOM
// bridge publishes only approved public metadata, never wallet APIs or secrets.
import { prepare } from "./s5";

const statusId="senyap-s5-public-status";
let status=document.getElementById(statusId);
if(!status){
  status=document.createElement("script");status.id=statusId;status.setAttribute("type","application/json");document.head.appendChild(status);
  const node=status;
  const publish=(value:Record<string,unknown>)=>{node.textContent=JSON.stringify(value);};
  let controller:Awaited<ReturnType<typeof prepare>>|undefined;
  let busy=true;
  publish({phase:"preparing"});
  prepare(undefined,stage=>publish({phase:"preparing",stage})).then(result=>{controller=result;publish({phase:"ready",readiness:result.readiness,progress:result.publicProgress()});})
    .catch(error=>publish({phase:"error",message:error instanceof Error?error.message:"S5 preparation failed; private error details omitted."}))
    .finally(()=>{busy=false;});
  document.addEventListener("senyap-s5-command",async event=>{
    const action=(event as CustomEvent<string>).detail;
    if(action!=="deploy"&&action!=="ping"&&action!=="funding")return;
    if(busy||!controller)return;
    busy=true;publish({phase:action==="deploy"?"deploying":action==="ping"?"calling":"checking-funding",progress:controller.publicProgress()});
    try{
      if(action==="funding"){
        publish({phase:"ready",readiness:await controller.funding(),progress:controller.publicProgress()});return;
      }
      const progress=await controller[action]();publish({phase:action==="deploy"?"deployed":"complete",progress});
    }catch{
      publish({phase:"error",action,progress:controller.publicProgress(),message:"S5 operation failed or was rejected. Public progress retained; no automatic retry."});
    }finally{busy=false;}
  });
}
