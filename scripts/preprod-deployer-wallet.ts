// SPDX-License-Identifier: Apache-2.0
// Preprod deployer wallet. Creates a local seed once (.states/, gitignored, mode
// 600) and prints only the public unshielded address and balances. With
// --register-dust it submits one NIGHT-to-DUST registration (approved by Dien,
// 18 Oct 2026). The seed is never printed.
import {mkdir,readFile,writeFile,chmod} from "node:fs/promises";
import {randomBytes} from "node:crypto";
import {firstValueFrom} from "rxjs";
import {MidnightWalletProvider,logger,syncWallet} from "@midnight-ntwrk/testkit-js";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
import {unshieldedToken} from "@midnight-ntwrk/midnight-js-protocol/ledger";
import {preprodEnvironment,scrub} from "./lib/preprod-environment";
import {applyDustFeeWorkaround} from "./lib/local-wallet-balance";

logger.level="silent";applyDustFeeWorkaround();setNetworkId("preprod");
export const seedPath=".states/preprod-deployer.seed";
export async function deployerSeed(){
  try{return (await readFile(seedPath,"utf8")).trim();}
  catch{await mkdir(".states",{recursive:true});const seed=randomBytes(32).toString("hex");await writeFile(seedPath,seed+"\n",{flag:"wx",mode:0o600});await chmod(seedPath,0o600);return seed;}
}
if(process.argv[1]?.endsWith("preprod-deployer-wallet.ts")){
  const provider=await MidnightWalletProvider.build(logger,preprodEnvironment(),await deployerSeed());
  try{
    console.log(JSON.stringify({address:provider.unshieldedKeystore.getBech32Address().asString()}));
    await provider.start(false);
    const progress=setInterval(async()=>{try{const st=await firstValueFrom(provider.wallet.state());console.log(JSON.stringify({at:new Date().toISOString(),sync:{shielded:st.shielded.progress,unshielded:st.unshielded.progress,dust:st.dust.progress}},(_,v)=>typeof v==="bigint"?v.toString():v));}catch{}},60_000);
    const state=await syncWallet(provider.wallet,5_000,4*3_600_000);clearInterval(progress);
    const night=state.unshielded.balances[unshieldedToken().raw]??0n;
    const coins=state.unshielded.availableCoins.filter(c=>c.utxo.type===unshieldedToken().raw);
    console.log(JSON.stringify({night:night.toString(),nightUtxos:coins.length,unregistered:coins.filter(c=>!c.meta.registeredForDustGeneration).length,dust:state.dust.balance(new Date()).toString()}));
    if(process.argv.includes("--register-dust")){
      const unregistered=coins.filter(c=>!c.meta.registeredForDustGeneration);
      if(!unregistered.length)console.log(JSON.stringify({registration:"nothing to register"}));
      else{
        const k=provider.unshieldedKeystore;
        const recipe=await provider.wallet.registerNightUtxosForDustGeneration(unregistered,k.getPublicKey(),p=>k.signData(p));
        const txId=await provider.wallet.submitTransaction(await provider.wallet.finalizeRecipe(recipe));
        console.log(JSON.stringify({registrationTx:txId}));
      }
    }
  }catch(e){console.error(JSON.stringify({error:scrub(e)}));process.exitCode=1;}
  finally{await provider.stop().catch(()=>{});}
}
