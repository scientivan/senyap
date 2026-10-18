// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from "vitest";
import {mkdtemp, readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {runScenario, simulatorDriver} from "../../scripts/lib/local-product-scenario";
import {createLocalJournal, validateRejectedFirstDeploy,canonicalSubmittedId,confirmedTokenDeployment,validateRejectedStagedDeploy} from "../../scripts/lib/local-submission-journal";

describe("local product network rehearsal", () => {
  it("blocks a staged replacement unless its exact rejection is bound and both fresh lookups are clear",async()=>{
    const sourceSha256="a".repeat(64),planSha256="b".repeat(64),txId="00"+"c".repeat(64);
    const prior={network:"undeployed",sourceSha256,planSha256,transactions:[{action:"deploy:senyap",status:"submitted",txId}]};
    const rejection={network:"undeployed",sourceSha256,planSha256,txId,nodeError:"1010 Invalid Transaction: Transaction would exhaust the block limits"};
    const input={sourceSha256,prior,rejection,observe:async()=>({indexerMatches:0,pendingExtrinsics:0})};
    expect(await validateRejectedStagedDeploy(input)).toBe(txId);
    await expect(validateRejectedStagedDeploy({...input,rejection:{...rejection,planSha256:"d".repeat(64)}})).rejects.toThrow(/binding/);
    await expect(validateRejectedStagedDeploy({...input,rejection:{...rejection,nodeError:"unknown"}})).rejects.toThrow(/Explicit/);
    await expect(validateRejectedStagedDeploy({...input,observe:async()=>({indexerMatches:1,pendingExtrinsics:0})})).rejects.toThrow(/blocked/);
    await expect(validateRejectedStagedDeploy({...input,observe:async()=>({indexerMatches:0,pendingExtrinsics:1})})).rejects.toThrow(/blocked/);
    await expect(validateRejectedStagedDeploy({...input,prior:{...prior,transactions:[...prior.transactions,...prior.transactions]}})).rejects.toThrow(/Only one/);
  });
  it("accepts another actual identifier without a repeat submission and rejects an unrelated wallet result",()=>{
    const ids=["00"+"a".repeat(64),"00"+"b".repeat(64)];
    expect(canonicalSubmittedId(ids,ids[1])).toBe(ids[0]);
    expect(()=>canonicalSubmittedId(ids,"00"+"c".repeat(64))).toThrow(/unrelated/);
  });
  it("resumes only one successful token deployment on the canonical finalized chain",()=>{
    const sourceSha256="a".repeat(64),txId="00"+"b".repeat(64),blockHash="c".repeat(64),address="d".repeat(64);
    const input={sourceSha256,prior:{network:"undeployed",sourceSha256,transactions:[{action:"deploy:dusd",status:"submitted",txId}]},receipt:{identifiers:[txId],status:"SUCCESS",actions:[{kind:"ContractDeploy",address}],blockHash,blockHeight:100},canonicalBlockHash:blockHash,finalizedHeight:101};
    expect(confirmedTokenDeployment(input)).toBe(address);
    expect(()=>confirmedTokenDeployment({...input,finalizedHeight:99})).toThrow(/finalized/);
    expect(()=>confirmedTokenDeployment({...input,canonicalBlockHash:"e".repeat(64)})).toThrow(/canonical/);
    expect(()=>confirmedTokenDeployment({...input,receipt:{...input.receipt,status:"FAILURE"}})).toThrow(/Successful/);
    expect(()=>confirmedTokenDeployment({...input,receipt:{...input.receipt,identifiers:[]}})).toThrow(/matching/);
    expect(()=>confirmedTokenDeployment({...input,prior:{...input.prior,transactions:[...input.prior.transactions,...input.prior.transactions]}})).toThrow(/one previously/);
    expect(()=>confirmedTokenDeployment({...input,receipt:{...input.receipt,actions:[...input.receipt.actions,...input.receipt.actions]}})).toThrow(/Exactly one/);
  });
  it("requires a rejected first deploy, matching deployment and fresh empty-chain/mempool reads before explicit recovery", async () => {
    const sourceSha256 = "a".repeat(64), txId = "00" + "c".repeat(64);
    const prior = {network: "undeployed", sourceSha256, transactions: [{action: "deploy:dusd", status: "submitted", txId}]};
    const rejection = {network: "undeployed", txId, nodeRejection: "Malformed(InvalidDustSpendProof)"};
    const observe = async () => ({indexerMatches: 0, pendingExtrinsics: 0});
    const input = {sourceSha256, prior, rejection, observe};
    expect(await validateRejectedFirstDeploy(input)).toBe(txId);
    await expect(validateRejectedFirstDeploy({...input, prior: {...prior, transactions: [{...prior.transactions[0], txId: "c".repeat(64)}]}})).rejects.toThrow("identifier");
    await expect(validateRejectedFirstDeploy({...input, prior: {...prior, network: "preprod"}})).rejects.toThrow("binding");
    await expect(validateRejectedFirstDeploy({...input, prior: {...prior, transactions: [...prior.transactions, ...prior.transactions]}})).rejects.toThrow("first deploy");
    await expect(validateRejectedFirstDeploy({...input, rejection: {...rejection, nodeRejection: undefined}})).rejects.toThrow("rejection evidence");
    for (const state of [{indexerMatches: 1, pendingExtrinsics: 0}, {indexerMatches: 0, pendingExtrinsics: 1}]) {
      await expect(validateRejectedFirstDeploy({...input, observe: async () => state})).rejects.toThrow("recovery blocked");
    }
    await expect(validateRejectedFirstDeploy({...input, observe: async () => {throw Error("offline");}})).rejects.toThrow("offline");
  });
  it("settles both sides with two auction pools, shared purchases, subsidy and exact conservation", async () => {
    const {driver, calls} = simulatorDriver();
    const result = await runScenario(driver);
    expect(calls).toHaveLength(127); // 76 product calls + 3 operator stakes + 48 operator votes (D18-5)
    expect(result).toMatchObject({phases: ["settled", "settled"], claimed: "1115", bidRefunds: "100", remainder: "25", input: "1240", conserved: true});
    expect(result.claims).toHaveLength(10);
    const {state} = await driver.read();
    expect(state.marketPools.lookup(1n)).toEqual([80n, 40n, 0n, 0n]);
    expect(state.marketPools.lookup(2n)).toEqual([20n, 0n, 0n, 0n]);
    expect(state.hitTree.firstFree()).toBe(10n);
  });

  it("persists the public ID before sending and blocks retries after an uncertain send", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "senyap-cycle-")), "journal.json");
    const binding = {sourceSha256: "a".repeat(64), planSha256: "b".repeat(64)};
    const journal = await createLocalJournal(path, binding, 1);
    let sends = 0;
    await expect(journal.action("stake", () => journal.submit("public-id", async () => {
      const saved = JSON.parse(await readFile(path, "utf8"));
      expect(saved.transactions).toEqual([{action: "stake", status: "submitted", txId: "public-id"}]);
      sends++; throw Error("Synthetic transport disconnected after send");
    }))).rejects.toThrow("disconnected");
    await journal.stop();
    expect(JSON.parse(await readFile(path, "utf8")).status).toContain("uncertain");
    await expect(journal.action("retry", async () => {sends++;})).rejects.toThrow("previously failed");
    await expect(journal.submit("another-id", async () => {sends++;})).rejects.toThrow("repeated");
    await expect(createLocalJournal(path, binding, 1)).rejects.toMatchObject({code: "EEXIST"});
    await expect(journal.complete({})).rejects.toThrow("incomplete");
    expect(sends).toBe(1);
  });

  it("enforces the reviewed transaction limit and finalizes only the entire sequence", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "senyap-cycle-")), "journal.json");
    const journal = await createLocalJournal(path, {sourceSha256: "a".repeat(64), planSha256: "b".repeat(64)}, 1);
    await journal.action("deploy", () => journal.submit("final-id", async () => ({finalized: true})));
    await journal.complete({conserved: true});
    const saved = JSON.parse(await readFile(path, "utf8"));
    expect(saved.status).toBe("completed");
    expect(saved.transactions[0].status).toBe("finalized");
    await expect(journal.action("extra-mint", async () => undefined)).rejects.toThrow("count exceeded");
    expect(journal.sent).toBe(1);
  });
});
