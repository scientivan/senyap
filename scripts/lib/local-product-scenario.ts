// SPDX-License-Identifier: Apache-2.0
// Synthetic identities/randomness are for the undeployed local network ONLY.
import assert from "node:assert/strict";
import * as RT from "@midnight-ntwrk/compact-runtime";
import { Contract, ledger, type Market } from "../../contracts/managed/senyap/contract/index.js";
import { setupGroups, bytes, hash, committee, commitment, operator } from "../../tests/contracts/harness";
import { summarizeTotals } from "../../apps/committee/src/decisions";
import { planTransitions } from "../../services/keeper/src/transitions";
import {scoutGroupTree} from "../../packages/sdk/src/group-trees";

const fixture = setupGroups();
export type LocalState = typeof fixture.context.currentPrivateState;
export type LocalContract = typeof fixture.contract;
export type Circuit = keyof LocalContract["impureCircuits"];
export type Args<K extends Circuit> = Parameters<LocalContract["impureCircuits"][K]> extends [unknown, ...infer A] ? A : never;
export type Result<K extends Circuit> = ReturnType<LocalContract["impureCircuits"][K]>["result"];
export type PublicState = ReturnType<typeof ledger>;
export const epochSeconds = 86400n;
export const cohort = [21, 22, 23, 24, 25].map(bytes);
export const buyers = [60, 64].map(bytes);
export const mask = (...options: number[]) => Array.from({length: 8}, (_, i) => options.includes(i));
export const hex = (value: Uint8Array) => Buffer.from(value).toString("hex");
export const initialPrivateState = (): LocalState => ({...fixture.context.currentPrivateState});
export const constructorArgs = (color: Uint8Array, recipient: {bytes: Uint8Array}) =>
  [hash(operator), committee.map(hash), RT.ecMulGenerator(37n), color, epochSeconds, 300n, 300n, 300n, 300n, recipient] as const;

// Resolve paths against each circuit's actual input ledger, rather than reusing
// simulator paths for a deployed contract. No production witness factory uses this.
export const witnesses: LocalContract["witnesses"] = {
  ...fixture.contract.witnesses,
  buyerPath: ({privateState, ledger}) => {
    const path = ledger.buyerTree.findPathForLeaf(hash(privateState.buyer));
    if (!path) throw Error("Local buyer path unavailable");
    return [privateState, path];
  },
  standingPath: ({privateState, ledger}) => {
    const path = ledger.goodStanding.findPathForLeaf(hash(privateState.buyer));
    if (!path) throw Error("Local standing path unavailable");
    return [privateState, path];
  },
  currentEpoch: ({privateState}) => [privateState, privateState.now / epochSeconds],
};

export interface Driver {
  recipient: {bytes: Uint8Array};
  patch(value: Partial<LocalState>): Promise<void>;
  read(): Promise<{state: PublicState; time: bigint}>;
  waitUntil(time: bigint): Promise<void>;
  call<K extends Circuit>(name: K, ...args: Args<K>): Promise<Result<K>>;
}

/** Same ordered scenario for simulator and network. Network waits for real block
 * time; only the simulator advances its own in-memory clock. */
