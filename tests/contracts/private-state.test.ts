// SPDX-License-Identifier: Apache-2.0
import { mkdtemp,readdir,readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe,expect,it } from "vitest";
import { persistentState,packPrivateKey,restorePrivateKey } from "../../packages/sdk/src/private-state";
import { generateRevealKey } from "../../packages/crypto/src/identity-reveal";
import { generateBuyerKey,encryptForBuyer,decryptFromCommittee } from "../../packages/crypto/src/buyer-channel";
// Synthetic local password. Never used for a user account or deployed wallet.
const password=()=>"Synthet!c-Vault-Pass-58";
describe("encrypted product private state",()=>{
  it("survives reopening, scopes accounts/contracts, rejects the wrong password and keeps storage/export encrypted",async()=>{
    const directory=await mkdtemp(join(tmpdir(),"senyap-private-state-test-")),databaseName=join(directory,"state");
    const config={network:"undeployed",accountId:"synthetic-account",contractAddress:"a".repeat(64),password,databaseName};
    const first=persistentState<{marker:string;counter:bigint;secret:Uint8Array}>(config),value={marker:"synthetic-secret-marker-do-not-store-plaintext",counter:500n,secret:new Uint8Array(32).fill(77)};
    await first.set("scout",value);expect(await persistentState<typeof value>(config).get("scout")).toEqual(value);
    expect(await persistentState<typeof value>({...config,accountId:"another-synthetic-account"}).get("scout")).toBeNull();
    expect(await persistentState<typeof value>({...config,contractAddress:"b".repeat(64)}).get("scout")).toBeNull();
    expect(()=>first.setContractAddress("b".repeat(64))).toThrow(/separate provider/);
    await expect(persistentState<typeof value>({...config,password:()=>"Wrong-Synthet!c-Pass-76"}).get("scout")).rejects.toThrow();
    const backup=await first.exportPrivateStates();expect(JSON.stringify(backup).includes(value.marker)).toBe(false);
    const restored=persistentState<typeof value>({...config,databaseName:join(directory,"restored")});await restored.importPrivateStates(backup);
    expect(await restored.get("scout")).toEqual(value);
    for(const filename of await readdir(databaseName)){
      const raw=await readFile(join(databaseName,filename));expect(raw.includes(Buffer.from(value.marker))).toBe(false);
    }
    // Owned test databases remain under the temporary directory; no file deletion.
  });
  it("restores signing and buyer decryption keys from encrypted state, and rejects weak passwords",async()=>{
    const directory=await mkdtemp(join(tmpdir(),"senyap-key-state-test-")),config={network:"undeployed",accountId:"synthetic-account",contractAddress:"a".repeat(64),password,databaseName:join(directory,"state")};
    const reveal=await generateRevealKey(),buyer=await generateBuyerKey(),provider=persistentState<{reveal:Uint8Array;buyer:Uint8Array}>(config);
    await provider.set("keys",{reveal:await packPrivateKey(reveal.privateKey),buyer:await packPrivateKey(buyer.privateKey)});
    const stored=await persistentState<{reveal:Uint8Array;buyer:Uint8Array}>(config).get("keys");if(!stored)throw Error("Synthetic key record missing");
    const signKey=await restorePrivateKey(stored.reveal,"Ed25519"),message=new TextEncoder().encode("synthetic-consent");
    const signature=await crypto.subtle.sign("Ed25519",signKey,message),pub=await crypto.subtle.importKey("raw",new Uint8Array(reveal.publicKey).buffer,"Ed25519",false,["verify"]);
    expect(await crypto.subtle.verify("Ed25519",pub,signature,message)).toBe(true);
    const privateKey=await restorePrivateKey(stored.buyer,"X25519"),envelope=await encryptForBuyer(buyer.publicKey,message,"synthetic-context");
    expect(await decryptFromCommittee(privateKey,envelope,"synthetic-context")).toEqual(message);
    await expect(persistentState({...config,password:()=>"weak",databaseName:join(directory,"weak")}).set("state",{})).rejects.toThrow();
  });
});
