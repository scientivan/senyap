// SPDX-License-Identifier: Apache-2.0
import { DatabaseSync } from "node:sqlite";
import { envelopeFromWire,envelopeToWire } from "../../../packages/crypto/src/envelope-codec";
import type { ReasonRepository, StoredReason } from "./reasons";
/** Deployment-scoped ciphertext storage. No encryption key or plaintext reason
 * belongs in this database. Its .states directory must remain server-private. */
export class SqliteReasonRepository implements ReasonRepository {
  private readonly db:DatabaseSync;
  private readonly scope:string;
  constructor(path:string,deployment:{network:string;contract:string}){
    if(!/^[a-z0-9-]{1,32}$/.test(deployment.network)||!/^[a-f0-9]{64}$/.test(deployment.contract))throw Error("Invalid reason repository scope");
    this.scope=JSON.stringify([deployment.network,deployment.contract]);this.db=new DatabaseSync(path);
    this.db.exec("PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reasons (scope TEXT NOT NULL, position TEXT NOT NULL, market TEXT NOT NULL, sealed TEXT NOT NULL, PRIMARY KEY(scope,position));");
  }
  async putIfAbsent(row:StoredReason):Promise<boolean>{
    if(row.position.length!==32||row.market<0n||row.market>=2n**32n)throw Error("Invalid stored reason scope");
    const position=Buffer.from(row.position).toString("hex");
    return this.db.prepare("INSERT OR IGNORE INTO reasons VALUES(?,?,?,?)").run(this.scope,position,row.market.toString(),JSON.stringify(envelopeToWire(row.sealed))).changes===1;
  }
  async list(market:bigint):Promise<StoredReason[]>{
    return this.db.prepare("SELECT position,sealed FROM reasons WHERE scope=? AND market=? ORDER BY rowid").all(this.scope,market.toString()).map(row=>({position:new Uint8Array(Buffer.from(String(row.position),"hex")),market,sealed:envelopeFromWire(JSON.parse(String(row.sealed)))}));
  }
  close(){this.db.close();}
}
