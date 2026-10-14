// SPDX-License-Identifier: Apache-2.0
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { firstValueFrom, filter, timeout } from "rxjs";
import { CompiledContract } from "@midnight-ntwrk/midnight-js-protocol/compact-js";
import { deployContract, findDeployedContract, getUnshieldedBalances } from "@midnight-ntwrk/midnight-js-contracts";
import { ContractDeploy } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { MidnightWalletProvider, initializeMidnightProviders, inMemoryPrivateStateProvider,
  logger, syncWallet, type EnvironmentConfiguration } from "@midnight-ntwrk/testkit-js";
import { Contract } from "../contracts/managed/spikes/s3-unshielded/contract/index.js";

// The SDK's build helper logs seeds at info level. Silence it before creating any wallet.
logger.level="silent";
setNetworkId("undeployed");
const environment:EnvironmentConfiguration={networkId:"undeployed",walletNetworkId:"undeployed",
  indexer:"http://127.0.0.1:8088/api/v4/graphql",indexerWS:"ws://127.0.0.1:8088/api/v4/graphql/ws",
  node:"http://127.0.0.1:9944",nodeWS:"ws://127.0.0.1:9944",proofServer:"http://127.0.0.1:6300",faucet:undefined};
const compiled=CompiledContract.make("SenyapLocalTokenSpike",Contract<{}>).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(resolve("contracts/managed/spikes/s3-unshielded")));

if (!process.argv.includes("--execute-local")) {
  console.log("Prepared local-only S3/S4 experiment. No wallet started or transaction submitted.");
  console.log("With explicit approval: register local genesis NIGHT for DUST, deploy one demo-token fixture, mint 1000 dUSD, deposit 100, pay 75 to another in-memory wallet, inspect public balances.");
  process.exit(0);
}

