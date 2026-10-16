// SPDX-License-Identifier: Apache-2.0
import {describe,it,expect} from "vitest";
import {validatePartialInstallation} from "../../scripts/lib/local-submission-journal";

const contract="2493acc20de8a0ea6143f3f4c320e9113215e0a76f52ede6e8c6ab1b0ff723b1";
const deployId="00"+"a".repeat(64),installId="00"+"b".repeat(64),source="f".repeat(64);
const initial=["admitBuyer","admitScout","registerBuilder"];
const receipt=(id:string,status:string,kind:string,height:number)=>({identifiers:[id],status,actions:[{kind,address:contract}],blockHash:String(height).padStart(64,"0"),blockHeight:height,canonicalBlockHash:String(height).padStart(64,"0")});
const valid=()=>({sourceSha256:source,
  prior:{network:"undeployed",sourceSha256:source,publicResult:{contract},transactions:[{action:"deploy:senyap",status:"finalized",txId:deployId},{action:"install-verifiers:1",status:"submitted",txId:installId}]},
  deploy:receipt(deployId,"SUCCESS","ContractDeploy",15679),install:receipt(installId,"PARTIAL_SUCCESS","ContractUpdate",15682),
  finalizedHeight:15700,pendingExtrinsics:0,installed:[...initial].reverse(),initial});

describe("partial verifier installation resume gate",()=>{
  it("accepts a finalized deploy plus one ineffective installation",()=>{
    expect(validatePartialInstallation(valid())).toBe(contract);
  });
  it("rejects a fully successful installation, pending work or extra operations",()=>{
    const success=valid();success.install.status="SUCCESS";
    expect(()=>validatePartialInstallation(success)).toThrow();
    expect(()=>validatePartialInstallation({...valid(),pendingExtrinsics:1})).toThrow();
    expect(()=>validatePartialInstallation({...valid(),installed:[...initial,"stake"]})).toThrow();
  });
  it("rejects non-canonical or unfinalized receipts and other contracts",()=>{
    const fork=valid();fork.install.canonicalBlockHash="1".repeat(64);
    expect(()=>validatePartialInstallation(fork)).toThrow();
    expect(()=>validatePartialInstallation({...valid(),finalizedHeight:15680})).toThrow();
    const other=valid();other.deploy.actions=[{kind:"ContractDeploy",address:"0".repeat(64)}];
    expect(()=>validatePartialInstallation(other)).toThrow();
  });
  it("rejects journals with additional or unexpected actions",()=>{
    const extra=valid();extra.prior.transactions.push({action:"install-verifiers:2",status:"submitted",txId:installId});
    expect(()=>validatePartialInstallation(extra)).toThrow();
  });
});
