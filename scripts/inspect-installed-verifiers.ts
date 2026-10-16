// SPDX-License-Identifier: Apache-2.0
// Read-only: lists verifier operations installed on a local contract. No wallet, no submission.
import {indexerPublicDataProvider} from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import {setNetworkId} from "@midnight-ntwrk/midnight-js-network-id";
const address=process.argv[2];
if(!/^[a-f0-9]{64}$/.test(address??""))throw Error("Usage: inspect-installed-verifiers.ts <contract-address>");
setNetworkId("undeployed");
const provider=indexerPublicDataProvider("http://127.0.0.1:8088/api/v4/graphql","ws://127.0.0.1:8088/api/v4/graphql/ws");
const state=await provider.queryContractState(address);
if(!state)throw Error("Contract state unavailable");
const operations=state.operations().map(op=>typeof op==="string"?op:new TextDecoder().decode(op)).sort();
console.log(JSON.stringify({address,count:operations.length,operations}));
process.exit(0);
