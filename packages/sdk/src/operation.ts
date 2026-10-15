// SPDX-License-Identifier: Apache-2.0
import type { ClientPrivateState } from "./client-state";
import type { WorkspaceClient } from "./workspace";
export type ClientOperation={id:string;kind:string;phase:"prepared"|"submitted"|"uncertain"|"finalized"|"failed"|"not-submitted";txId?:string};
export interface OperationJournal {
  get():Promise<ClientOperation|null>;
  begin(id:string,kind:string):Promise<void>;
  submitted(id:string,txId:string):Promise<void>;
  finish(id:string,phase:"finalized"|"failed"|"not-submitted"|"uncertain",txId?:string):Promise<void>;
}
/** Caller supplies a trusted finalized-indexer lookup. An unknown response never
 * authorizes another send. This function reconciles metadata, not transactions. */
export async function reconcileClientOperation(client:WorkspaceClient,lookup:(txId:string)=>Promise<"succeeded"|"failed"|"unknown">){
  const operation=await client.journal.get();if(!operation||!operation.txId||operation.phase==="finalized"||operation.phase==="failed"||operation.phase==="not-submitted")return operation;
  const status=await lookup(operation.txId);if(status!=="unknown")await client.journal.finish(operation.id,status==="succeeded"?"finalized":"failed",operation.txId);
  return client.journal.get();
}
/** Explicitly cancel only an operation with no persisted send ID. The required
 * beforeSubmit hook will reject any late attempt from its abandoned proof job. */
export async function abandonUnsubmittedOperation(client:WorkspaceClient){
  const operation=await client.journal.get();if(!operation||operation.txId)throw Error("A submitted transaction cannot be abandoned");
  await client.journal.finish(operation.id,"not-submitted");
}
/** The host connects this to one deployment's Midnight.js callTx and records the
 * public tx ID BEFORE handing the signed transaction to Lace.submitTransaction.
 * The call promise must resolve only after successful finalization. No retry is
 * performed here. Unknown call errors keep the durable operation blocked. */
export async function executeClientOperation(args:{client:WorkspaceClient;kind:string;
  prepare:(state:ClientPrivateState)=>Promise<ClientPrivateState>|ClientPrivateState;
  call:(beforeSubmit:(txId:string)=>Promise<void>)=>Promise<{txId:string;finalized:true}>}):Promise<{txId:string}> {
  const id=Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,"0")).join("");
  await args.client.journal.begin(id,args.kind);
  try {await args.client.update(args.prepare);}catch{
    try{await args.client.journal.finish(id,"not-submitted");}catch{}throw Error("Private action preparation failed. No transaction was submitted.");
  }
  try {
    const result=await args.call(txId=>args.client.journal.submitted(id,txId));
    const recorded=await args.client.journal.get();
    if(result.finalized!==true||recorded?.id!==id||recorded.txId!==result.txId)throw Error();
    await args.client.journal.finish(id,"finalized",result.txId);return {txId:result.txId};
  }catch{
    try{await args.client.journal.finish(id,"uncertain");}catch{}
    throw Error("Transaction result needs reconciliation. Inspect the recorded transaction before retrying.");
  }
}
