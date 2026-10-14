// Read-only inspection after the authorized S3/S4 transactions. No wallets or keys.
import { readFile, writeFile } from "node:fs/promises";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { getUnshieldedBalances } from "@midnight-ntwrk/midnight-js-contracts";
import { addressFromKey } from "@midnight-ntwrk/midnight-js-protocol/ledger";
import { logger } from "@midnight-ntwrk/testkit-js";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { UnshieldedAddress } from "@midnight-ntwrk/wallet-sdk-address-format";

logger.level="silent";
setNetworkId("undeployed");
const previous=JSON.parse(await readFile("docs/evidence/S3-local-token-partial.json","utf8"));
const visibility=JSON.parse(await readFile("docs/evidence/S4-public-transaction.json","utf8"));
if(previous.network!=="undeployed")throw new Error("Only local inspection allowed");
const provider=indexerPublicDataProvider("http://127.0.0.1:8088/api/v4/graphql","ws://127.0.0.1:8088/api/v4/graphql/ws");
const payouts=previous.transactions.filter((tx:{action:string})=>tx.action==="payoutDemo");
if (!payouts.length) throw new Error("No payout to inspect");
const payout=await provider.watchForTxData(payouts.at(-1).txId);
const outputs=[...(payout.tx.intents?.values()??[])].flatMap((intent)=>[intent.guaranteedUnshieldedOffer,intent.fallibleUnshieldedOffer]
  .flatMap((offer)=>offer?.outputs??[])).filter((output)=>output.type===previous.token);
const payer=addressFromKey(visibility.fundingPublicKey), recipient=outputs.find((output)=>output.value===75n)?.owner;
if (!recipient) throw new Error("Payout recipient missing from public tx");
const rpc=await fetch("http://127.0.0.1:9944",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"chain_getFinalizedHead",params:[]})});
const {result:head}=await rpc.json();
type PublicUtxo={owner:string;tokenType:string;value:string;intentHash:string;outputIndex:number};
const balanceOf=(address:string)=>new Promise<{balance:string;highestTransactionId:number;tokens:{token:string;value:string}[]}>((resolve,reject)=>{
  const encoded=UnshieldedAddress.codec.encode("undeployed",new UnshieldedAddress(Buffer.from(address,"hex")));
  const ws=new WebSocket("ws://127.0.0.1:8088/api/v4/graphql/ws","graphql-transport-ws");
  const utxos=new Map<string,PublicUtxo>();
  let highestTransactionId:number|undefined;
  let appliedId=0;
  const finish=()=>{clearTimeout(timer);ws.close();resolve({balance:[...utxos.values()].filter(u=>u.tokenType===previous.token).reduce((sum,u)=>sum+BigInt(u.value),0n).toString(),highestTransactionId:highestTransactionId!,tokens:[...utxos.values()].map(u=>({token:u.tokenType,value:u.value}))});};
  const timer=setTimeout(()=>{ws.close();reject(new Error("Public UTXO replay timed out"));},30_000);
  ws.onopen=()=>ws.send(JSON.stringify({type:"connection_init"}));
  ws.onerror=()=>{clearTimeout(timer);reject(new Error("Public indexer WebSocket failed"));};
  ws.onmessage=({data})=>{
    const message=JSON.parse(String(data));
    if(message.type==="connection_ack") ws.send(JSON.stringify({id:"balances",type:"subscribe",payload:{
      query:`subscription($address:UnshieldedAddress!){unshieldedTransactions(address:$address,transactionId:0){
        __typename ... on UnshieldedTransaction {transaction{id} createdUtxos{owner tokenType value intentHash outputIndex} spentUtxos{owner tokenType value intentHash outputIndex}}
        ... on UnshieldedTransactionsProgress {highestTransactionId}}}`,variables:{address:encoded.asString()}}}));
    if(message.type==="error"||message.payload?.errors){clearTimeout(timer);ws.close();reject(new Error(JSON.stringify(message.payload)));}
    const event=message.payload?.data?.unshieldedTransactions;
    if(event?.__typename==="UnshieldedTransaction"){
      for(const utxo of event.createdUtxos as PublicUtxo[])utxos.set(`${utxo.intentHash}:${utxo.outputIndex}`,utxo);
      for(const utxo of event.spentUtxos as PublicUtxo[])utxos.delete(`${utxo.intentHash}:${utxo.outputIndex}`);
      appliedId=Math.max(appliedId,event.transaction.id);
    }
    if(event?.__typename==="UnshieldedTransactionsProgress"){
      highestTransactionId=event.highestTransactionId;
    }
    if(highestTransactionId!==undefined&&appliedId>=highestTransactionId) finish();
  };
});
const [payerReplay,recipientReplay]=await Promise.all([balanceOf(payer),balanceOf(recipient)]);
const contractBalances=await getUnshieldedBalances(provider,previous.contractAddress);
const contractState=await provider.queryContractState(previous.contractAddress);
const stateBalances=[...(contractState?.balance.entries()??[])].map(([token,balance])=>({token,balance:balance.toString()}));
const balances={payer:payerReplay.balance,recipient:recipientReplay.balance,contract:(stateBalances.find(b=>b.token.tag==="unshielded"&&b.token.raw===previous.token)?.balance??"0")};
const result={network:"undeployed",contractAddress:previous.contractAddress,token:previous.token,transactions:previous.transactions,payerAddress:payer,recipientAddress:recipient,balances,finalizedHead:head,
  replayProgress:{payer:payerReplay,recipient:recipientReplay},indexerContractBalances:contractBalances.map(b=>({token:b.tokenType,balance:b.balance.toString()})),stateBalances,
  note:"Payer/recipient balances reconstructed from public indexer created/spent UTXO replay through its progress marker; contract balance read from indexer. Includes one earlier misaddressed synthetic mint. No additional transactions submitted."};
await writeFile("docs/evidence/S3-local-token-inspection.json",JSON.stringify(result,null,2)+"\n");
console.log(JSON.stringify(result,null,2));
if(balances.payer!=="900"||balances.recipient!=="75"||balances.contract!=="25") process.exitCode=1;