export async function runScenario(driver: Driver) {
  const records: {secret: Uint8Array; salt: Uint8Array; id: Uint8Array; market: bigint}[] = [];
  const schedules: Market[] = [];
  for (const buyer of buyers) await driver.call("admitBuyer", hash(buyer));
  for (let i = 0; i < 2; i++) await driver.call("registerBuilder", bytes(80 + i), bytes(90 + i), (await driver.read()).time);
  for (const side of [0n, 1n]) {
    const {time} = await driver.read(), epoch = time / epochSeconds, group = bytes(4 + Number(side));
    // A full run must fit inside this fixture membership epoch.
    assert(time + 5400n < (epoch + 1n) * epochSeconds, "Local fixture epoch expires during run; wait for next epoch");
    await driver.call("configureScoutGroup", group, {side, tier: 1n, epoch, ecosystem: side === 0n ? bytes(0) : bytes(90)});
    for (const secret of cohort) await driver.call("admitScout", group, commitment(secret, epoch));
    const start = (await driver.read()).time, market = side + 1n;
    const config: Market = {subjective: false, side, category: bytes(70), questionHash: bytes(71 + Number(side)),
      questionUri: "demo://local-network-fixture", nOptions: 2n,
      optionRefs: [bytes(side === 0n ? 80 : 90), bytes(side === 0n ? 81 : 91), ...Array.from({length: 6}, () => bytes(0))],
      openAt: start, openUntil: start + 1800n, auctionUntil: start + (side === 0n ? 2100n : 1800n),
      outcomeUntil: start + 2700n, flatPrice: 10n, reservePrice: side === 0n ? 40n : 0n};
    schedules.push(config);
    await driver.patch({buyer: buyers[0]});
    if (side === 0n) await driver.call("createMarket", market, config); else await driver.call("createSideBMarket", market, config);
    for (const [index, secret] of cohort.entries()) {
      const {state} = await driver.read(), salt = bytes(100 + Number(side) * 10 + index);
      const path = scoutGroupTree(state,group).findPathForLeaf(commitment(secret, epoch));
      assert(path, "Local scout path unavailable");
      await driver.patch({scout: secret, option: 0n, salt, path});
      // Network proofs fix the early-bonus comparison; inclusion after the boundary
      // fails the contract segment. Never stake within 240 s before the boundary.
      const boundary = config.openAt + (config.openUntil - config.openAt) / 4n, now = (await driver.read()).time;
      if (now < boundary && boundary - now < 240n) await driver.waitUntil(boundary + 6n);
      const id = await driver.call("stake", market, group, 1n, 100n, bytes(88));
      records.push({secret, salt, id, market});
    }
  }
  for (const market of [1n, 2n]) {
    await driver.waitUntil(schedules[Number(market - 1n)].openUntil);
    // Exercise keeper planning on the real snapshot. Submission remains bounded
    // to this reviewed fixture, with no unrestricted recurring keeper loop.
    const {state, time} = await driver.read();
    assert(planTransitions(state, time).some(a => a.kind === "close" && a.market === market), "Keeper did not plan close");
    await driver.call("close", market);
    const weight = (await driver.read()).state.marketWeight.lookup(market);
    const histogram = summarizeTotals([weight, 0n]);
    for (let member = 0; member < 3; member++) {
      await driver.patch({committee: committee[member]});
      await driver.call("postPreview", market, histogram, BigInt(member));
    }
    // Place A bids immediately after its preview, before waiting for B close.
    if (market === 1n) for (let i = 0; i < 2; i++) {
      await driver.patch({buyer: buyers[i], bid: i === 0 ? 100n : 80n});
      await driver.call("placeBid", 1n, i === 0 ? 120n : 100n, driver.recipient);
    }
  }
  await driver.waitUntil(schedules[0].auctionUntil);
  const auctionState = (await driver.read()).state;
  const bidIds = buyers.map(buyer => RT.persistentHash(new RT.CompactTypeVector(2, RT.Bytes32Descriptor), [buyer, RT.convertFieldToBytes(32, 1n, "market")]));
  for (const id of bidIds) assert(auctionState.bids.member(id), "Local bid missing");
  const auction = {first: bidIds[0], second: bidIds[1], priceFirst: 80n, priceSecond: 40n};
  // Synthetic fixture knows its bids. Production must threshold-decrypt and
  // independently verify ranking before any committee approval.
  for (let member = 0; member < 3; member++) {
    await driver.patch({committee: committee[member]});
    await driver.call("postAuctionResult", 1n, auction, BigInt(member));
  }
  for (let i = 0; i < 2; i++) {
    const {state, time} = await driver.read();
    assert(planTransitions(state, time).some(a => a.kind === "settleBid" && hex(a.buyer) === hex(bidIds[i])), "Keeper did not plan bid settlement");
    await driver.call("settleBid", 1n, bidIds[i]);
    await driver.patch({buyer: buyers[i]});
    await driver.call("selectHidden", 1n, mask());
  }
  await driver.patch({buyer: buyers[0]});
  await driver.call("buyFlat", 2n, 0n);
  await driver.patch({buyer: buyers[1]});
  await driver.call("buyFlat", 2n, 1n);
  for (let pool = 0; pool < 2; pool++) {
    await driver.patch({buyer: buyers[pool]});
    await driver.call("recordOutcome", 1n, BigInt(pool), mask(0), bytes(140 + pool), false);
  }
  await driver.call("allocateSubsidy", 1n, 2n, 6n);
  await driver.patch({buyer: buyers[0]});
  await driver.call("recordOutcome", 2n, 0n, mask(0), bytes(142), false);
  for (const market of [1n, 2n]) {
    await driver.waitUntil(schedules[Number(market - 1n)].outcomeUntil);
    for (const record of records.filter(r => r.market === market)) {
      await driver.patch({scout: record.secret, option: 0n, salt: record.salt});
      for (let pool = 0; pool < (market === 1n ? 2 : 1); pool++) await driver.call("proveHit", market, 1n, BigInt(pool));
    }
  }
  let paid = 0n;
  const claims: {market: string; amount: string}[] = [];
  for (const market of [1n, 2n]) {
    await driver.waitUntil((await driver.read()).state.hitUntil.lookup(market));
    for (const record of records.filter(r => r.market === market)) {
      await driver.patch({scout: record.secret});
      const amount = await driver.call("claim", market, 1n, driver.recipient);
      assert(amount >= 100n, "Stake not fully refunded");
      paid += amount; claims.push({market: market.toString(), amount: amount.toString()});
    }
  }
  const {state} = await driver.read();
  assert.equal(state.bidEscrow.lookup(1n), 0n);
  assert.equal(state.marketRevenue.lookup(1n), 120n);
  assert.equal(state.marketRevenue.lookup(2n), 20n);
  assert.equal(state.marketSubsidy.lookup(2n), 6n);
  assert.equal(state.allocatedSubsidy.lookup(1n), 6n);
  for (const id of [1n, 2n]) {
    assert.equal(state.marketPhase.lookup(id), 9n);
    assert.equal(state.marketClaims.lookup(id), 5n);
    assert.equal(state.pendingDisputes.lookup(id), 0n);
  }
  // 1000 stake + 220 bid ceilings + 20 purchases = 1240 deposits.
  // Bid refunds 100, claims and retained platform/rounding must conserve it.
  const remainder = state.marketRemainder.lookup(1n) + state.marketRemainder.lookup(2n);
  assert.equal(1240n - 100n - paid, remainder);
  return {phases: ["settled", "settled"], claims, claimed: paid.toString(), bidRefunds: "100", remainder: remainder.toString(),
    input: "1240", conserved: true, note: "Synthetic local fixture; one funding wallet controls all actors. No claim of independent participants or network anonymity."};
}

