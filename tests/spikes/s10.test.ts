// SPDX-License-Identifier: Apache-2.0
import { describe,expect,it } from "vitest";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract,ledger } from "../../contracts/managed/spikes/s10-locked-card/contract/index.js";
import { splitSecret,createDecryptionShare,SCALAR_ORDER } from "../../packages/crypto/src/index";
import { encryptLockedCard,decryptLockedCard,lockedCardBinding,type LockedCard } from "../../packages/crypto/src/locked-card";
const bytes=(n:number)=>new Uint8Array(32).fill(n);
const dealer=37n,pk=RT.ecMulGenerator(dealer),shares=splitSecret(dealer,[71n,83n]);
const publicKeys=shares.map(share=>RT.ecMulGenerator(share.scalar));
type PS={commitment:Uint8Array;index:bigint;randomness:bigint};
function setup(payload:PS){
  const contract=new Contract<PS>({
    cardCommitment:({privateState})=>[privateState,privateState.commitment],
    cardIndex:({privateState})=>[privateState,privateState.index],
    cardRandomHigh:({privateState})=>[privateState,privateState.randomness>>128n],
    cardRandomLow:({privateState})=>[privateState,privateState.randomness&((1n<<128n)-1n)],
  });
  const initial=contract.initialState(RT.createConstructorContext(payload,"0".repeat(64)),pk);
  return {contract,context:RT.createCircuitContext(RT.sampleContractAddress(),"0".repeat(64),initial.currentContractState,payload)};
}
const proofs=(card:LockedCard,context:Uint8Array,ids=[0,1,2])=>Promise.all(ids.map(id=>createDecryptionShare(shares[id],card.ephemeral,lockedCardBinding(card,context))));

describe("S10 full-byte threshold membership cards",()=>{
  it("matches TypeScript ciphertext byte-for-byte and recovers 256-bit payload with every three-member subset",async()=>{
    const commitment=Uint8Array.from({length:32},(_,i)=>i%2===0?255:0),context=bytes(8),payload={commitment,index:(1n<<20n)-1n,randomness:123456789n};
    const s=setup(payload),result=s.contract.impureCircuits.seal(s.context,context);
    const card=ledger(result.context.currentQueryContext.state).cards.lookup(context);
    expect(card).toEqual(encryptLockedCard(pk,commitment,payload.index,context,payload.randomness));
    for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++){
      const recovered=await decryptLockedCard(card,await proofs(card,context,[a,b,c]),publicKeys,context);
      expect(recovered).toEqual({commitment,index:payload.index});
    }
    expect(()=>s.contract.impureCircuits.seal(result.context,context)).toThrow(/already used/);
  });
  it("rejects fewer than three shares, duplicates, wrong keys and modified payloads or context",async()=>{
    const context=bytes(9),card=encryptLockedCard(pk,bytes(255),0n,context,19n),valid=await proofs(card,context);
    await expect(decryptLockedCard(card,valid.slice(0,2),publicKeys,context)).rejects.toThrow(/3 to 5/);
    await expect(decryptLockedCard(card,[valid[0],valid[0],valid[2]],publicKeys,context)).rejects.toThrow(/unique/);
    await expect(decryptLockedCard(card,valid,publicKeys.map(()=>RT.ecMulGenerator(999n)),context)).rejects.toThrow(/proof/);
    const ciphertext=card.ciphertext.slice();ciphertext[0]^=1;
    const changed={...card,ciphertext};
    await expect(decryptLockedCard(changed,valid,publicKeys,context)).rejects.toThrow(/proof/);
    await expect(decryptLockedCard(changed,await proofs(changed,context),publicKeys,context)).rejects.toThrow(/authentication/);
    const wrongContext=bytes(10);
    await expect(decryptLockedCard(card,await proofs(card,wrongContext),publicKeys,wrongContext)).rejects.toThrow(/authentication/);
    const badTag={...card,tag:bytes(0)};
    await expect(decryptLockedCard(badTag,await proofs(badTag,context),publicKeys,context)).rejects.toThrow(/authentication/);
    await expect(decryptLockedCard({...card,version:2n},valid,publicKeys,context)).rejects.toThrow(/format/);
  });
  it("rejects out-of-range indices and zero or noncanonical randomness in the actual circuit",()=>{
    for(const payload of [
      {commitment:bytes(1),index:1n<<20n,randomness:1n},
      {commitment:bytes(1),index:0n,randomness:0n},
      {commitment:bytes(1),index:0n,randomness:SCALAR_ORDER},
    ]){
      const s=setup(payload);expect(()=>s.contract.impureCircuits.seal(s.context,bytes(2))).toThrow(/Card index|Card randomness/);
    }
    const one=encryptLockedCard(pk,bytes(0),0n,bytes(2),1n),two=encryptLockedCard(pk,bytes(0),0n,bytes(2),2n);
    expect(one.ciphertext).not.toEqual(two.ciphertext);
  });
});
