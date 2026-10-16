// SPDX-License-Identifier: Apache-2.0
export type ProductDeployment={contract:string;operatorApi:string;reasonPublicKey?:string;committee?:{endpoints:string[];publicKeys:{x:bigint;y:bigint}[]};snapshot:{nodeUrl:string;genesisHash:string;operatorCommitment:string}};
/** Public deployment data only. Missing/invalid configuration is an unavailable
 * product, never permission to use a synthetic address or demo state. */
export function productDeployment(env:Record<string,unknown>):ProductDeployment|null{
  const contract=env.VITE_SENYAP_CONTRACT_ADDRESS,nodeUrl=env.VITE_MIDNIGHT_NODE_URL,genesisHash=env.VITE_MIDNIGHT_GENESIS_HASH,operatorCommitment=env.VITE_SENYAP_OPERATOR_COMMITMENT,operatorApi=env.VITE_OPERATOR_API_URL;
  const hash=(value:unknown):value is string=>typeof value==="string"&&/^[a-f0-9]{64}$/.test(value);
  const endpoint=(value:unknown):value is string=>{
    try{if(typeof value!=="string")return false;const url=new URL(value);return !url.username&&!url.password&&!url.search&&!url.hash&&(url.protocol==="https:"||(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname)));}catch{return false;}
  };
  if(!hash(contract)||!hash(genesisHash)||!hash(operatorCommitment)||!endpoint(nodeUrl)||!endpoint(operatorApi))return null;
  const reasonPublicKey=env.VITE_OPERATOR_REASON_PUBLIC_KEY;
  let committee:ProductDeployment["committee"];
  try{
    const endpoints=JSON.parse(String(env.VITE_COMMITTEE_URLS)),shares=JSON.parse(String(env.VITE_COMMITTEE_PUBLIC_SHARES));
    if(!Array.isArray(endpoints)||endpoints.length!==5||new Set(endpoints).size!==5||!endpoints.every(endpoint)||!Array.isArray(shares)||shares.length!==5)throw Error();
    const coordinate=(n:unknown)=>{if(typeof n!=="string"||!/^(0|[1-9][0-9]{0,76})$/.test(n))throw Error();return BigInt(n);};
    committee={endpoints,publicKeys:shares.map(p=>({x:coordinate(p.x),y:coordinate(p.y)}))};
  }catch{/* Missing paid-service configuration does not invent endpoints or keys. */}
  return {contract,operatorApi,...(hash(reasonPublicKey)&&reasonPublicKey!=="0".repeat(64)?{reasonPublicKey}:{}),...(committee?{committee}:{}),snapshot:{nodeUrl,genesisHash,operatorCommitment}};
}
