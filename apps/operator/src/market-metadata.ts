// SPDX-License-Identifier: Apache-2.0
import {DatabaseSync} from "node:sqlite";
import {parseMarketMetadata,verifyMarketMetadata,type MarketMetadata} from "../../../packages/sdk/src/market-metadata";
import {readProductView,type DeploymentScope} from "../../../packages/sdk/src/read-model";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";

/** Only public, ledger-committed metadata. Shares, identities and reasons never
 * belong in this table. A document can be uploaded after its market exists. */
export class SqliteMarketMetadataRepository{
  private readonly db:DatabaseSync;
  private readonly scope:string;
  constructor(path:string,scope:DeploymentScope){
    if(!/^[a-z0-9-]{1,32}$/.test(scope.network)||!/^[a-f0-9]{64}$/.test(scope.contract))throw Error("Invalid metadata deployment");
    this.scope=JSON.stringify([scope.network,scope.contract]);this.db=new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS market_metadata (scope TEXT NOT NULL, market TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(scope,market));");
  }
  put(market:bigint,value:MarketMetadata){this.db.prepare("INSERT INTO market_metadata VALUES(?,?,?) ON CONFLICT(scope,market) DO UPDATE SET document=excluded.document").run(this.scope,market.toString(),JSON.stringify(parseMarketMetadata(value)));}
  get(market:bigint):unknown|null{const row=this.db.prepare("SELECT document FROM market_metadata WHERE scope=? AND market=?").get(this.scope,market.toString());return row?JSON.parse(String(row.document)):null;}
  close(){this.db.close();}
}
export function marketMetadataService(scope:DeploymentScope,read:()=>Promise<{state:Ledger}>,repository:Pick<SqliteMarketMetadataRepository,"put"|"get">){
  scope={...scope};
  const market=async(id:bigint)=>{
    if(id<0n||id>=2n**32n)throw Error("Invalid metadata market");
    const view=readProductView((await read()).state,scope).markets.find(value=>value.id===id);
    if(!view)throw Error("Metadata market unavailable");return view;
  };
  return {
    async publish(id:bigint,input:unknown){const value=await verifyMarketMetadata(input,await market(id));repository.put(id,value);return value;},
    async read(id:bigint){const view=await market(id),value=repository.get(id);if(!value)throw Error("Metadata unavailable");return verifyMarketMetadata(value,view);}
  };
}
