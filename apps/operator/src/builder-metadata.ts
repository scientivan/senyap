// SPDX-License-Identifier: Apache-2.0
import {DatabaseSync} from "node:sqlite";
import type {Ledger} from "../../../contracts/managed/senyap/contract/index.js";
import type {DeploymentScope} from "../../../packages/sdk/src/read-model";
import {parseBuilderMetadata,verifyBuilderMetadata,type BuilderMetadata} from "../../../packages/sdk/src/builder-metadata";
export class SqliteBuilderMetadataRepository{
  private readonly db:DatabaseSync;private readonly scope:string;
  constructor(path:string,scope:DeploymentScope){
    if(!/^[a-z0-9-]{1,32}$/.test(scope.network)||!/^[a-f0-9]{64}$/.test(scope.contract))throw Error("Invalid builder metadata deployment");
    this.scope=JSON.stringify([scope.network,scope.contract]);this.db=new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS builder_metadata (scope TEXT NOT NULL, reference TEXT NOT NULL, document TEXT NOT NULL, PRIMARY KEY(scope,reference));");
  }
  put(value:BuilderMetadata){const parsed=parseBuilderMetadata(value);this.db.prepare("INSERT INTO builder_metadata VALUES(?,?,?) ON CONFLICT(scope,reference) DO UPDATE SET document=excluded.document").run(this.scope,parsed.reference,JSON.stringify(parsed));}
  get(reference:string):unknown|null{const row=this.db.prepare("SELECT document FROM builder_metadata WHERE scope=? AND reference=?").get(this.scope,reference);return row?JSON.parse(String(row.document)):null;}
  close(){this.db.close();}
}
export function builderMetadataService(read:()=>Promise<{state:Ledger}>,repository:Pick<SqliteBuilderMetadataRepository,"put"|"get">){
  const entry=async(reference:string)=>{
    if(!/^[a-f0-9]{64}$/.test(reference))throw Error("Invalid builder reference");
    const state=(await read()).state,id=new Uint8Array(Buffer.from(reference,"hex"));
    if(!state.builderRegistry.member(id))throw Error("Builder unavailable");
    const builder=state.builderRegistry.lookup(id);return {id:reference,profileHash:Buffer.from(builder.profileHash).toString("hex"),consent:builder.consent};
  };
  return {
    async publish(input:unknown){const parsed=parseBuilderMetadata(input),value=await verifyBuilderMetadata(parsed,await entry(parsed.reference));repository.put(value);return value;},
    async read(reference:string){const builder=await entry(reference),value=repository.get(reference);if(!value)throw Error("Builder metadata unavailable");return verifyBuilderMetadata(value,builder);}
  };
}
