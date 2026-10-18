// SPDX-License-Identifier: Apache-2.0
// Dev-only Preprod indexer proxy. Some wallets still report the decommissioned
// indexer.preprod.midnight.network. The dev server forwards /__bf/* to Blockfrost
// and adds the project token server-side, so the token never reaches the browser
// bundle. Enabled only when SENYAP_PREPROD_PROXY=1 and the token is in the
// server process environment.
import type {ProxyOptions} from "vite";
export function preprodProxy():Record<string,ProxyOptions>{
  const id=process.env.BLOCKFROST_PROJECT_ID_PREPROD?.trim();
  if(process.env.SENYAP_PREPROD_PROXY!=="1"||!id)return {};
  const q=`project_id=${encodeURIComponent(id)}`;
  return {
    "/__bf/indexer":{target:"https://midnight-preprod.blockfrost.io",changeOrigin:true,rewrite:()=>`/api/v0?${q}`},
    "/__bf/ws":{target:"wss://midnight-preprod.blockfrost.io",changeOrigin:true,ws:true,rewrite:()=>`/api/v0/ws?${q}`},
  };
}
