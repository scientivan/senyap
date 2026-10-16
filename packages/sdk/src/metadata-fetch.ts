// SPDX-License-Identifier: Apache-2.0
/** Fixed operator origin only, bounded body, no credentials or redirects. Paths
 * are constructed internally; never pass a ledger URI to this helper. */
export async function fetchPublicMetadata(endpoint:string,path:string,request:typeof fetch=fetch):Promise<unknown>{
  const url=new URL(endpoint);
  if(url.username||url.password||url.search||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname))))throw Error("Invalid metadata endpoint");
  url.pathname=url.pathname.replace(/\/$/,"")+path;
  const response=await request(url,{credentials:"omit",redirect:"error",signal:AbortSignal.timeout(15000)});
  if(!response.ok||!response.body)throw Error("Public metadata unavailable");
  const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0;
  try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>32768){await reader.cancel();throw Error("Metadata response too large");}chunks.push(next.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
}
