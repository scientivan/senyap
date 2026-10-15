// SPDX-License-Identifier: Apache-2.0
import {describe, expect, it} from "vitest";
import {mkdtemp, readFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {runScenario, simulatorDriver} from "../../scripts/lib/local-product-scenario";
import {createLocalJournal} from "../../scripts/lib/local-submission-journal";

describe("local product network rehearsal", () => {
  it("settles both sides with two auction pools, shared purchases, subsidy and exact conservation", async () => {
    const {driver, calls} = simulatorDriver();
    const result = await runScenario(driver);
    expect(calls).toHaveLength(76);
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