/** Optional hook receives each call's proof data (used to replay /check offline). */
export function simulatorDriver(onProof?: (name: Circuit, proofData: RT.ProofData) => Promise<void>) {
  const contract = new Contract<LocalState>(witnesses), time = 1700000000n;
  const recipient = {bytes: bytes(250)};
  const initial = contract.initialState(RT.createConstructorContext(initialPrivateState(), "0".repeat(64)), ...constructorArgs(bytes(62), recipient));
  let context = RT.createCircuitContext(RT.sampleContractAddress(), "0".repeat(64), initial.currentContractState, initial.currentPrivateState, undefined, undefined, Number(time));
  const calls: string[] = [];
  const driver: Driver = {
    recipient,
    async patch(patch) {Object.assign(context.currentPrivateState, patch);},
    async read() {return {state: ledger(context.currentQueryContext.state), time: context.currentQueryContext.block.secondsSinceEpoch};},
    async waitUntil(time) {if (time > context.currentQueryContext.block.secondsSinceEpoch) context.currentQueryContext.block = {...context.currentQueryContext.block, secondsSinceEpoch: time};},
    async call<K extends Circuit>(name: K, ...args: Args<K>) {
      context.currentPrivateState.now = context.currentQueryContext.block.secondsSinceEpoch;
      const circuit = contract.impureCircuits[name] as (...args: unknown[]) => RT.CircuitResults<LocalState, Result<K>>;
      const result = circuit(context, ...args); context = result.context; calls.push(name);
      if (onProof) await onProof(name, result.proofData);
      return result.result;
    },
  };
  return {driver, calls};
}
