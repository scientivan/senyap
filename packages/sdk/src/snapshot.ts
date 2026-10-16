// SPDX-License-Identifier: Apache-2.0
import {ContractState,fromHex} from "@midnight-ntwrk/midnight-js-protocol/compact-runtime";
import {ledger} from "../../../contracts/managed/senyap/contract/index.js";
export type SnapshotConfig={network:string;contract:string;nodeUrl:string;indexerUrl:string;genesisHash:string;operatorCommitment:string;maxAgeSeconds?:number};
export type ProductSnapshot={state:ReturnType<typeof ledger>;blockTime:bigint;blockHash:string;blockHeight:number;network:string;contract:string};
const hash=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
function endpoint(value:string){const url=new URL(value);if(url.username||url.password||url.hash||!(url.protocol==="https:"||(url.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(url.hostname))))throw Error("Invalid trusted endpoint");return value;}
/** Fixed host configuration only, never request-provided state/endpoints. Trusts
 * the configured node/indexer; it is not a cryptographic light client. No wallet,
 * submit API, automatic retry or stale cached fallback is included. */
export function createSnapshotReader(config:SnapshotConfig,dependencies:{fetch?:typeof fetch;now?:()=>number}={}){
  config={...config};
  if(!/^[a-z0-9-]{1,32}$/.test(config.network)||!hash(config.contract)||!hash(config.genesisHash)||!hash(config.operatorCommitment))throw Error("Invalid snapshot deployment binding");
  const nodeUrl=endpoint(config.nodeUrl),indexerUrl=endpoint(config.indexerUrl),request=dependencies.fetch??fetch,now=dependencies.now??Date.now;
  const maxAge=config.maxAgeSeconds??60;if(!Number.isSafeInteger(maxAge)||maxAge<1||maxAge>3600)throw Error("Invalid snapshot freshness bound");
  async function post(url:string,body:unknown){
    const response=await request(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
    if(!response.ok||!response.body)throw Error();
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;if(size>16*1024*1024){await reader.cancel();throw Error();}chunks.push(chunk.value);}}
    finally{reader.releaseLock();}
    const contents=new Uint8Array(size);let offset=0;for(const chunk of chunks){contents.set(chunk,offset);offset+=chunk.length;}
    return JSON.parse(new TextDecoder().decode(contents));
  }
  return async():Promise<ProductSnapshot>=>{
    try{
      const replies=await post(nodeUrl,[{jsonrpc:"2.0",id:1,method:"chain_getFinalizedHead",params:[]},{jsonrpc:"2.0",id:2,method:"chain_getBlockHash",params:[0]}]);
      if(!Array.isArray(replies)||replies.length!==2||replies.some(item=>!item||item.error||item.jsonrpc!=="2.0"))throw Error();
      const finalized=replies.find(item=>item.id===1)?.result,genesis=replies.find(item=>item.id===2)?.result;
      if(typeof finalized!=="string"||!/^0x[a-f0-9]{64}$/.test(finalized)||genesis!==`0x${config.genesisHash}`)throw Error();
      const blockHash=finalized.slice(2);
      // Same anchor for time and state. Never combine latest-block time with an
      // independently fetched latest contract state.
      const result=await post(indexerUrl,{query:"query SenyapSnapshot($block: BlockOffset, $address: HexEncoded!, $action: ContractActionOffset) { block(offset: $block) { height hash timestamp } contractAction(address: $address, offset: $action) { state } }",variables:{block:{hash:blockHash},address:config.contract,action:{blockOffset:{hash:blockHash}}}});
      if(!result||(result.errors!==undefined&&(!Array.isArray(result.errors)||result.errors.length)))throw Error();const block=result.data?.block;let serialized=result.data?.contractAction?.state;
      if(!block||block.hash!==blockHash||!Number.isSafeInteger(block.height)||block.height<0||!Number.isSafeInteger(block.timestamp)||block.timestamp<0)throw Error();
      // Indexer 4.3.3 matches a block offset only when the contract acted in that
      // exact block. Otherwise use the latest action, which must not be newer
      // than the finalized anchor (a newer one means state is ahead; reject).
      if(serialized===undefined||serialized===null){
        const latest=await post(indexerUrl,{query:"query SenyapLatest($address: HexEncoded!) { contractAction(address: $address) { state transaction { block { height hash } } } }",variables:{address:config.contract}});
        if(!latest||(latest.errors!==undefined&&(!Array.isArray(latest.errors)||latest.errors.length)))throw Error();const action=latest.data?.contractAction;
        if(!action||!Number.isSafeInteger(action.transaction?.block?.height)||action.transaction.block.height>block.height)throw Error();
        serialized=action.state;
      }
      // Indexer 4.3.3 returns milliseconds. Compact timers use whole seconds.
      const seconds=Math.floor(block.timestamp/1000),wall=Math.floor(now()/1000);
      if(!Number.isSafeInteger(wall)||seconds>wall+5||wall-seconds>maxAge)throw Error();
      if(typeof serialized!=="string"||!serialized.length||serialized.length%2||!/^[a-f0-9]+$/.test(serialized))throw Error();
      const state=ledger(ContractState.deserialize(fromHex(serialized)).data);
      if(hex(state.operator)!==config.operatorCommitment)throw Error();
      return {state,blockTime:BigInt(seconds),blockHash,blockHeight:block.height,network:config.network,contract:config.contract};
    }catch{throw Error("Trusted finalized product snapshot unavailable");}
  };
}
