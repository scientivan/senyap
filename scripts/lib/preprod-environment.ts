// SPDX-License-Identifier: Apache-2.0
// Preprod endpoints through Blockfrost. The project token is read from the
// process environment only and must never be printed or written to evidence.
import type {EnvironmentConfiguration} from "@midnight-ntwrk/testkit-js";
export function preprodEnvironment():EnvironmentConfiguration{
  const id=process.env.BLOCKFROST_PROJECT_ID_PREPROD?.trim();
  if(!id||!/^nightpreprod[A-Za-z0-9]+$/.test(id))throw Error("BLOCKFROST_PROJECT_ID_PREPROD missing or not a Preprod project");
  const q=`project_id=${id}`;
  return {networkId:"preprod",walletNetworkId:"preprod",
    indexer:`https://midnight-preprod.blockfrost.io/api/v0?${q}`,indexerWS:`wss://midnight-preprod.blockfrost.io/api/v0/ws?${q}`,
    node:`https://rpc.midnight-preprod.blockfrost.io?${q}`,nodeWS:`wss://rpc.midnight-preprod.blockfrost.io?${q}`,
    proofServer:"http://127.0.0.1:6300",faucet:undefined};
}
/** Removes the Blockfrost token and long encoded values from any message. */
export const scrub=(value:unknown)=>{const id=process.env.BLOCKFROST_PROJECT_ID_PREPROD?.trim();let text=value instanceof Error?`${value.name}: ${value.message}`:String(value);
  if(id)text=text.split(id).join("<project>");return text.replace(/nightpreprod[A-Za-z0-9]+/g,"<project>").replace(/[A-Za-z0-9+/=]{48,}/g,"<redacted>").slice(0,400);};
