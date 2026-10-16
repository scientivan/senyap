// SPDX-License-Identifier: Apache-2.0
export type ProductDeployment={contract:string;operatorApi:string;reasonPublicKey?:string;snapshot:{nodeUrl:string;genesisHash:string;operatorCommitment:string}};
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
  return {contract,operatorApi,...(hash(reasonPublicKey)?{reasonPublicKey}:{}),snapshot:{nodeUrl,genesisHash,operatorCommitment}};
}
