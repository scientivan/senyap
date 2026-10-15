// SPDX-License-Identifier: Apache-2.0
import type {SnapshotConfig} from "../../indexer/src/snapshot";
export function required(env:NodeJS.ProcessEnv,name:string){const value=env[name]?.trim();if(!value)throw Error(`Missing ${name}`);return value;}
export function serviceConfig(env:NodeJS.ProcessEnv):SnapshotConfig&{origin:string}{
  const origin=required(env,"SENYAP_APP_ORIGIN"),url=new URL(origin);
  if(url.origin!==origin||!(url.protocol==="https:"||(url.protocol==="http:"&&["127.0.0.1","localhost","[::1]"].includes(url.hostname))))throw Error("Invalid app origin");
  return {network:required(env,"MIDNIGHT_NETWORK"),contract:required(env,"SENYAP_CONTRACT_ADDRESS"),nodeUrl:required(env,"MIDNIGHT_NODE_URL"),indexerUrl:required(env,"MIDNIGHT_INDEXER_URL"),genesisHash:required(env,"MIDNIGHT_GENESIS_HASH"),operatorCommitment:required(env,"SENYAP_OPERATOR_COMMITMENT"),origin};
}
export function port(value:string|undefined,fallback:number){if(value!==undefined&&!/^[1-9][0-9]{0,4}$/.test(value))throw Error("Invalid service port");const parsed=value===undefined?fallback:Number(value);if(parsed<1024||parsed>65535)throw Error("Invalid service port");return parsed;}
