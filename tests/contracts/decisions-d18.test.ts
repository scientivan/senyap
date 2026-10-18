// SPDX-License-Identifier: Apache-2.0
// SPEC §16 (18 Oct 2026): operator 3-of-5 approvals, public intent listings,
// committee stake, absence slash and leaked-share reward.
import { describe, expect, it } from "vitest";
import { ledger } from "../../contracts/managed/senyap/contract/index.js";
import { bytes, hash, operatorMembers, setupGroups, shareScalars } from "./harness";
import { opActionId } from "../../packages/sdk/src/operator-actions";

const stateOf = (s: ReturnType<typeof setupGroups>) => ledger(s.context.currentQueryContext.state);

describe("D18-5 operator approvals", () => {
  it("needs three distinct approvals bound to the exact parameters", () => {
    const s = setupGroups(); s.autoApprove.on = false;
    expect(() => s.invoke("admitBuyer", hash(bytes(60)))).toThrow(/not proposed/);
    s.approveAs([0, 1], { circuit: "admitBuyer", commitment: hash(bytes(60)) });
    expect(() => s.invoke("admitBuyer", hash(bytes(60)))).toThrow(/Three operator approvals/);
    // Approvals for one buyer cannot admit another.
    s.approveAs([2], { circuit: "admitBuyer", commitment: hash(bytes(60)) });
    expect(() => s.invoke("admitBuyer", hash(bytes(61)))).toThrow(/not proposed/);
    s.invoke("admitBuyer", hash(bytes(60)));
    expect(stateOf(s).opApprovals.member(opActionId({ circuit: "admitBuyer", commitment: hash(bytes(60)) }))).toBe(false);
  });
  it("counts rejections as participation but not approval, and rejects foreign or double votes", () => {
    const s = setupGroups(); s.autoApprove.on = false;
    const call = { circuit: "admitBuyer" as const, commitment: hash(bytes(62)) };
    s.approveAs([0, 1], call); s.approveAs([2], call, false);
    expect(() => s.invoke("admitBuyer", hash(bytes(62)))).toThrow(/Three operator approvals/);
    s.context.currentPrivateState.operatorMember = operatorMembers[0];
    expect(() => s.raw("voteOperatorAction", opActionId(call), 0n, true, s.context.currentPrivateState.now)).toThrow(/Already voted/);
    s.context.currentPrivateState.operatorMember = bytes(9);
    expect(() => s.raw("voteOperatorAction", opActionId(call), 3n, true, s.context.currentPrivateState.now)).toThrow(/authorization failed/);
  });
  it("slashes a silent operator by half the required stake after the window, once", () => {
    const s = setupGroups(); s.autoApprove.on = false;
    const id = s.approveAs([0, 1], { circuit: "admitBuyer", commitment: hash(bytes(63)) });
    expect(() => s.raw("slashMissedOperator", id, 4n)).toThrow(/window open/);
    s.setTime(1000 + 86400);
    expect(() => s.raw("slashMissedOperator", id, 0n)).toThrow(/voted/);
    s.raw("slashMissedOperator", id, 4n);
    expect(stateOf(s).operatorStake.lookup(4n)).toBe(250n);
    expect(stateOf(s).protocolTreasury).toBe(250n);
    expect(() => s.raw("slashMissedOperator", id, 4n)).toThrow(/voted/);
  });
});

describe("D18-2 public intent listings", () => {
  it("lists with evidence, can be used as an option, and supports opt-out", () => {
    const s = setupGroups();
    s.invoke("registerPublicIntent", bytes(120), bytes(121), bytes(122), 1000n);
    const st = stateOf(s);
    expect(st.builderRegistry.lookup(bytes(120)).consent).toBe(true);
    expect(st.publicIntentEvidence.lookup(bytes(120))).toEqual(bytes(122));
    expect(() => s.invoke("registerPublicIntent", bytes(120), bytes(121), bytes(122), 1000n)).toThrow(/already listed/);
    s.invoke("optOutPublicIntent", bytes(120));
    expect(stateOf(s).builderRegistry.lookup(bytes(120)).consent).toBe(false);
  });
});

describe("D18-7/8 committee stake and slashing", () => {
  it("slashes absent members only when a duty misses the threshold", () => {
    const s = setupGroups();
    for (let m = 0; m < 5; m++) s.raw("stakeCommittee", BigInt(m), 500n);
    const command = bytes(130);
    s.raw("openCommitteeDuty", command, 1000n);
    expect(() => s.raw("slashAbsentCommittee", command, 1n)).toThrow(/still open/);
    s.setTime(1000 + 86400);
    s.raw("slashAbsentCommittee", command, 1n);
    expect(stateOf(s).committeeStake.lookup(1n)).toBe(250n);
    expect(() => s.raw("slashAbsentCommittee", command, 1n)).toThrow(/responded/);
  });
  it("seizes the whole stake when someone presents a member's leaked key share", () => {
    const s = setupGroups();
    s.raw("stakeCommittee", 2n, 500n);
    expect(() => s.raw("exposeLeakedShare", 2n, 999n, { bytes: bytes(140) })).toThrow(/does not match/);
    s.raw("exposeLeakedShare", 2n, shareScalars[2], { bytes: bytes(140) });
    expect(stateOf(s).committeeStake.lookup(2n)).toBe(0n);
    expect(stateOf(s).protocolTreasury).toBe(250n);
    expect(() => s.raw("exposeLeakedShare", 2n, shareScalars[2], { bytes: bytes(140) })).toThrow(/Nothing to seize/);
  });
});