// Public development-genesis fixture only. No real wallet seed is read or logged.
// This deterministic account is unsafe for any network besides this local devnet.
type Progress={network:string;transactions:{action:string;txId:string}[];contractAddress?:string;token?:string};
const prior:Progress=await readFile("docs/evidence/S3-local-token-partial.json","utf8").then(JSON.parse).catch(()=>({network:"undeployed",transactions:[]}));
if (prior.network!=="undeployed") throw new Error("Refusing nonlocal progress record");
if(prior.transactions.some(tx=>tx.action==="payoutDemo")){
  console.log("Authorized transaction sequence already submitted. Use scripts/inspect-local-token.ts for read-only verification; refusing to repeat it.");
  process.exit(0);
}
const fixture=Buffer.alloc(32);fixture[31]=1;
const payer=await MidnightWalletProvider.build(logger,environment,fixture.toString("hex"));
const recipient=await MidnightWalletProvider.build(logger,environment);
const transactions:{action:string;txId:string}[]=prior.transactions;
let contractAddress=prior.contractAddress, token=prior.token;
try {
  console.log("Syncing local development wallets (private values are not logged).");
  // start(true) may register genesis NIGHT for DUST. This is an authorized test transaction.
  await payer.start(true);
  await recipient.start(false);
  await firstValueFrom(payer.wallet.state().pipe(filter((s)=>s.dust.balance(new Date())>0n),timeout(10*60_000)));
  const providers={...initializeMidnightProviders<"mintDemo"|"depositDemo"|"payoutDemo",{}>(payer,environment,
    {zkConfigPath:resolve("contracts/managed/spikes/s3-unshielded"),privateStateStoreName:".states/local-token-spike"}),
    // Keep private state and maintenance keys in memory; no persistence or export.
    privateStateProvider:inMemoryPrivateStateProvider<string,{}>()};
  const previousDeploy=transactions.find((tx)=>tx.action==="deploy");
  if (!contractAddress && previousDeploy) {
    const publicTx=await providers.publicDataProvider.watchForTxData(previousDeploy.txId);
    for (const intent of publicTx.tx.intents?.values()??[]) {
      const deploy=intent.actions.find((action)=>action instanceof ContractDeploy);
      if (deploy instanceof ContractDeploy) contractAddress=deploy.address;
    }
    if (!contractAddress) throw new Error("Could not recover existing local deployment");
  }
  const deployed=contractAddress ? await findDeployedContract(providers,{compiledContract:compiled,contractAddress,privateStateId:"local-spike",initialPrivateState:{}})
    : await deployContract(providers,{compiledContract:compiled,privateStateId:"local-spike",initialPrivateState:{}});
  contractAddress=deployed.deployTxData.public.contractAddress;
  if (!previousDeploy) transactions.push({action:"deploy",txId:deployed.deployTxData.public.txId});
  // UserAddress is addressFromKey(publicKey), not the signing public key itself.
  const own={bytes:Uint8Array.from(Buffer.from(payer.unshieldedKeystore.getAddress(),"hex"))};
  const other={bytes:Uint8Array.from(Buffer.from(recipient.unshieldedKeystore.getAddress(),"hex"))};
  const mint=await deployed.callTx.mintDemo(own,1000n);
  transactions.push({action:"mintDemo",txId:mint.public.txId});
  const color=mint.private.result;
  token=Buffer.from(color).toString("hex");
  const fundedToken=token;
  await firstValueFrom(payer.wallet.state().pipe(filter((s)=>(s.unshielded.balances[fundedToken]??0n)>=1000n),timeout(120_000)));
  const deposit=await deployed.callTx.depositDemo(color,100n);
  transactions.push({action:"depositDemo",txId:deposit.public.txId});
  const offers=[...(deposit.public.tx.intents?.values()??[])].flatMap((intent)=>
    [intent.guaranteedUnshieldedOffer,intent.fallibleUnshieldedOffer].filter((offer)=>offer!==undefined));
  const fundingPublicKey=payer.unshieldedKeystore.getPublicKey();
  const publicInspection={network:"undeployed",txId:deposit.public.txId,fundingPublicKey,
    fundingKeyVisible:offers.some((offer)=>offer.inputs.some((input)=>input.owner===fundingPublicKey)),
    offers:offers.map((offer)=>({inputs:offer.inputs.map((input)=>({ownerPublicKey:input.owner,value:input.value.toString(),token:input.type})),
      outputs:offer.outputs.map((output)=>({ownerAddress:output.owner,value:output.value.toString(),token:output.type}))})),
    note:"Fields extracted only from finalized public tx. Wallet funding key/amounts are visible; this does not expose a real-world name. DUST privacy is not inferred from these fields."};
  await writeFile("docs/evidence/S4-public-transaction.json",JSON.stringify(publicInspection,null,2)+"\n");
  const payout=await deployed.callTx.payoutDemo(color,75n,other);
  transactions.push({action:"payoutDemo",txId:payout.public.txId});
  const payerState=await syncWallet(payer.wallet), otherState=await syncWallet(recipient.wallet);
  // SDK 4.1.1 queryUnshieldedBalances reads the deployment balance for calls.
  // Read the latest serialized contract state instead.
  const publicState=await providers.publicDataProvider.queryContractState(contractAddress);
  const contractBalance=[...(publicState?.balance.entries()??[])].find(([type])=>type.tag==="unshielded"&&type.raw===token)?.[1]??0n;
  const balances={payer:(payerState.unshielded.balances[token]??0n).toString(),recipient:(otherState.unshielded.balances[token]??0n).toString(),contract:contractBalance.toString()};
  if (balances.payer!=="900"||balances.recipient!=="75"||balances.contract!=="25")
    throw new Error("Local token balance assertions failed (see partial evidence)");
  const result={network:"undeployed",contractAddress,token,transactions,balances,
    note:"Local-only, permissionless test fixture. Not a secured product contract. Seed, private state and transcripts omitted."};
  await writeFile("docs/evidence/S3-local-token.json",JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
} catch(error) {
  // Persist only public transaction IDs, never a FinalizedCallTxData/private result object.
  const failure=error instanceof Error ? {
    name:error.name,
    message:error.message.replace(/[a-fA-F0-9]{64,}/g,"[redacted hex]").slice(0,240),
    frames:error.stack?.split("\n").slice(1,6),
  } : {name:"UnknownError"};
  await writeFile("docs/evidence/S3-local-token-partial.json",JSON.stringify({network:"undeployed",contractAddress,token,transactions,status:"incomplete",failure},null,2)+"\n");
  console.error("Local token experiment failed. Public partial transaction evidence was saved; private error payload omitted.");
  console.error(JSON.stringify(failure));
  process.exitCode=1;
} finally { await Promise.allSettled([payer.stop(),recipient.stop()]); }
