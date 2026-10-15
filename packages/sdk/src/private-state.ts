// SPDX-License-Identifier: Apache-2.0
import { levelPrivateStateProvider,type LevelPrivateStateProviderConfig } from "@midnight-ntwrk/midnight-js-level-private-state-provider";
import type { PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";

/** Encrypted storage for the product, separate from the disposable S5 provider.
 * Password must be a user secret supplied in memory, never a wallet public key,
 * an address, a source literal or a persisted plaintext setting. The SDK enforces
 * its password policy and encrypts exports as well as database values. */
export function persistentState<PS>(config:{network:string;accountId:string;contractAddress:string;
  password:LevelPrivateStateProviderConfig["privateStoragePasswordProvider"];databaseName?:string}):PrivateStateProvider<string,PS> {
  if(!/^[a-z0-9-]{1,32}$/.test(config.network)||!config.accountId.trim()||!/^[a-f0-9]{64}$/.test(config.contractAddress))throw Error("Invalid private-state scope");
  const provider=levelPrivateStateProvider<string,PS>({midnightDbName:config.databaseName??`senyap-private-${config.network}-v1`,
    privateStateStoreName:"senyap-state-v1",signingKeyStoreName:"senyap-signing-v1",accountId:`${config.network}:${config.accountId}`,
    privateStoragePasswordProvider:config.password,cryptoBackend:"webcrypto"});
  provider.setContractAddress(config.contractAddress);
  return {...provider,setContractAddress(address){
    if(address!==config.contractAddress)throw Error("Create a separate provider for another contract");provider.setContractAddress(address);
  }};
}

/** PKCS#8 bytes are sensitive private state. Persist them only through the encrypted
 * provider above; never log them or include them in an HTTP request/export alone. */
export async function packPrivateKey(key:CryptoKey):Promise<Uint8Array> {
  if(key.type!=="private"||!["Ed25519","X25519"].includes(key.algorithm.name))throw Error("Unsupported private key");
  return new Uint8Array(await crypto.subtle.exportKey("pkcs8",key));
}
export async function restorePrivateKey(bytes:Uint8Array,algorithm:"Ed25519"|"X25519"):Promise<CryptoKey> {
  if(bytes.length<32||bytes.length>256)throw Error("Invalid stored private key");
  return crypto.subtle.importKey("pkcs8",new Uint8Array(bytes).buffer,algorithm,false,algorithm==="Ed25519"?["sign"]:["deriveBits"]);
}
